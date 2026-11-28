/**
 * Read-only smoke test of a deployed kippo + kippo-ui.
 *
 * Usage: pnpm smoke --base-url <https://host/stage> [--credentials-file <path>] [options]
 * See `pnpm smoke --help`. Exits 1 when any check fails; warnings do not fail the run.
 */

import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { discover, obtainTokens, runApiChecks, type SmokeConfig } from "./api-checks";
import { type Check, formatCheck, parseEnvFile } from "./lib";
import { checkDeployedRelease } from "./release";
import { runUiChecks } from "./ui-checks";

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const HELP = `Read-only smoke test of a deployed kippo + kippo-ui.

  pnpm smoke --base-url https://host/prod --credentials-file ../kippo/.env

Options
  --base-url <url>           Deployed origin + stage prefix (or SMOKE_BASE_URL)
  --credentials-file <path>  dotenv file to read credentials from
  --out <dir>                Where network tables, page text and screenshots go
                             (default: a new directory under the system temp directory)
  --api-only | --ui-only     Run one half
  --route <text>             Only UI routes whose path contains <text>
  --repeat <n>               Mount each UI route n times (timing samples)
  --skip-release-check       Do not compare the deployed bundle with the latest GitHub release

Credentials (environment, or --credentials-file)
  SMOKE_USERNAME / SMOKE_PASSWORD, else DEPLOYED_API_USERNAME / DEPLOYED_API_PASSWORD
  GITHUB_TOKEN (optional) lifts the GitHub rate limit for the release check
`;

function parseCli() {
  return parseArgs({
    options: {
      "base-url": { type: "string" },
      "credentials-file": { type: "string" },
      out: { type: "string" },
      "api-only": { type: "boolean", default: false },
      "ui-only": { type: "boolean", default: false },
      route: { type: "string" },
      repeat: { type: "string", default: "1" },
      "skip-release-check": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  }).values;
}

/** Local time as YYYYMMDD-HHMMSS (the sv-SE locale prints ISO-like local time). */
function timestamp(): string {
  return new Date().toLocaleString("sv-SE").replace(/[-:]/g, "").replace(" ", "-");
}

function buildConfig(args: ReturnType<typeof parseCli>): SmokeConfig {
  const envFile = args["credentials-file"];
  if (envFile && !existsSync(envFile)) throw new Error(`--credentials-file not found: ${envFile}`);
  const env = { ...(envFile ? parseEnvFile(readFileSync(envFile, "utf8")) : {}), ...process.env };
  const baseUrl = (args["base-url"] ?? env.SMOKE_BASE_URL ?? "").replace(/\/+$/, "");
  const username = env.SMOKE_USERNAME ?? env.DEPLOYED_API_USERNAME;
  const password = env.SMOKE_PASSWORD ?? env.DEPLOYED_API_PASSWORD;
  if (!baseUrl) throw new Error("--base-url (or SMOKE_BASE_URL) is required");
  if (!username || !password) {
    throw new Error(
      "credentials missing: set SMOKE_USERNAME / SMOKE_PASSWORD or pass --credentials-file",
    );
  }
  return {
    baseUrl,
    username,
    password,
    outDir: args.out ?? join(tmpdir(), `kippo-ui-smoke-${timestamp()}`),
    specPath: join(PROJECT_ROOT, "docs", "openapi.yaml"),
  };
}

function report(title: string, checks: Check[]): Check[] {
  console.log(`\n== ${title}`);
  for (const check of checks) console.log(formatCheck(check));
  return checks;
}

async function main(): Promise<number> {
  const args = parseCli();
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  const repeat = Number.parseInt(args.repeat, 10);
  if (!Number.isInteger(repeat) || repeat < 1) throw new Error("--repeat must be 1 or more");
  const config = buildConfig(args);
  console.log(`target: ${config.baseUrl}\noutput: ${config.outDir}`);

  const all: Check[] = [];
  const tokens = await obtainTokens(config);
  const found = await discover(config, tokens.access);
  if (!args["ui-only"]) {
    all.push(...report("API", [...(await runApiChecks(config, tokens)), ...found.checks]));
  }
  if (!args["api-only"]) {
    if (!args["skip-release-check"]) {
      all.push(...report("Release", [await checkDeployedRelease(config.baseUrl, config.outDir)]));
    }
    const options = { routeFilter: args.route, repeat };
    all.push(...report("UI", await runUiChecks(config, tokens, found.discovered, options)));
  }

  const count = (status: Check["status"]) => all.filter((check) => check.status === status).length;
  console.log(
    `\n${count("pass")} passed, ${count("fail")} failed, ${count("warn")} warning(s), ${count("skip")} skipped`,
  );
  return count("fail") > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: Error) => {
    console.error(`smoke: ${error.message}`);
    process.exit(2);
  },
);
