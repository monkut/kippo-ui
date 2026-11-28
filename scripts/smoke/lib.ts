/**
 * Pure helpers for the deployed smoke test (`pnpm smoke`). No I/O here, so the rules that decide
 * pass / fail are unit-tested (tests/smoke.unit.test.ts).
 */

export type CheckStatus = "pass" | "fail" | "warn" | "skip";

export interface Check {
  name: string;
  status: CheckStatus;
  detail?: string;
}

export interface NetworkRow {
  method: string;
  url: string;
  /** null when the request never got a response. */
  status: number | null;
  ms: number | null;
  /** Response body bytes on the wire. */
  bytes: number | null;
  failure?: string;
}

export interface RouteObservation {
  finalUrl: string;
  text: string;
  network: NetworkRow[];
  consoleErrors: string[];
  pageErrors: string[];
  blockedWrites: string[];
}

export interface RouteExpectation {
  mustContain: string[];
  maxApiRequests: number;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TOKEN_REFRESH_PATH = "/api/token/refresh/";

/** Responses that fail by design in a JWT-only browser session (no Django session cookie). */
export const EXPECTED_FAILURES = [
  { method: "GET", pathSuffix: "/api/token/from-session/", status: 403 },
];

export const LOADING_TEXT = "読み込み中";
export const ERROR_TEXT = "失敗しました";
export const MIN_TEXT_LENGTH = 40;
/** A cancelled request (navigation, AbortController) is not a failure. */
const ABORTED = "net::ERR_ABORTED";
/** The browser logs one of these per failed response; the network rule already judges those. */
const RESOURCE_CONSOLE_ERROR = "Failed to load resource";

const pathOf = (url: string) => new URL(url).pathname;

/** The smoke test is read-only: only safe methods, plus the SPA's own JWT refresh. */
export function isSafeRequest(method: string, url: string): boolean {
  if (SAFE_METHODS.has(method)) return true;
  return method === "POST" && pathOf(url).endsWith(TOKEN_REFRESH_PATH);
}

export function isExpectedFailure(row: NetworkRow): boolean {
  return EXPECTED_FAILURES.some(
    (expected) =>
      row.method === expected.method &&
      row.status === expected.status &&
      pathOf(row.url).endsWith(expected.pathSuffix),
  );
}

export const isApiRequest = (row: NetworkRow) => pathOf(row.url).includes("/api/");

function isFailedRequest(row: NetworkRow): boolean {
  if (isExpectedFailure(row)) return false;
  if (row.failure !== undefined) return !row.failure.includes(ABORTED);
  return (row.status ?? 0) >= 400;
}

function duplicateUrls(network: NetworkRow[]): string[] {
  const counts = new Map<string, number>();
  for (const row of network) {
    const key = `${row.method} ${row.url}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].filter(([, count]) => count > 1).map(([key]) => key);
}

const listed = (items: string[], limit = 3) =>
  items.slice(0, limit).join(" | ") + (items.length > limit ? ` (+${items.length - limit})` : "");

/** Problems fail the route; warnings are reported without failing it. */
export function evaluateRoute(
  observation: RouteObservation,
  expectation: RouteExpectation,
): { problems: string[]; warnings: string[] } {
  const { finalUrl, network, consoleErrors, pageErrors, blockedWrites } = observation;
  const text = observation.text.trim();
  const problems: string[] = [];
  const warnings: string[] = [];

  if (pathOf(finalUrl).endsWith("/login")) problems.push("redirected to login");
  if (text.includes(LOADING_TEXT)) problems.push(`still ${LOADING_TEXT}`);
  if (text.includes(ERROR_TEXT)) problems.push(`error message shown (${ERROR_TEXT})`);
  if (text.length < MIN_TEXT_LENGTH) problems.push(`near-empty page (${text.length} chars)`);
  const missing = expectation.mustContain.filter((expected) => !text.includes(expected));
  if (missing.length > 0) problems.push(`missing text: ${listed(missing)}`);

  const failed = network.filter(isFailedRequest);
  if (failed.length > 0) {
    const lines = failed.map((row) => `${row.method} ${row.url} → ${row.status ?? row.failure}`);
    problems.push(`${failed.length} failed request(s): ${listed(lines)}`);
  }
  if (blockedWrites.length > 0) {
    problems.push(`${blockedWrites.length} write request(s) blocked: ${listed(blockedWrites)}`);
  }
  const scriptErrors = consoleErrors.filter((line) => !line.includes(RESOURCE_CONSOLE_ERROR));
  if (scriptErrors.length > 0) {
    problems.push(`${scriptErrors.length} console error(s): ${listed(scriptErrors)}`);
  }
  if (pageErrors.length > 0) {
    problems.push(`${pageErrors.length} uncaught error(s): ${listed(pageErrors)}`);
  }

  const apiRequests = network.filter(isApiRequest).length;
  if (apiRequests > expectation.maxApiRequests) {
    warnings.push(`${apiRequests} API requests (budget ${expectation.maxApiRequests})`);
  }
  const duplicates = duplicateUrls(network);
  if (duplicates.length > 0) {
    warnings.push(`${duplicates.length} duplicate request(s): ${listed(duplicates)}`);
  }
  return { problems, warnings };
}

/** KEY=VALUE lines of a dotenv file; `export ` prefixes and surrounding quotes are dropped. */
export function parseEnvFile(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

/**
 * path → HTTP methods declared in an OpenAPI YAML file (docs/openapi.yaml).
 *
 * Reads the two indentation levels under `paths:` directly; the repository has no YAML parser
 * dependency and the generated file's layout is stable.
 */
export function specOperations(openapiYaml: string): Record<string, string[]> {
  const operations: Record<string, string[]> = {};
  let inPaths = false;
  let current: string | null = null;
  for (const line of openapiYaml.split("\n")) {
    if (/^\S/.test(line)) {
      inPaths = line.startsWith("paths:");
      continue;
    }
    if (!inPaths) continue;
    const path = line.match(/^ {2}(\/\S*):\s*$/);
    if (path) {
      current = path[1];
      operations[current] = [];
      continue;
    }
    const method = line.match(/^ {4}(get|post|put|patch|delete):\s*$/);
    if (method && current) operations[current].push(method[1]);
  }
  return operations;
}

/** GET endpoints that need no path parameter: the ones a smoke test can call as they are. */
export function parameterlessGetPaths(operations: Record<string, string[]>): string[] {
  return Object.entries(operations)
    .filter(([path, methods]) => methods.includes("get") && !path.includes("{"))
    .map(([path]) => path);
}

/** The React Router manifest file named in an SPA shell or a tarball listing. */
export function manifestName(text: string): string | null {
  return text.match(/manifest-[A-Za-z0-9_-]+\.js/)?.[0] ?? null;
}

/** Release asset for the deployed stage: `/prod` → kippo-ui-build-prod.tar.gz (kippo `update_ui`). */
export function releaseAssetName(baseUrl: string): string {
  const stage = pathOf(baseUrl).replace(/^\/+|\/+$/g, "");
  return stage ? `kippo-ui-build-${stage}.tar.gz` : "kippo-ui-build.tar.gz";
}

/** File-name-safe label for a route; UUIDs collapse to `ID`. */
export function routeLabel(path: string): string {
  const label = path
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "ID")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_");
  return label || "index";
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function formatCheck(check: Check): string {
  return `${check.status.toUpperCase().padEnd(4)}  ${check.name}${check.detail ? `  -- ${check.detail}` : ""}`;
}
