import { describe, expect, test } from "vitest";
import { addMonths, buildMonthlyMatrix, firstOfMonth } from "~/components/project-assignments/utils";
import type { KippoProject, ProjectMonthlyAssignment } from "~/lib/api/generated/models";

function makeProject(id: string, name: string, overrides: Partial<KippoProject> = {}): KippoProject {
  // Cast through unknown — KippoProject has many required fields the matrix doesn't read.
  return {
    id,
    name,
    start_date: "2026-01-01",
    target_date: "2026-12-31",
    ...overrides,
  } as unknown as KippoProject;
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

describe("buildMonthlyMatrix: empty + single", () => {
  test("returns empty matrix for empty inputs", () => {
    const m = buildMonthlyMatrix([], []);
    expect(m.users).toEqual([]);
    expect(m.rows).toEqual([]);
    expect(m.userTotals.size).toBe(0);
  });

  test("excludes projects with no assignments in the month", () => {
    const m = buildMonthlyMatrix([makeProject("p-1", "P1"), makeProject("p-2", "P2")], [
      makeAssignment({ project: "p-1", user: "u-1", percentage: 50 }),
    ]);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].project.id).toBe("p-1");
  });

  test("excludes assignments whose project isn't in the active set", () => {
    const m = buildMonthlyMatrix(
      [makeProject("p-1", "P1")],
      [makeAssignment({ project: "p-other", user: "u-1", percentage: 25 })],
    );
    expect(m.rows).toEqual([]);
    expect(m.users).toEqual([]);
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
      [makeAssignment({ project: "p-1", user: "u-1", user_username: "alice", user_display_name: "" })],
    );
    expect(m.users[0].display_name).toBe("alice");
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
