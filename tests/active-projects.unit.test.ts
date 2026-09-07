import { beforeEach, describe, expect, test, vi } from "vitest";
import type { KippoProject } from "~/lib/api/generated";

// projectsList is mocked so fetchActiveProjects' pagination loop can be driven directly.
const api = vi.hoisted(() => ({
  calls: [] as Record<string, unknown>[],
  pages: [] as { results: unknown[]; next: string | null }[],
}));
vi.mock("~/lib/api/generated", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/api/generated")>();
  return {
    ...actual,
    projectsList: (params: Record<string, unknown>) => {
      api.calls.push(params);
      return Promise.resolve({ data: api.pages[api.calls.length - 1] });
    },
  };
});

import {
  ACTIVE_PROJECT_PHASES,
  compareActiveProjects,
  fetchActiveProjects,
  selectActiveProjects,
} from "~/lib/active-projects";

function project(overrides: Partial<KippoProject> & { name: string }): KippoProject {
  return {
    id: overrides.name,
    phase: "under-contract",
    confidence: 100,
    target_date: null,
    display_as_active: true,
    is_closed: false,
    ...overrides,
  } as unknown as KippoProject;
}

describe("lib/active-projects — admin ordering parity", () => {
  test("sorts by confidence descending within a phase", () => {
    const rows = [project({ name: "b", confidence: 90 }), project({ name: "a", confidence: 100 })];
    expect(rows.sort(compareActiveProjects).map((p) => p.name)).toEqual(["a", "b"]);
  });

  test("orders the pipeline 契約 → 口頭受注 → 提案 高 → 中 → 低 ahead of confidence", () => {
    // every row carries the SAME confidence, so only the phase rank can produce this order
    const rows = [
      project({ name: "提案低", phase: "proposing-low", confidence: 99 }),
      project({ name: "提案中", phase: "proposing-mid", confidence: 99 }),
      project({ name: "提案高", phase: "proposing-high", confidence: 99 }),
      project({ name: "口頭受注", phase: "verbal-order", confidence: 99 }),
      project({ name: "契約稼働中", phase: "under-contract", confidence: 99 }),
    ];
    expect(rows.sort(compareActiveProjects).map((p) => p.name)).toEqual([
      "契約稼働中",
      "口頭受注",
      "提案高",
      "提案中",
      "提案低",
    ]);
  });

  test("breaks a confidence tie on 完了予定日 ascending, then name", () => {
    const rows = [
      project({ name: "late", confidence: 99, target_date: "2026-12-01" }),
      project({ name: "zzz", confidence: 99, target_date: "2026-01-01" }),
      project({ name: "aaa", confidence: 99, target_date: "2026-01-01" }),
    ];
    expect(rows.sort(compareActiveProjects).map((p) => p.name)).toEqual(["aaa", "zzz", "late"]);
  });

  test("orders a null 完了予定日 last, matching Postgres ASC", () => {
    const rows = [
      project({ name: "undated", confidence: 99, target_date: null }),
      project({ name: "dated", confidence: 99, target_date: "2026-05-01" }),
    ];
    expect(rows.sort(compareActiveProjects).map((p) => p.name)).toEqual(["dated", "undated"]);
  });
});

describe("lib/active-projects — admin filter parity", () => {
  test("keeps only the phases the active-project changelist shows by default", () => {
    expect([...ACTIVE_PROJECT_PHASES]).toEqual([
      "under-contract",
      "completed",
      "verbal-order",
      "proposing-high",
      "proposing-mid",
      "proposing-low",
    ]);

    const kept = selectActiveProjects([
      project({ name: "contracted", phase: "under-contract" }),
      project({ name: "verbal", phase: "verbal-order", confidence: 99 }),
      project({ name: "done", phase: "completed" }),
      project({ name: "proposing", phase: "proposing-low", confidence: 30 }),
      project({ name: "kit", phase: "keep-in-touch", confidence: 0 }),
      project({ name: "lost", phase: "lost", confidence: 0 }),
    ]);

    // KIT / 失注 are the only phases dropped
    expect(kept.map((p) => p.name).sort()).toEqual(["contracted", "done", "proposing", "verbal"]);
  });

  test("口頭受注 lands directly after the 確度100% contracted block (kippo#56)", () => {
    // 提案 rows can carry a manually-overridden confidence at or above 口頭受注's 99; the phase
    // rank keeps them below it regardless.
    const ordered = selectActiveProjects([
      project({ name: "提案低-100", phase: "proposing-low", confidence: 100 }),
      project({ name: "提案低-99", phase: "proposing-low", confidence: 99 }),
      project({ name: "口頭受注", phase: "verbal-order", confidence: 99 }),
      project({ name: "契約稼働中", phase: "under-contract", confidence: 100 }),
    ]);

    expect(ordered.map((p) => p.name)).toEqual([
      "契約稼働中",
      "口頭受注",
      "提案低-100",
      "提案低-99",
    ]);
  });

  test("drops closed and non-active rows", () => {
    const kept = selectActiveProjects([
      project({ name: "ok" }),
      project({ name: "closed", is_closed: true }),
      project({ name: "hidden", display_as_active: false }),
    ]);
    expect(kept.map((p) => p.name)).toEqual(["ok"]);
  });
});

describe("lib/active-projects — pagination", () => {
  beforeEach(() => {
    api.calls = [];
    api.pages = [];
  });

  test("follows `next` so the sort runs over the complete set, not one page", async () => {
    api.pages = [
      {
        results: [project({ name: "page1", confidence: 99, phase: "verbal-order" })],
        next: "?page=2",
      },
      { results: [project({ name: "page2", confidence: 100 })], next: null },
    ];

    const rows = await fetchActiveProjects();

    expect(api.calls).toHaveLength(2);
    expect(api.calls[0]).toMatchObject({
      is_active: true,
      exclude_category: "non-project",
      page: 1,
    });
    expect(api.calls[1]).toMatchObject({ page: 2 });
    // The page-2 row outranks the page-1 row — only reachable because both pages were fetched.
    expect(rows.map((p) => p.name)).toEqual(["page2", "page1"]);
  });

  test("requests the maximum page size to keep the round-trip count down", async () => {
    api.pages = [{ results: [], next: null }];
    await fetchActiveProjects();
    expect(api.calls[0]).toMatchObject({ page_size: 200 });
  });

  test("stops after a single page when there is no `next`", async () => {
    api.pages = [{ results: [project({ name: "only" })], next: null }];
    const rows = await fetchActiveProjects();
    expect(api.calls).toHaveLength(1);
    expect(rows.map((p) => p.name)).toEqual(["only"]);
  });
});
