/**
 * Rate-limit helpers for the GitHub API client used by `update-api-client.ts`.
 *
 * Extracted into its own module so the helper can be unit-tested without
 * triggering the main script's CLI entry point.
 */

export const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
export const HTTP_STATUS_FORBIDDEN = 403;

export class GitHubRateLimitError extends Error {
  constructor() {
    super(
      "GitHub API rate-limit exceeded. Set the GITHUB_TOKEN environment variable " +
        "(any PAT with public_repo scope) and re-run.",
    );
    this.name = "GitHubRateLimitError";
  }
}

/**
 * GitHub returns 403 with `X-RateLimit-Remaining: 0` for unauthenticated rate-limit
 * exhaustion (60/hr/IP), not 429. Detect that case so callers can surface a clear
 * "set GITHUB_TOKEN" error instead of throwing the generic "Failed to fetch: 403".
 *
 * The Python-side counterpart (`kippo/manage.py update_ui`) has the same gap;
 * see the project CLAUDE.md.
 */
export function isRateLimited(response: {
  status: number;
  headers: { get: (name: string) => string | null };
}): boolean {
  return (
    response.status === HTTP_STATUS_FORBIDDEN &&
    response.headers.get("x-ratelimit-remaining") === "0"
  );
}
