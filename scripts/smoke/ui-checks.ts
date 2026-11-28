/**
 * Read-only browser checks of the deployed SPA (Playwright, headless Chromium).
 *
 * The browser context refuses every request that is not safe (see `isSafeRequest`), so a page
 * that tries to write fails its route instead of changing data. Routing also turns the HTTP
 * cache off: every mount downloads its assets again, which the wall times include.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type BrowserContext, chromium, type Page, type Request } from "playwright";
import type { Discovered, SmokeConfig, Tokens } from "./api-checks";
import {
  type Check,
  evaluateRoute,
  isApiRequest,
  isSafeRequest,
  median,
  type NetworkRow,
  type RouteObservation,
  routeLabel,
} from "./lib";

export interface UiOptions {
  /** Only routes whose path contains this text. */
  routeFilter?: string;
  /** Mounts per route; more than one gives timing samples. */
  repeat: number;
}

interface UiRoute {
  path: string;
  mustContain: string[];
  maxApiRequests?: number;
  /** Extra read-only interaction after the mount; returns problems. */
  interact?: (page: Page, discovered: Discovered) => Promise<string[]>;
}

const UI_PREFIX = "/ui";
const NAVIGATION_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_API_REQUESTS = 30;
const SLIDE_CHANGE_TIMEOUT_MS = 2_000;
/** app/lib/listener.ts: the per-browser switch that stops project-status posting its focus. */
const LISTENER_FOCUS_SYNC_STORAGE_KEY = "listenerFocusSync";

/** Step through the project-status slideshow; every slide must be a project the API returned. */
async function walkSlides(page: Page, discovered: Discovered): Promise<string[]> {
  const title = async () => (await page.locator("h2").first().textContent())?.trim() ?? "";
  const titles = [await title()];
  for (let step = 1; step < discovered.activeProjectNames.length; step += 1) {
    const previous = titles[titles.length - 1];
    await page.keyboard.press("ArrowRight");
    const changed = await page
      .waitForFunction(
        (shown) => document.querySelector("h2")?.textContent?.trim() !== shown,
        previous,
        { timeout: SLIDE_CHANGE_TIMEOUT_MS },
      )
      .then(() => true)
      .catch(() => false);
    if (!changed) break;
    titles.push(await title());
  }
  const unknown = titles.filter((shown) => !discovered.activeProjectNames.includes(shown));
  if (unknown.length > 0) return [`${unknown.length} slide(s) not in the API list: ${unknown[0]}`];
  return titles.length > 1 ? [] : ["slideshow did not advance on ArrowRight"];
}

export function buildRoutes(discovered: Discovered): UiRoute[] {
  const routes: UiRoute[] = [
    { path: "", mustContain: ["週間稼働量"] },
    { path: "customers", mustContain: ["顧客一覧"] },
    { path: "projects", mustContain: ["プロジェクト一覧"] },
    { path: "project-assignments", mustContain: ["月別プロジェクト割当"] },
    { path: "my-assignments", mustContain: ["自分の割当"] },
    { path: "project-status", mustContain: ["プロジェクト状況"], interact: walkSlides },
    { path: "weekly-effort", mustContain: ["週間稼働量"] },
    { path: "weekly-effort/yearly", mustContain: ["年間稼働実績"] },
    { path: "billing", mustContain: ["プロジェクト請求一覧"] },
  ];
  const { project, requirement } = discovered;
  if (project) {
    routes.push(
      { path: `projects/${project.id}`, mustContain: [project.name] },
      { path: `projects/${project.id}/edit`, mustContain: ["プロジェクト編集"] },
      { path: `projects/${project.id}/summary`, mustContain: [project.name] },
      { path: `projects/${project.id}/assignments`, mustContain: [project.name] },
    );
  }
  if (requirement) {
    routes.push({
      path: `projects/${requirement.project}/requirements/${requirement.id}`,
      mustContain: [],
    });
  }
  return routes;
}

