import { describe, expect, test } from "vitest";
import {
  addMonths,
  buildCellTooltip,
  buildMonthlyMatrix,
  compareActiveKippoProjects,
  firstOfMonth,
  formatPersonDays,
  percentageToPersonDays,
} from "~/components/project-assignments/utils";
import type {
  KippoProject,
  OrganizationMemberDetail,
  ProjectMonthlyAssignment,
} from "~/lib/api/generated/models";

function makeProject(
  id: string,
  name: string,
  overrides: Partial<KippoProject> = {},
): KippoProject {
  // Cast through unknown — KippoProject has many required fields the matrix doesn't read.
  return {
    id,
    name,
    start_date: "2026-01-01",
    target_date: "2026-12-31",
    ...overrides,
  } as unknown as KippoProject;
}

function makeMember(overrides: Partial<OrganizationMemberDetail> = {}): OrganizationMemberDetail {
  return {
    user_id: "u-1",
    username: "alice",
    display_name: "Alice",
    first_name: "alice",
    last_name: "doe",
    email: "alice@example.com",
    github_login: "alice-gh",
    is_developer: true,
    is_project_manager: false,
    slack_username: "",
    slack_user_id: "",
    slack_image_url: "",
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<ProjectMonthlyAssignment>): ProjectMonthlyAssignment {
  return {
    id: 1,
    project: "p-1",
    project_name: "Project 1",
    user: "u-1",
    user_username: "alice",
    user_display_name: "Alice",
    user_github_login: "alice-gh",
    user_slack_username: null,
    user_slack_image_url: null,
    month: "2026-05-01",
    percentage: 50,
    is_confirmed: true,
    created_datetime: "2026-05-08T00:00:00Z",
    updated_datetime: "2026-05-08T00:00:00Z",
    ...overrides,
  };
}

describe("buildMonthlyMatrix: projects in rows", () => {
  test("returns empty matrix for empty inputs", () => {
    const m = buildMonthlyMatrix([], []);
    expect(m.users).toEqual([]);
    expect(m.rows).toEqual([]);
    expect(m.userTotals.size).toBe(0);
  });

  test("includes all active projects, even when they have no assignments", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-1", "P1"), makeProject("p-2", "P2")],
      [makeAssignment({ project: "p-1", user: "u-1", percentage: 50 })],
    );
    expect(m.rows).toHaveLength(2);
    const p2 = m.rows.find((r) => r.project.id === "p-2");
    expect(p2?.cells.size).toBe(0);
    expect(p2?.rowTotal).toBe(0);
  });

  test("excludes assignments whose project isn't in the active set", () => {
    const m = buildMonthlyMatrix(
      [],
      [makeAssignment({ project: "p-other", user: "u-1", percentage: 25 })],
    );
    expect(m.rows).toEqual([]);
    expect(m.users).toEqual([]);
  });
});

describe("buildMonthlyMatrix: members in columns", () => {
  test("includes all org members as columns when provided, regardless of assignments", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-1", "P1")],
      [makeAssignment({ project: "p-1", user: "u-1", user_display_name: "Alice", percentage: 50 })],
      [
        makeMember({ user_id: "u-1", display_name: "Alice" }),
        makeMember({ user_id: "u-2", display_name: "Bob" }),
        makeMember({ user_id: "u-3", display_name: "Carol" }),
      ],
    );
    expect(m.users.map((u) => u.display_name)).toEqual(["Alice", "Bob", "Carol"]);
    expect(m.rows[0].cells.get("u-1")?.percentage).toBe(50);
    expect(m.rows[0].cells.get("u-2")).toBeUndefined();
  });

  test("falls back to username when member display_name is empty", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-1", "P1")],
      [],
      [makeMember({ user_id: "u-1", username: "alice", display_name: "" })],
    );
    expect(m.users[0].display_name).toBe("alice");
  });
});

