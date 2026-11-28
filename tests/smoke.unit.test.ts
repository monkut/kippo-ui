import { describe, expect, test } from "vitest";
import {
  evaluateRoute,
  isSafeRequest,
  manifestName,
  median,
  type NetworkRow,
  parameterlessGetPaths,
  parseEnvFile,
  releaseAssetName,
  type RouteObservation,
  routeLabel,
  specOperations,
} from "../scripts/smoke/lib";

const BASE = "https://example.test/prod";
const row = (overrides: Partial<NetworkRow> = {}): NetworkRow => ({
  method: "GET",
  url: `${BASE}/api/projects/`,
  status: 200,
  ms: 100,
  bytes: 10,
  ...overrides,
});
const observation = (overrides: Partial<RouteObservation> = {}): RouteObservation => ({
  finalUrl: `${BASE}/ui/projects`,
  text: "プロジェクト一覧 ".repeat(10),
  network: [row()],
  consoleErrors: [],
  pageErrors: [],
  blockedWrites: [],
  ...overrides,
});
const expectation = { mustContain: ["プロジェクト一覧"], maxApiRequests: 30 };
const problemsOf = (overrides: Partial<RouteObservation>) =>
  evaluateRoute(observation(overrides), expectation).problems;

describe("smoke: isSafeRequest", () => {
  test("reads are safe, writes are not", () => {
    expect(isSafeRequest("GET", `${BASE}/api/projects/`)).toBe(true);
    expect(isSafeRequest("POST", `${BASE}/api/projects/`)).toBe(false);
    expect(isSafeRequest("DELETE", `${BASE}/api/projects/1/`)).toBe(false);
    expect(isSafeRequest("POST", "https://listener.test/sessions/current/focus")).toBe(false);
  });

  test("the SPA's JWT refresh is allowed; signing in is not", () => {
    expect(isSafeRequest("POST", `${BASE}/api/token/refresh/`)).toBe(true);
    expect(isSafeRequest("POST", `${BASE}/api/token/`)).toBe(false);
  });
});

describe("smoke: evaluateRoute problems", () => {
  test("a healthy mount has none", () => {
    expect(evaluateRoute(observation(), expectation)).toEqual({ problems: [], warnings: [] });
  });

  test("login redirect, loading text, error text, empty page, missing text", () => {
    expect(problemsOf({ finalUrl: `${BASE}/ui/login` })).toContain("redirected to login");
    expect(problemsOf({ text: `プロジェクト一覧 ${"読み込み中".repeat(10)}` })[0]).toMatch("still");
    expect(
      problemsOf({ text: `プロジェクト一覧 ${"x".repeat(40)} 読み込みに失敗しました` })[0],
    ).toMatch("error message shown");
    expect(problemsOf({ text: "プロジェクト一覧" })[0]).toMatch("near-empty page");
    expect(problemsOf({ text: "x".repeat(50) })[0]).toMatch("missing text: プロジェクト一覧");
  });

  test("4xx / 5xx responses and network failures fail the route", () => {
    expect(problemsOf({ network: [row({ status: 500 })] })[0]).toMatch("1 failed request(s)");
    expect(problemsOf({ network: [row({ status: 404 })] })[0]).toMatch("→ 404");
    expect(
      problemsOf({ network: [row({ status: null, failure: "net::ERR_CONNECTION_RESET" })] })[0],
    ).toMatch("ERR_CONNECTION_RESET");
  });

  test("the from-session 403 and cancelled requests are expected", () => {
    const fromSession = row({ url: `${BASE}/api/token/from-session/`, status: 403 });
    const cancelled = row({ status: null, failure: "net::ERR_ABORTED" });
    expect(problemsOf({ network: [fromSession, cancelled] })).toEqual([]);
    // Only that exact response is allowed: another status, or another 403, still fails.
    expect(problemsOf({ network: [{ ...fromSession, status: 500 }] })).toHaveLength(1);
    expect(problemsOf({ network: [row({ status: 403 })] })).toHaveLength(1);
  });

  test("a blocked write, a script console error and an uncaught error fail the route", () => {
    expect(problemsOf({ blockedWrites: ["POST https://listener.test/focus"] })[0]).toMatch(
      "1 write request(s) blocked",
    );
    expect(problemsOf({ pageErrors: ["Minified React error #310"] })[0]).toMatch("#310");
    expect(problemsOf({ consoleErrors: ["TypeError: x is undefined"] })[0]).toMatch("TypeError");
    // The browser's own line for a failed response is judged by the network rule instead.
    expect(
      problemsOf({ consoleErrors: ["Failed to load resource: the server responded with 403"] }),
    ).toEqual([]);
  });
});

