import { describe, expect, test } from "vitest";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { buildMyAssignmentsMatrix, monthRange } from "~/lib/my-assignments";

const row = (project: string, project_name: string, month: string, percentage: number) =>
  ({ project, project_name, month, percentage }) as unknown as ProjectMonthlyAssignment;

describe("buildMyAssignmentsMatrix (kiconiaworks/kippo#74)", () => {
  test("monthRange crosses the year boundary", () => {
    expect(monthRange("2026-11-01", 3)).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
  });

  test("rows per month, columns ordered by summed percentage, monthly totals", () => {
    const months = monthRange("2026-11-01", 3);
    const matrix = buildMyAssignmentsMatrix(
      [
        row("a", "Alpha", "2026-11-01", 40),
        row("b", "Beta", "2026-11-01", 70),
        row("b", "Beta", "2026-12-01", 50),
        row("a", "Alpha", "2027-05-01", 99), // outside the window → ignored
      ],
      months,
    );
    expect(matrix.columns.map((c) => [c.projectName, c.total])).toEqual([
      ["Beta", 120],
      ["Alpha", 40],
    ]);
    expect(matrix.rows.map((r) => r.total)).toEqual([110, 50, 0]);
    expect(matrix.rows[1].percentByProject.get("b")).toBe(50);
    expect(matrix.rows[1].percentByProject.has("a")).toBe(false);
  });
});
