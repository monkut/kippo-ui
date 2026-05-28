import { describe, expect, test } from "vitest";
import {
  buildGrid,
  countAssignmentsByConfirmation,
  filterAssignmentsToVisibleProjects,
  firstOfNextMonth,
  flattenPatternToAssignmentRequests,
  formatMonth,
} from "~/components/project-assignments/utils";
import type {
  ProjectAssignmentPattern,
  ProjectMonthlyAssignment,
} from "~/lib/api/generated/models";

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
      makeAssignment({
        user: "user-1",
        user_display_name: "Alice",
        month: "2026-06-01",
        percentage: 50,
      }),
      makeAssignment({
        user: "user-1",
        user_display_name: "Alice",
        month: "2026-07-01",
        percentage: 60,
      }),
      makeAssignment({
        user: "user-2",
        user_display_name: "Bob",
        month: "2026-06-01",
        percentage: 30,
      }),
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
      makeAssignment({
        user: "user-1",
        user_display_name: "",
        user_username: "alice",
        month: "2026-06-01",
      }),
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

describe("firstOfNextMonth", () => {
  test("returns first-of-next-month for mid-month input", () => {
    expect(firstOfNextMonth(new Date(2026, 5, 15))).toBe("2026-07-01"); // June 15 → July 1
  });

  test("rolls over December to January of the next year", () => {
    expect(firstOfNextMonth(new Date(2026, 11, 31))).toBe("2027-01-01"); // Dec 31 → Jan 1 next year
  });

  test("zero-pads single-digit months", () => {
    expect(firstOfNextMonth(new Date(2026, 0, 15))).toBe("2026-02-01"); // Jan → Feb
  });
});

function makePattern(overrides: Partial<ProjectAssignmentPattern> = {}): ProjectAssignmentPattern {
  return {
    pattern_ids: ["P1-max-reuse"],
    label: "test",
    estimated_completion: "2026-09-15",
    infeasible: false,
    conflicts: [],
    members: [],
    ...overrides,
  };
}

describe("flattenPatternToAssignmentRequests: row generation", () => {
  test("emits one request per (member × month) entry", () => {
    const pattern = makePattern({
      members: [
        {
          user_id: "user-1",
          is_past_member: true,
          monthly_percentages: { "2026-06-01": 50, "2026-07-01": 60 },
        },
        { user_id: "user-2", is_past_member: false, monthly_percentages: { "2026-06-01": 30 } },
      ],
    });
    expect(flattenPatternToAssignmentRequests(pattern, "proj-1")).toHaveLength(3);
  });

  test("preserves project, user, month, percentage fields", () => {
    const pattern = makePattern({
      members: [
        { user_id: "user-42", is_past_member: false, monthly_percentages: { "2026-08-01": 75 } },
      ],
    });
    const [request] = flattenPatternToAssignmentRequests(pattern, "proj-99");
    expect(request).toMatchObject({
      project: "proj-99",
      user: "user-42",
      month: "2026-08-01",
      percentage: 75,
    });
  });
});

describe("flattenPatternToAssignmentRequests: confirmation + edge cases", () => {
  test("posts as is_confirmed=false (kippo#224 C1)", () => {
    const pattern = makePattern({
      members: [
        { user_id: "user-1", is_past_member: true, monthly_percentages: { "2026-06-01": 50 } },
      ],
    });
    expect(flattenPatternToAssignmentRequests(pattern, "proj-1")[0].is_confirmed).toBe(false);
  });

  test("returns empty array for an empty pattern", () => {
    expect(flattenPatternToAssignmentRequests(makePattern({ members: [] }), "proj-1")).toEqual([]);
  });

  test("returns empty array when members have no monthly_percentages", () => {
    const pattern = makePattern({
      members: [{ user_id: "user-1", is_past_member: true, monthly_percentages: {} }],
    });
    expect(flattenPatternToAssignmentRequests(pattern, "proj-1")).toEqual([]);
  });
});

describe("countAssignmentsByConfirmation (kippo#23)", () => {
  test("empty input returns zero counts", () => {
    expect(countAssignmentsByConfirmation([])).toEqual({ confirmed: 0, unconfirmed: 0 });
  });

  test("counts confirmed and unconfirmed rows separately", () => {
    const rows = [
      makeAssignment({ id: 1, is_confirmed: true }),
      makeAssignment({ id: 2, is_confirmed: true }),
      makeAssignment({ id: 3, is_confirmed: false }),
    ];
    expect(countAssignmentsByConfirmation(rows)).toEqual({ confirmed: 2, unconfirmed: 1 });
  });

  test("treats missing/falsy is_confirmed as unconfirmed", () => {
    const rows = [
      makeAssignment({ id: 1, is_confirmed: false }),
      makeAssignment({ id: 2, is_confirmed: false }),
    ];
    expect(countAssignmentsByConfirmation(rows)).toEqual({ confirmed: 0, unconfirmed: 2 });
  });

  test("all-confirmed input has unconfirmed=0 (disables 確定 button)", () => {
    const rows = [
      makeAssignment({ id: 1, is_confirmed: true }),
      makeAssignment({ id: 2, is_confirmed: true }),
    ];
    expect(countAssignmentsByConfirmation(rows)).toEqual({ confirmed: 2, unconfirmed: 0 });
  });
});

describe("filterAssignmentsToVisibleProjects (kippo#23)", () => {
  test("drops assignments whose project isn't in the visible set", () => {
    const rows = [
      makeAssignment({ id: 1, project: "proj-a" }),
      makeAssignment({ id: 2, project: "proj-b" }),
      makeAssignment({ id: 3, project: "proj-c" }),
    ];
    const visible = [{ id: "proj-a" }, { id: "proj-c" }];
    const result = filterAssignmentsToVisibleProjects(rows, visible);
    expect(result.map((a) => a.id)).toEqual([1, 3]);
  });

  test("empty visibleProjects drops everything (matches matrix's silent-skip)", () => {
    const rows = [
      makeAssignment({ id: 1, project: "proj-a" }),
      makeAssignment({ id: 2, project: "proj-b" }),
    ];
    expect(filterAssignmentsToVisibleProjects(rows, [])).toEqual([]);
  });

  test("empty assignments returns empty", () => {
    expect(filterAssignmentsToVisibleProjects([], [{ id: "proj-a" }])).toEqual([]);
  });

  test("keeps every row when all projects are visible", () => {
    const rows = [
      makeAssignment({ id: 1, project: "proj-a" }),
      makeAssignment({ id: 2, project: "proj-b" }),
    ];
    const visible = [{ id: "proj-a" }, { id: "proj-b" }];
    expect(filterAssignmentsToVisibleProjects(rows, visible)).toEqual(rows);
  });
});