describe("smoke: evaluateRoute warnings", () => {
  test("too many API requests and duplicate requests warn without failing", () => {
    const costs = Array.from({ length: 31 }, (_, index) =>
      row({ url: `${BASE}/api/monthly-costs/?project=${index}` }),
    );
    const fanOut = evaluateRoute(observation({ network: costs }), expectation);
    expect(fanOut.problems).toEqual([]);
    expect(fanOut.warnings).toEqual(["31 API requests (budget 30)"]);

    const twice = evaluateRoute(observation({ network: [row(), row()] }), expectation);
    expect(twice.warnings[0]).toMatch("1 duplicate request(s)");
  });

  test("static assets do not count as API requests", () => {
    const assets = Array.from({ length: 40 }, (_, index) =>
      row({ url: `${BASE}/static/ui/assets/chunk-${index}.js` }),
    );
    expect(evaluateRoute(observation({ network: assets }), expectation).warnings).toEqual([]);
  });
});

describe("smoke: file and name helpers", () => {
  test("parseEnvFile reads KEY=VALUE, export prefixes and quotes; skips comments", () => {
    const env = parseEnvFile("# comment\nA=1\nexport B=\"two words\"\nC='x=y'\n\nnot a line\n");
    expect(env).toEqual({ A: "1", B: "two words", C: "x=y" });
  });

  test("specOperations reads paths and methods under `paths:` only", () => {
    const yaml = [
      "openapi: 3.0.3",
      "paths:",
      "  /api/projects/:",
      "    get:",
      "      operationId: projects_list",
      "    post:",
      "      operationId: projects_create",
      "  /api/projects/{id}/:",
      "    get:",
      "      operationId: projects_retrieve",
      "  /api/token/:",
      "    post:",
      "      operationId: token_create",
      "components:",
      "  schemas:",
      "    get:",
      "      type: object",
    ].join("\n");
    const operations = specOperations(yaml);
    expect(operations).toEqual({
      "/api/projects/": ["get", "post"],
      "/api/projects/{id}/": ["get"],
      "/api/token/": ["post"],
    });
    expect(parameterlessGetPaths(operations)).toEqual(["/api/projects/"]);
  });

  test("manifestName finds the manifest in a shell or a tarball listing", () => {
    expect(manifestName('<link href="/prod/static/ui/assets/manifest-6aeda147.js">')).toBe(
      "manifest-6aeda147.js",
    );
    expect(manifestName("./assets/root-CremaH2E.js\n./assets/manifest-0ddcbeed.js\n")).toBe(
      "manifest-0ddcbeed.js",
    );
    expect(manifestName("<html></html>")).toBeNull();
  });

  test("releaseAssetName follows the stage prefix, as kippo's update_ui does", () => {
    expect(releaseAssetName("https://example.test/prod")).toBe("kippo-ui-build-prod.tar.gz");
    expect(releaseAssetName("https://example.test/stg/")).toBe("kippo-ui-build-stg.tar.gz");
    expect(releaseAssetName("https://example.test")).toBe("kippo-ui-build.tar.gz");
  });

  test("routeLabel is file-name safe and hides ids", () => {
    expect(routeLabel("")).toBe("index");
    expect(routeLabel("weekly-effort/yearly")).toBe("weekly-effort_yearly");
    expect(routeLabel("projects/ec6d6d7b-2d4d-4c3b-8a81-191d76c620f1/edit")).toBe(
      "projects_ID_edit",
    );
  });

  test("median", () => {
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});
