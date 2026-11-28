/**
 * Read-only API checks against a deployed kippo. Every request is a GET, except the token
 * request that signs the smoke account in.
 */

import { readFileSync } from "node:fs";
import { type Check, parameterlessGetPaths, specOperations } from "./lib";

export interface SmokeConfig {
  baseUrl: string;
  username: string;
  password: string;
  outDir: string;
  specPath: string;
}

export interface Tokens {
  access: string;
  refresh: string;
}

/** Ids and names the UI checks need to build routes and to compare the page with the API. */
export interface Discovered {
  project: { id: string; name: string } | null;
  requirement: { id: string; project: string } | null;
  activeProjectNames: string[];
}

interface ApiResponse {
  status: number;
  body: unknown;
  ms: number;
}

const REQUEST_TIMEOUT_MS = 60_000;
/** The project-status query (app/lib/active-projects.ts). */
const ACTIVE_PROJECTS_PATH =
  "/api/projects/?is_active=true&exclude_category=non-project&page=1&page_size=200";
/** Requests that must be refused with a specific status. */
const EXPECTED_STATUS_CHECKS = [
  {
    name: "malformed ?project= filter is rejected",
    path: "/api/requirements/problem-definitions/?project=not-a-uuid",
    status: 400,
  },
];

async function request(url: string, init: RequestInit = {}): Promise<ApiResponse> {
  const started = Date.now();
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // not JSON: keep the text
  }
  return { status: response.status, body, ms: Date.now() - started };
}

const get = (config: SmokeConfig, path: string, token?: string) =>
  request(`${config.baseUrl}${path}`, {
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

/** First array in a list payload: `[...]`, `{results}`, `{organizations}`, `{members}`. */
function rowsOf(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    const list = Object.values(body).find((value) => Array.isArray(value));
    if (list) return list as Record<string, unknown>[];
  }
  return [];
}

export async function obtainTokens(config: SmokeConfig): Promise<Tokens> {
  const response = await request(`${config.baseUrl}/api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: config.username, password: config.password }),
  });
  const tokens = response.body as Partial<Tokens>;
  if (response.status !== 200 || !tokens.access || !tokens.refresh) {
    throw new Error(`POST /api/token/ returned HTTP ${response.status}`);
  }
  return { access: tokens.access, refresh: tokens.refresh };
}

/** Every path the UI's client was generated from must exist in the deployed schema. */
async function checkSchema(config: SmokeConfig, token: string, specPaths: string[]) {
  const response = await get(config, "/api/schema/?format=json", token);
  const deployed = Object.keys((response.body as { paths?: object })?.paths ?? {});
  if (response.status !== 200 || deployed.length === 0) {
    return { name: "schema", status: "fail", detail: `HTTP ${response.status}` } as Check;
  }
  const missing = specPaths.filter((path) => !deployed.includes(path));
  const extra = deployed.filter((path) => !specPaths.includes(path)).length;
  return {
    name: "schema: every path in docs/openapi.yaml is deployed",
    status: missing.length > 0 ? "fail" : "pass",
    detail:
      missing.length > 0
        ? `${missing.length} not deployed: ${missing.slice(0, 5).join(", ")}`
        : `${specPaths.length} paths, ${response.ms}ms` +
          (extra > 0 ? `; ${extra} deployed path(s) the UI spec does not have yet` : ""),
  } as Check;
}

/**
 * GET every parameterless endpoint in the spec. 5xx = broken, 404 = not deployed; a 4xx such as
 * 400 (needs a query parameter) or 403 (not for this account) still proves the route answers.
 */
async function sweepGetEndpoints(config: SmokeConfig, token: string, paths: string[]) {
  const checks: Check[] = [];
  for (const path of paths) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await get(config, `${path}${separator}page_size=1`, token);
    const broken = response.status >= 500 || response.status === 404;
    const answered = response.status >= 200 && response.status < 300;
    checks.push({
      name: `GET ${path}`,
      status: broken ? "fail" : "pass",
      detail: `HTTP ${response.status}, ${response.ms}ms${answered || broken ? "" : " (route answers)"}`,
    });
  }
  return checks;
}

/** Finds the ids the UI routes need, checking the two requests it makes on the way. */
export async function discover(
  config: SmokeConfig,
  token: string,
): Promise<{ checks: Check[]; discovered: Discovered }> {
  const checks: Check[] = [];
  const active = await get(config, ACTIVE_PROJECTS_PATH, token);
  const activeRows = rowsOf(active.body);
  checks.push({
    name: "active projects (project-status query)",
    status: active.status === 200 && activeRows.length > 0 ? "pass" : "fail",
    detail: `HTTP ${active.status}, ${activeRows.length} project(s), ${active.ms}ms`,
  });
  const row = activeRows.find((candidate) => candidate.projectstatus_display) ?? activeRows[0];
  const project = row ? { id: String(row.id), name: String(row.name) } : null;
  if (project) {
    const detail = await get(config, `/api/projects/${project.id}/`, token);
    checks.push({
      name: "project detail",
      status:
        detail.status === 200 && (detail.body as { id?: string }).id === project.id
          ? "pass"
          : "fail",
      detail: `HTTP ${detail.status}, ${detail.ms}ms`,
    });
  }
  const requirements = await get(config, "/api/requirements/business-requirements/", token);
  const requirement = rowsOf(requirements.body).find((candidate) => candidate.project);
  const discovered = {
    project,
    requirement: requirement
      ? { id: String(requirement.id), project: String(requirement.project) }
      : null,
    activeProjectNames: activeRows.map((candidate) => String(candidate.name)),
  };
  return { checks, discovered };
}

export async function runApiChecks(config: SmokeConfig, tokens: Tokens): Promise<Check[]> {
  const checks: Check[] = [];
  const operations = specOperations(readFileSync(config.specPath, "utf8"));

  const anonymous = await get(config, "/api/projects/");
  checks.push({
    name: "unauthenticated request is rejected",
    status: anonymous.status === 401 ? "pass" : "fail",
    detail: `HTTP ${anonymous.status}`,
  });
  checks.push(await checkSchema(config, tokens.access, Object.keys(operations)));
  checks.push(
    ...(await sweepGetEndpoints(config, tokens.access, parameterlessGetPaths(operations))),
  );
  for (const expected of EXPECTED_STATUS_CHECKS) {
    const response = await get(config, expected.path, tokens.access);
    checks.push({
      name: expected.name,
      status: response.status === expected.status ? "pass" : "fail",
      detail: `HTTP ${response.status}`,
    });
  }
  return checks;
}