describe("buildMonthlyMatrix: pivot + ordering", () => {
  test("pivots assignments into project × user cells", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-1", "Project A"), makeProject("p-2", "Project B")],
      [
        makeAssignment({ project: "p-1", user: "u-1", user_display_name: "Alice", percentage: 50 }),
        makeAssignment({ project: "p-1", user: "u-2", user_display_name: "Bob", percentage: 30 }),
        makeAssignment({ project: "p-2", user: "u-2", user_display_name: "Bob", percentage: 60 }),
      ],
    );
    expect(m.users.map((u) => u.display_name)).toEqual(["Alice", "Bob"]);

    const projectA = m.rows.find((r) => r.project.id === "p-1");
    expect(projectA?.cells.get("u-1")?.percentage).toBe(50);
    expect(projectA?.cells.get("u-2")?.percentage).toBe(30);
    expect(projectA?.rowTotal).toBe(80);

    const projectB = m.rows.find((r) => r.project.id === "p-2");
    expect(projectB?.cells.get("u-1")).toBeUndefined();
    expect(projectB?.cells.get("u-2")?.percentage).toBe(60);
  });

  test("sorts users by display name and rows by project name", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-z", "Z-Project"), makeProject("p-a", "A-Project")],
      [
        makeAssignment({ project: "p-z", user: "u-c", user_display_name: "Charlie" }),
        makeAssignment({ project: "p-z", user: "u-a", user_display_name: "Alice" }),
        makeAssignment({ project: "p-a", user: "u-b", user_display_name: "Bob" }),
      ],
    );
    expect(m.rows.map((r) => r.project.name)).toEqual(["A-Project", "Z-Project"]);
    expect(m.users.map((u) => u.display_name)).toEqual(["Alice", "Bob", "Charlie"]);
  });
});

describe("buildMonthlyMatrix: totals + edge cases", () => {
  test("computes per-user totals across projects", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-1", "P1"), makeProject("p-2", "P2")],
      [
        makeAssignment({ project: "p-1", user: "u-1", percentage: 50 }),
        makeAssignment({ project: "p-2", user: "u-1", percentage: 60 }),
        makeAssignment({ project: "p-1", user: "u-2", percentage: 40 }),
      ],
    );
    expect(m.userTotals.get("u-1")).toBe(110); // over-allocated
    expect(m.userTotals.get("u-2")).toBe(40);
  });

  test("sums duplicate user-project rows and downgrades is_confirmed when any contributor is unconfirmed", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-1", "P1")],
      [
        makeAssignment({ project: "p-1", user: "u-1", percentage: 30, is_confirmed: true }),
        makeAssignment({ project: "p-1", user: "u-1", percentage: 25, is_confirmed: false }),
      ],
    );
    const cell = m.rows[0].cells.get("u-1");
    expect(cell?.percentage).toBe(55);
    expect(cell?.isConfirmed).toBe(false);
  });

  test("falls back to username when display_name is empty", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-1", "P1")],
      [
        makeAssignment({
          project: "p-1",
          user: "u-1",
          user_username: "alice",
          user_display_name: "",
        }),
      ],
    );
    expect(m.users[0].display_name).toBe("alice");
  });
});

describe("formatPersonDays", () => {
  test("integers render without decimals", () => {
    expect(formatPersonDays(22)).toBe("22");
    expect(formatPersonDays(0)).toBe("0");
  });

  test("non-integers render to one decimal", () => {
    expect(formatPersonDays(8.36)).toBe("8.4");
    expect(formatPersonDays(11.04)).toBe("11");
    expect(formatPersonDays(11.05)).toBe("11.1");
  });
});

