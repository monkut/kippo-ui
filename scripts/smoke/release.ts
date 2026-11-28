/**
 * Is the deployed SPA the latest kippo-ui release? Compares the React Router manifest the
 * deployed shell loads with the one in the release tarball kippo's `update_ui` installs.
 * A deploy that skipped `collectstatic` (or `zappa update`) keeps serving the old manifest.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isRateLimited } from "../github-rate-limit";
import { type Check, manifestName, releaseAssetName } from "./lib";

const NAME = "deployed UI is the latest release";
const RELEASE_REPO = "monkut/kippo-ui";
const RELEASE_URL = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;

interface GitHubRelease {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
}

export async function checkDeployedRelease(baseUrl: string, outDir: string): Promise<Check> {
  const shell = await fetch(`${baseUrl}/ui/`);
  const deployed = manifestName(await shell.text());
  if (shell.status !== 200 || !deployed) {
    return { name: NAME, status: "fail", detail: `GET /ui/ → HTTP ${shell.status}, no manifest` };
  }

  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(RELEASE_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "kippo-ui-smoke",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const reason = isRateLimited(response) ? "rate limited; set GITHUB_TOKEN" : "";
    return {
      name: NAME,
      status: "skip",
      detail: `GitHub HTTP ${response.status} ${reason}; deployed ${deployed}`,
    };
  }
  const release = (await response.json()) as GitHubRelease;
  const assetName = releaseAssetName(baseUrl);
  const asset = release.assets.find((candidate) => candidate.name === assetName);
  if (!asset) {
    return {
      name: NAME,
      status: "skip",
      detail: `${release.tag_name} has no ${assetName}; deployed ${deployed}`,
    };
  }

  mkdirSync(outDir, { recursive: true });
  const tarball = join(outDir, assetName);
  writeFileSync(
    tarball,
    Buffer.from(await (await fetch(asset.browser_download_url)).arrayBuffer()),
  );
  const released = manifestName(execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }));
  return released === deployed
    ? { name: NAME, status: "pass", detail: `${release.tag_name}, ${deployed}` }
    : {
        name: NAME,
        status: "fail",
        detail: `deployed ${deployed}, ${release.tag_name} has ${released} (update_ui + collectstatic + zappa update)`,
      };
}
