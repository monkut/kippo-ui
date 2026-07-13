import { afterEach, describe, expect, test, vi } from "vitest";

// Mock the fetch mutator so we can drive per-page responses for fetchAllBillingEntries.
const fetchMock = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("~/lib/api/custom-fetch", () => ({
  customFetch: (url: string) => fetchMock.fn(url),
}));

import { fetchAllBillingEntries } from "~/lib/api/billing";

function pageOf(url: string): number {
  const m = url.match(/[?&]page=(\d+)/);
  return m ? Number(m[1]) : 1;
}

afterEach(() => fetchMock.fn.mockReset());

describe("fetchAllBillingEntries", () => {
  test("single page returns immediately (one request)", async () => {
    fetchMock.fn.mockResolvedValue({
      status: 200,
      data: { count: 2, results: [{ id: 1 }, { id: 2 }] },
    });
    const rows = await fetchAllBillingEntries();
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
    expect(fetchMock.fn).toHaveBeenCalledTimes(1);
  });

  test("walks all pages (count-driven) and concatenates in order", async () => {
    fetchMock.fn.mockImplementation((url: string) => {
      const results = pageOf(url) === 1 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }];
      return Promise.resolve({ status: 200, data: { count: 3, results } });
    });
    const rows = await fetchAllBillingEntries();
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  test("throws when the first page fails (no silent empty)", async () => {
    fetchMock.fn.mockResolvedValue({ status: 500, data: undefined });
    await expect(fetchAllBillingEntries()).rejects.toThrow();
  });

  test("throws when a later page fails (no silent truncation)", async () => {
    fetchMock.fn.mockImplementation((url: string) =>
      pageOf(url) === 1
        ? Promise.resolve({ status: 200, data: { count: 4, results: [{ id: 1 }, { id: 2 }] } })
        : Promise.resolve({ status: 503, data: undefined }),
    );
    await expect(fetchAllBillingEntries()).rejects.toThrow();
  });
});
