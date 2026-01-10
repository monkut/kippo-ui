/**
 * Script to fetch the latest openapi.yaml from kippo GitHub releases
 * and generate the API client using orval.
 *
 * Usage: pnpm update:api
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

const KIPPO_REPO = "monkut/kippo";
const GITHUB_API_URL = `https://api.github.com/repos/${KIPPO_REPO}/releases/latest`;
const OPENAPI_OUTPUT_PATH = join(PROJECT_ROOT, "docs", "openapi.yaml");

interface GitHubRelease {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  const response = await fetch(url, options);

  // Retry on 5xx errors (server errors) or 429 (rate limit)
  if ((response.status >= 500 || response.status === 429) && retries > 0) {
    const delay = RETRY_DELAY_MS * (MAX_RETRIES - retries + 1);
    console.log(
      `Request failed with ${response.status}, retrying in ${delay}ms... (${retries} retries left)`,
    );
    await sleep(delay);
    return fetchWithRetry(url, options, retries - 1);
  }

  return response;
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  console.log(`Fetching latest release from ${KIPPO_REPO}...`);

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "kippo-ui-api-client-generator",
  };

  // Use GITHUB_TOKEN if available for higher rate limits
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    console.log("Using GITHUB_TOKEN for authenticated request");
  }

  const response = await fetchWithRetry(GITHUB_API_URL, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch release info: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<GitHubRelease>;
}

async function downloadOpenApiSchema(release: GitHubRelease): Promise<void> {
  const openApiAsset = release.assets.find((asset) => asset.name === "openapi.yaml");

  if (!openApiAsset) {
    throw new Error(
      `openapi.yaml not found in release ${release.tag_name}. Available assets: ${release.assets.map((a) => a.name).join(", ")}`,
    );
  }

  console.log(`Downloading openapi.yaml from release ${release.tag_name}...`);

  const response = await fetch(openApiAsset.browser_download_url);

  if (!response.ok) {
    throw new Error(`Failed to download openapi.yaml: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();

  // Ensure docs directory exists
  const docsDir = dirname(OPENAPI_OUTPUT_PATH);
  if (!existsSync(docsDir)) {
    mkdirSync(docsDir, { recursive: true });
  }

  writeFileSync(OPENAPI_OUTPUT_PATH, content, "utf-8");
  console.log(`✓ Saved openapi.yaml to ${OPENAPI_OUTPUT_PATH}`);
}

function generateApiClient(): void {
  console.log("Generating API client with orval...");

  try {
    execSync("npx orval --config ./orval.config.cjs", {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    });
    console.log("✓ API client generated successfully");
  } catch (error) {
    throw new Error(`Failed to generate API client: ${error}`);
  }
}

async function main(): Promise<void> {
  try {
    // Check for --skip-download flag
    const skipDownload = process.argv.includes("--skip-download");
    const skipGenerate = process.argv.includes("--skip-generate");

    if (!skipDownload) {
      const release = await fetchLatestRelease();
      console.log(`Latest release: ${release.tag_name}`);
      await downloadOpenApiSchema(release);
    } else {
      console.log("Skipping download (--skip-download flag set)");
    }

    if (!skipGenerate) {
      generateApiClient();
    } else {
      console.log("Skipping generation (--skip-generate flag set)");
    }

    console.log("\n✓ API client update complete!");
  } catch (error) {
    console.error(`\n✗ Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

main();