describe("buildCellTooltip", () => {
  test("returns 4-line breakdown when available_work_days is known", () => {
    const t = buildCellTooltip("確定済み", 100, 22);
    expect(t.split("\n")).toEqual([
      "確定済み",
      "Monthly Total Staff Days: 22",
      "Monthly Project Assignment %: 100%",
      "Monthly Project Staff Days: (22 x 100%) 22",
    ]);
  });

  test("includes formatted staff-day result for fractional outcomes", () => {
    const t = buildCellTooltip("未確定 (予測)", 38, 22);
    // 0.38 × 22 = 8.36 → "8.4"
    expect(t).toContain("Monthly Project Staff Days: (22 x 38%) 8.4");
  });

  test("falls back to baseTitle alone when available_work_days is missing", () => {
    expect(buildCellTooltip("確定済み", 50, null)).toBe("確定済み");
    expect(buildCellTooltip("確定済み", 50, undefined)).toBe("確定済み");
  });

  test("0% still renders the breakdown (calc still meaningful)", () => {
    const t = buildCellTooltip("未確定 (予測)", 0, 22);
    expect(t).toContain("Monthly Project Assignment %: 0%");
    expect(t).toContain("Monthly Project Staff Days: (22 x 0%) 0");
  });
});

describe("percentageToPersonDays", () => {
  test("converts percent of available days", () => {
    expect(percentageToPersonDays(50, 22)).toBe(11);
    expect(percentageToPersonDays(100, 22)).toBe(22);
    expect(percentageToPersonDays(25, 20)).toBe(5);
  });

  test("0% → 0 days", () => {
    expect(percentageToPersonDays(0, 22)).toBe(0);
  });

  test("null/undefined available_work_days → null (caller passed no `?month=`)", () => {
    expect(percentageToPersonDays(50, null)).toBeNull();
    expect(percentageToPersonDays(50, undefined)).toBeNull();
  });
});

describe("buildMonthlyMatrix: person-days totals (rowEffortDays + userEffortDays)", () => {
  test("rowEffortDays sums (cell% / 100 × user.available_work_days) across cells", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-1", "P1")],
      [
        makeAssignment({ project: "p-1", user: "u-1", percentage: 50 }),
        makeAssignment({ project: "p-1", user: "u-2", percentage: 25 }),
      ],
      [
        makeMember({ user_id: "u-1", display_name: "Alice", available_work_days: 22 }),
        makeMember({ user_id: "u-2", display_name: "Bob", available_work_days: 20 }),
      ],
    );
    // Alice: 50% × 22 = 11; Bob: 25% × 20 = 5; total = 16.
    expect(m.rows[0].rowEffortDays).toBeCloseTo(16, 5);
  });

  test("userEffortDays sums (cell% / 100 × user.available_work_days) across projects", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-1", "P1"), makeProject("p-2", "P2")],
      [
        makeAssignment({ project: "p-1", user: "u-1", percentage: 50 }),
        makeAssignment({ project: "p-2", user: "u-1", percentage: 30 }),
      ],
      [makeMember({ user_id: "u-1", available_work_days: 22 })],
    );
    // 80% × 22 = 17.6
    expect(m.userEffortDays.get("u-1")).toBeCloseTo(17.6, 5);
  });

  test("rowEffortDays is null when no contributing cell has known available_work_days", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-1", "P1")],
      [makeAssignment({ project: "p-1", user: "u-1", percentage: 50 })],
      [makeMember({ user_id: "u-1", available_work_days: null })],
    );
    expect(m.rows[0].rowEffortDays).toBeNull();
  });

  test("partial null: only counts members whose available_work_days is known", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-1", "P1")],
      [
        makeAssignment({ project: "p-1", user: "u-1", percentage: 50 }),
        makeAssignment({ project: "p-1", user: "u-2", percentage: 25 }),
      ],
      [
        makeMember({ user_id: "u-1", display_name: "Alice", available_work_days: 22 }),
        makeMember({ user_id: "u-2", display_name: "Bob", available_work_days: null }),
      ],
    );
    // Only Alice contributes: 50% × 22 = 11. Bob's missing data is silently dropped.
    expect(m.rows[0].rowEffortDays).toBeCloseTo(11, 5);
  });

  test("project with no cells has rowEffortDays null (not 0)", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-1", "Empty")],
      [],
      [makeMember({ user_id: "u-1", available_work_days: 22 })],
    );
    expect(m.rows[0].rowEffortDays).toBeNull();
  });

  test("userEffortDays omits users whose available_work_days is unknown", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-1", "P1")],
      [makeAssignment({ project: "p-1", user: "u-1", percentage: 50 })],
      [makeMember({ user_id: "u-1", available_work_days: null })],
    );
    expect(m.userEffortDays.has("u-1")).toBe(false);
  });
});

