import { beforeEach, describe, expect, test, vi } from "vitest";

// monthlyCostsList is mocked so the paging loop can be driven directly (kiconiaworks/kippo#82).
const api = vi.hoisted(() => ({
  calls: [] as Record<string, unknown>[],
  pages: [] as ({ results: unknown[]; next: string | null } | Error)[],
}));
vi.mock("~/lib/api/generated", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/api/generated")>();
  return {
    ...actual,
    monthlyCostsList: (params: Record<string, unknown>) => {
      api.calls.push(params);
      const page = api.pages[api.calls.length - 1];
      return page instanceof Error ? Promise.reject(page) : Promise.resolve({ data: page });
    },
  };
});

import { fetchMonthlyCostsByProject } from "~/components/infra-cost-display";

const cost = (project: string, month: string, amount: number) => ({
  id: `${project}-${month}`,
  project,
  month,
  cost: amount,
  currency: "USD",
});

describe("fetchMonthlyCostsByProject", () => {
  beforeEach(() => {
    api.calls = [];
    api.pages = [];
  });

  test("one unfiltered request serves every project", async () => {
    api.pages = [
      {
        results: [
          cost("proj-a", "2026-10-01", 10),
          cost("proj-b", "2026-10-01", 5),
          cost("proj-a", "2026-11-01", 20),
        ],
        next: null,
      },
    ];

    const costsByProject = await fetchMonthlyCostsByProject();

    expect(api.calls).toEqual([{ page: 1, page_size: 200 }]);
    expect(Object.keys(costsByProject).sort()).toEqual(["proj-a", "proj-b"]);
    expect(costsByProject["proj-a"].map((row) => row.cost)).toEqual([10, 20]);
    expect(costsByProject["proj-b"].map((row) => row.cost)).toEqual([5]);
  });

  test("follows `next` across pages", async () => {
    api.pages = [
      { results: [cost("proj-a", "2026-10-01", 10)], next: "page-2" },
      { results: [cost("proj-a", "2026-11-01", 20), cost("proj-c", "2026-11-01", 1)], next: null },
    ];

    const costsByProject = await fetchMonthlyCostsByProject();

    expect(api.calls.map((call) => call.page)).toEqual([1, 2]);
    expect(costsByProject["proj-a"]).toHaveLength(2);
    expect(costsByProject["proj-c"]).toHaveLength(1);
  });

  test("a project without cost rows has no entry", async () => {
    api.pages = [{ results: [cost("proj-a", "2026-10-01", 10)], next: null }];

    expect((await fetchMonthlyCostsByProject())["proj-z"]).toBeUndefined();
  });

  test("a failed page keeps the rows already read", async () => {
    api.pages = [
      { results: [cost("proj-a", "2026-10-01", 10)], next: "page-2" },
      new Error("network"),
    ];

    const costsByProject = await fetchMonthlyCostsByProject();

    expect(api.calls).toHaveLength(2);
    expect(costsByProject["proj-a"]).toHaveLength(1);
  });
});