/** Collects what one mount did; `reset()` starts the next one. */
function observe(page: Page, context: BrowserContext) {
  const started = new Map<Request, number>();
  let rows: Promise<NetworkRow>[] = [];
  let consoleErrors: string[] = [];
  let pageErrors: string[] = [];
  let blockedWrites: string[] = [];

  const finished = async (request: Request, failure?: string): Promise<NetworkRow> => {
    const response = await request.response().catch(() => null);
    const sizes = await request.sizes().catch(() => null);
    const startedAt = started.get(request);
    return {
      method: request.method(),
      url: request.url(),
      status: response?.status() ?? null,
      ms: startedAt === undefined ? null : Date.now() - startedAt,
      bytes: sizes?.responseBodySize ?? null,
      failure,
    };
  };

  context.route("**/*", (route) => {
    const request = route.request();
    if (isSafeRequest(request.method(), request.url())) return route.continue();
    blockedWrites.push(`${request.method()} ${request.url()}`);
    return route.abort("blockedbyclient");
  });
  page.on("request", (request) => started.set(request, Date.now()));
  page.on("requestfinished", (request) => rows.push(finished(request)));
  page.on("requestfailed", (request) => {
    // A request the guard refused is already in blockedWrites.
    if (!isSafeRequest(request.method(), request.url())) return;
    rows.push(finished(request, request.failure()?.errorText ?? "failed"));
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  return {
    reset() {
      rows = [];
      consoleErrors = [];
      pageErrors = [];
      blockedWrites = [];
    },
    async collect(): Promise<Omit<RouteObservation, "finalUrl" | "text">> {
      return { network: await Promise.all(rows), consoleErrors, pageErrors, blockedWrites };
    },
  };
}

async function signIn(page: Page, config: SmokeConfig, tokens: Tokens) {
  await page.goto(`${config.baseUrl}${UI_PREFIX}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([access, refresh, username, focusSyncKey]) => {
      localStorage.setItem("authToken", access);
      localStorage.setItem("refreshToken", refresh);
      localStorage.setItem("username", username);
      localStorage.setItem(focusSyncKey, "off");
    },
    [tokens.access, tokens.refresh, config.username, LISTENER_FOCUS_SYNC_STORAGE_KEY],
  );
}

function saveArtifacts(outDir: string, label: string, observation: RouteObservation) {
  const table = observation.network
    .map((row) => [row.method, row.status ?? row.failure, row.ms, row.bytes, row.url].join("\t"))
    .join("\n");
  writeFileSync(join(outDir, `${label}.network.tsv`), `method\tstatus\tms\tbytes\turl\n${table}\n`);
  writeFileSync(join(outDir, `${label}.text.txt`), observation.text);
}

async function mountRoute(
  page: Page,
  observer: ReturnType<typeof observe>,
  route: UiRoute,
  config: SmokeConfig,
  discovered: Discovered,
  label: string,
): Promise<Check> {
  observer.reset();
  const extraProblems: string[] = [];
  const startedAt = Date.now();
  await page
    .goto(`${config.baseUrl}${UI_PREFIX}/${route.path}`, {
      waitUntil: "networkidle",
      timeout: NAVIGATION_TIMEOUT_MS,
    })
    .catch((error: Error) => extraProblems.push(`navigation: ${error.message.split("\n")[0]}`));
  const seconds = (Date.now() - startedAt) / 1000;
  if (route.interact && extraProblems.length === 0) {
    extraProblems.push(...(await route.interact(page, discovered)));
  }
  const observation: RouteObservation = {
    finalUrl: page.url(),
    text: await page.innerText("body").catch(() => ""),
    ...(await observer.collect()),
  };
  saveArtifacts(config.outDir, label, observation);
  await page.screenshot({ path: join(config.outDir, `${label}.png`), fullPage: true });

  const { problems, warnings } = evaluateRoute(observation, {
    mustContain: route.mustContain,
    maxApiRequests: route.maxApiRequests ?? DEFAULT_MAX_API_REQUESTS,
  });
  problems.push(...extraProblems);
  const api = observation.network.filter(isApiRequest);
  const apiMs = api.flatMap((row) => (row.ms === null ? [] : [row.ms]));
  const summary =
    `${seconds.toFixed(1)}s, ${api.length} API request(s)` +
    (apiMs.length > 0
      ? ` (median ${Math.round(median(apiMs))}ms, max ${Math.max(...apiMs)}ms)`
      : "");
  return {
    name: `${UI_PREFIX}/${route.path}`,
    status: problems.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
    detail: [summary, ...problems, ...warnings].join("; "),
  };
}

export async function runUiChecks(
  config: SmokeConfig,
  tokens: Tokens,
  discovered: Discovered,
  options: UiOptions,
): Promise<Check[]> {
  mkdirSync(config.outDir, { recursive: true });
  const routes = buildRoutes(discovered).filter(
    (route) => !options.routeFilter || `/${route.path}`.includes(options.routeFilter),
  );
  const browser = await chromium.launch();
  const checks: Check[] = [];
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const observer = observe(page, context);
    await signIn(page, config, tokens);
    for (const [index, route] of routes.entries()) {
      for (let run = 1; run <= options.repeat; run += 1) {
        const order = String(index + 1).padStart(2, "0");
        const suffix = options.repeat > 1 ? `-run${run}` : "";
        const label = `${order}-${routeLabel(route.path)}${suffix}`;
        const check = await mountRoute(page, observer, route, config, discovered, label);
        checks.push({ ...check, name: `${check.name}${suffix.replace("-", " ")}` });
      }
    }
  } finally {
    await browser.close();
  }
  return checks;
}
