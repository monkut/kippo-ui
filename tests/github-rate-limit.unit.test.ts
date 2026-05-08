import { describe, expect, test } from "vitest";
import { GitHubRateLimitError, isRateLimited } from "../scripts/github-rate-limit";

function makeResponse(status: number, headers: Record<string, string | undefined>) {
  return {
    status,
    headers: {
      get: (name: string): string | null => {
        const value = headers[name.toLowerCase()];
        return value === undefined ? null : value;
      },
    },
  };
}

describe("isRateLimited", () => {
  test("returns true for 403 with X-RateLimit-Remaining=0 (unauthenticated rate-limit exhaustion)", () => {
    expect(isRateLimited(makeResponse(403, { "x-ratelimit-remaining": "0" }))).toBe(true);
  });

  test("returns false for 403 with X-RateLimit-Remaining>0 (auth failure, not rate limit)", () => {
    expect(isRateLimited(makeResponse(403, { "x-ratelimit-remaining": "42" }))).toBe(false);
  });

  test("returns false for 403 with no X-RateLimit-Remaining header (generic auth/permission error)", () => {
    expect(isRateLimited(makeResponse(403, {}))).toBe(false);
  });

  test("returns false for 200 even with X-RateLimit-Remaining=0 (success; header is informational)", () => {
    expect(isRateLimited(makeResponse(200, { "x-ratelimit-remaining": "0" }))).toBe(false);
  });

  test("returns false for 429 (standard rate-limit response — handled via retry)", () => {
    expect(isRateLimited(makeResponse(429, { "x-ratelimit-remaining": "0" }))).toBe(false);
  });

  test("returns false for 5xx server errors", () => {
    expect(isRateLimited(makeResponse(503, { "x-ratelimit-remaining": "0" }))).toBe(false);
  });
});

describe("GitHubRateLimitError", () => {
  test("carries an actionable message pointing to GITHUB_TOKEN", () => {
    const err = new GitHubRateLimitError();
    expect(err.message).toContain("GITHUB_TOKEN");
    expect(err.name).toBe("GitHubRateLimitError");
  });

  test("is throwable + catchable as an Error", () => {
    expect(() => {
      throw new GitHubRateLimitError();
    }).toThrow(Error);
  });
});
