import { describe, expect, test } from "vitest";
import { buildGrid, formatMonth } from "~/components/project-assignments/utils";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";

// Mirror of the kippo backend ProjectMonthlyAssignment shape for fixture brevity.
function makeAssignment(overrides: Partial<ProjectMonthlyAssignment>): ProjectMonthlyAssignment {
  return {
    id: 1,
    project: "proj-1",
    project_name: "Project One",
    user: "user-1",
    user_username: "alice",
    user_display_name: "Alice Anderson",
    user_github_login: "alice-gh",
    user_slack_username: null,
    user_slack_image_url: null,
    month: "2026-06-01",
    percentage: 50,
    is_confirmed: true,
    created_datetime: "2026-05-08T00:00:00Z",
    updated_datetime: "2026-05-08T00:00:00Z",
    ...overrides,
  };
}

describe("buildGrid: empty + single-user shapes", () => {
  test("returns empty grid for empty input", () => {
    const grid = buildGrid([]);
    expect(grid.months).toEqual([]);
    expect(grid.byUser).toEqual([]);
    expect(grid.monthTotals.size).toBe(0);
  });

  test("groups assignments by user and month", () => {
    const grid = buildGrid([
      makeAssignment({ user: "user-1", user_display_name: "Alice", month: "2026-06-01", percentage: 50 }),
      makeAssignment({ user: "user-1", user_display_name: "Alice", month: "2026-07-01", percentage: 60 }),
      makeAssignment({ user: "user-2", user_display_name: "Bob", month: "2026-06-01", percentage: 30 }),
    ]);

    expect(grid.months).toEqual(["2026-06-01", "2026-07-01"]);
    expect(grid.byUser).toHaveLength(2);

    const aliceRow = grid.byUser.find((r) => r.userKey === "user-1");
    expect(aliceRow?.displayName).toBe("Alice");
    expect(aliceRow?.cells.get("2026-06-01")?.percentage).toBe(50);
    expect(aliceRow?.cells.get("2026-07-01")?.percentage).toBe(60);

    const bobRow = grid.byUser.find((r) => r.userKey === "user-2");
    expect(bobRow?.cells.get("2026-06-01")?.percentage).toBe(30);
    expect(bobRow?.cells.get("2026-07-01")).toBeUndefined();
  });

  test("falls back to username when display_name is empty", () => {
    const grid = buildGrid([
      makeAssignment({ user: "user-1", user_display_name: "", user_username: "alice", month: "2026-06-01" }),
    ]);

    expect(grid.byUser[0].displayName).toBe("alice");
  });

  test("ignores assignments with null month", () => {
    const grid = buildGrid([
      makeAssignment({ user: "user-1", month: null, percentage: 50 }),
      makeAssignment({ user: "user-1", month: "2026-06-01", percentage: 30 }),
    ]);

    expect(grid.months).toEqual(["2026-06-01"]);
    expect(grid.byUser[0].cells.size).toBe(1);
  });
});

describe("buildGrid: ordering + totals", () => {
  test("sums monthly totals across users", () => {
    const grid = buildGrid([
      makeAssignment({ user: "user-1", month: "2026-06-01", percentage: 50 }),
      makeAssignment({ user: "user-2", month: "2026-06-01", percentage: 60 }),
      makeAssignment({ user: "user-1", month: "2026-07-01", percentage: 40 }),
    ]);

    expect(grid.monthTotals.get("2026-06-01")).toBe(110);
    expect(grid.monthTotals.get("2026-07-01")).toBe(40);
  });

  test("sorts users by display name", () => {
    const grid = buildGrid([
      makeAssignment({ user: "user-c", user_display_name: "Charlie", month: "2026-06-01" }),
      makeAssignment({ user: "user-a", user_display_name: "Alice", month: "2026-06-01" }),
      makeAssignment({ user: "user-b", user_display_name: "Bob", month: "2026-06-01" }),
    ]);

    expect(grid.byUser.map((r) => r.displayName)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  test("sorts months ascending", () => {
    const grid = buildGrid([
      makeAssignment({ month: "2026-08-01" }),
      makeAssignment({ month: "2026-06-01" }),
      makeAssignment({ month: "2026-07-01" }),
    ]);

    expect(grid.months).toEqual(["2026-06-01", "2026-07-01", "2026-08-01"]);
  });
});

describe("buildGrid: duplicate-row data anomaly path", () => {
  test("sums duplicate user-month percentages", () => {
    const grid = buildGrid([
      makeAssignment({ user: "user-1", month: "2026-06-01", percentage: 30, is_confirmed: true }),
      makeAssignment({ user: "user-1", month: "2026-06-01", percentage: 25, is_confirmed: false }),
    ]);

    const cell = grid.byUser[0].cells.get("2026-06-01");
    expect(cell?.percentage).toBe(55);
    // Cell is confirmed only when every contributing row is confirmed.
    expect(cell?.isConfirmed).toBe(false);
    expect(grid.monthTotals.get("2026-06-01")).toBe(55);
  });

  test("preserves is_confirmed=true when all contributors confirmed", () => {
    const grid = buildGrid([
      makeAssignment({ user: "user-1", month: "2026-06-01", percentage: 25, is_confirmed: true }),
      makeAssignment({ user: "user-1", month: "2026-06-01", percentage: 25, is_confirmed: true }),
    ]);

    expect(grid.byUser[0].cells.get("2026-06-01")?.isConfirmed).toBe(true);
  });
});

describe("formatMonth", () => {
  test("strips day component", () => {
    expect(formatMonth("2026-06-01")).toBe("2026-06");
  });

  test("handles month with two-digit value", () => {
    expect(formatMonth("2026-12-01")).toBe("2026-12");
  });
});
