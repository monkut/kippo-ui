import { describe, expect, test, vi } from "vitest";
import {
  closeListenerSession,
  extractListenerConfigs,
  LISTENER_CLOSE_PATH,
  LISTENER_FOCUS_PATH,
  postListenerFocus,
} from "../app/lib/listener";

describe("extractListenerConfigs", () => {
  test("keeps only organizations with a listener URL, trimming the trailing slash", () => {
    const configs = extractListenerConfigs({
      organizations: [
        { id: "org-1", listener_api_url: "https://x.lambda-url.on.aws/", listener_api_key: "k1" },
        { id: "org-2", listener_api_url: "", listener_api_key: "" },
        { id: "org-3" }, // kippo without #66: fields absent
      ],
    });
    expect(configs).toEqual({ "org-1": { url: "https://x.lambda-url.on.aws", apiKey: "k1" } });
  });

  test("accepts the paginated {results:[{organizations}]} shape and garbage", () => {
    expect(
      extractListenerConfigs({
        results: [
          { organizations: [{ id: "o", listener_api_url: "https://l", listener_api_key: "" }] },
        ],
      }),
    ).toEqual({ o: { url: "https://l", apiKey: "" } });
    expect(extractListenerConfigs(null)).toEqual({});
    expect(extractListenerConfigs("nope")).toEqual({});
  });
});

describe("postListenerFocus", () => {
  const config = { url: "https://listener.example", apiKey: "secret" };

  test("POSTs the project id with the API key and reports ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await postListenerFocus(config, "proj-1", fetchImpl as unknown as typeof fetch);
    expect(result).toBe("ok");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://listener.example${LISTENER_FOCUS_PATH}`);
    expect(init.method).toBe("POST");
    expect(init.headers["X-API-Key"]).toBe("secret");
    expect(JSON.parse(init.body)).toEqual({ project_id: "proj-1", source: "ui" });
  });

  test("maps 404 to no-session, 409 to not-listed, other failures and exceptions to error, never throws", async () => {
    const notFound = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    expect(await postListenerFocus(config, "p", notFound as unknown as typeof fetch)).toBe(
      "no-session",
    );
    const notListed = vi.fn().mockResolvedValue({ ok: false, status: 409 });
    expect(await postListenerFocus(config, "p", notListed as unknown as typeof fetch)).toBe(
      "not-listed",
    );
    const unauthorized = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    expect(await postListenerFocus(config, "p", unauthorized as unknown as typeof fetch)).toBe(
      "error",
    );
    const down = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await postListenerFocus(config, "p", down as unknown as typeof fetch)).toBe("error");
  });
});

describe("closeListenerSession", () => {
  const config = { url: "https://listener.example", apiKey: "secret" };
  const respond = (init: object) => vi.fn().mockResolvedValue(init) as unknown as typeof fetch;

  test("POSTs to current/end with the API key and reports closed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    expect(await closeListenerSession(config, fetchImpl as unknown as typeof fetch)).toBe("closed");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://listener.example${LISTENER_CLOSE_PATH}`);
    expect(init.method).toBe("POST");
    expect(init.headers["X-API-Key"]).toBe("secret");
  });

  test("maps 404 to no-session, other failures and exceptions to error, never throws", async () => {
    expect(await closeListenerSession(config, respond({ ok: false, status: 404 }))).toBe(
      "no-session",
    );
    expect(await closeListenerSession(config, respond({ ok: false, status: 401 }))).toBe("error");
    const down = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await closeListenerSession(config, down as unknown as typeof fetch)).toBe("error");
  });
});