describe("compareActiveKippoProjects: phase + confidence", () => {
  test("anon-project phase comes before everything else", () => {
    const anon = makeProject("a", "Z-Anon", {
      phase: "anon-project",
      confidence: 0,
      target_date: "2099-12-31",
    } as Partial<KippoProject>);
    const live = makeProject("b", "A-Live", {
      phase: "project-development",
      confidence: 100,
      target_date: "2026-01-01",
    } as Partial<KippoProject>);
    expect(compareActiveKippoProjects(anon, live)).toBeLessThan(0);
    expect(compareActiveKippoProjects(live, anon)).toBeGreaterThan(0);
  });

  test("higher confidence sorts first", () => {
    const high = makeProject("a", "A", { confidence: 80 } as Partial<KippoProject>);
    const low = makeProject("b", "B", { confidence: 20 } as Partial<KippoProject>);
    expect(compareActiveKippoProjects(high, low)).toBeLessThan(0);
  });

  test("missing confidence sorts last", () => {
    const known = makeProject("a", "A", { confidence: 0 } as Partial<KippoProject>);
    const missing = makeProject("b", "B", { confidence: undefined } as Partial<KippoProject>);
    expect(compareActiveKippoProjects(known, missing)).toBeLessThan(0);
  });
});

describe("compareActiveKippoProjects: target_date + name tie-breaks", () => {
  test("earlier target_date sorts first when confidence ties", () => {
    const early = makeProject("a", "Z", {
      confidence: 50,
      target_date: "2026-01-01",
    } as Partial<KippoProject>);
    const late = makeProject("b", "A", {
      confidence: 50,
      target_date: "2026-12-31",
    } as Partial<KippoProject>);
    expect(compareActiveKippoProjects(early, late)).toBeLessThan(0);
  });

  test("missing target_date sorts last when confidence ties", () => {
    const known = makeProject("a", "Z", {
      confidence: 50,
      target_date: "2026-12-31",
    } as Partial<KippoProject>);
    const missing = makeProject("b", "A", {
      confidence: 50,
      target_date: null,
    } as Partial<KippoProject>);
    expect(compareActiveKippoProjects(known, missing)).toBeLessThan(0);
  });

  test("falls back to name when confidence + target_date tie", () => {
    const a = makeProject("1", "A", {
      confidence: 50,
      target_date: "2026-06-01",
    } as Partial<KippoProject>);
    const b = makeProject("2", "B", {
      confidence: 50,
      target_date: "2026-06-01",
    } as Partial<KippoProject>);
    expect(compareActiveKippoProjects(a, b)).toBeLessThan(0);
  });
});

describe("addMonths", () => {
  test("forward within the same year", () => {
    expect(addMonths("2026-05-01", 1)).toBe("2026-06-01");
    expect(addMonths("2026-05-01", 4)).toBe("2026-09-01");
  });

  test("rolls forward across year boundary", () => {
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-11-01", 3)).toBe("2027-02-01");
  });

  test("rolls backward within the same year", () => {
    expect(addMonths("2026-05-01", -1)).toBe("2026-04-01");
  });

  test("rolls backward across year boundary", () => {
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(addMonths("2026-02-01", -3)).toBe("2025-11-01");
  });

  test("zero delta is identity", () => {
    expect(addMonths("2026-05-01", 0)).toBe("2026-05-01");
  });
});

describe("firstOfMonth", () => {
  test("returns the first of the local-time month containing the date", () => {
    expect(firstOfMonth(new Date(2026, 4, 15))).toBe("2026-05-01"); // May 15
  });

  test("zero-pads single-digit months", () => {
    expect(firstOfMonth(new Date(2026, 0, 15))).toBe("2026-01-01"); // Jan 15
  });

  test("handles December correctly", () => {
    expect(firstOfMonth(new Date(2026, 11, 31))).toBe("2026-12-01");
  });
});
