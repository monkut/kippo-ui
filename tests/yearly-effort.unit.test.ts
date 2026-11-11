import { describe, expect, test } from "vitest";
import type { ProjectWeeklyEffort } from "~/lib/api/generated/models";
import { buildYearlyEffortMatrix, formatHours, yearDateRange } from "~/lib/yearly-effort";

const entry = (week_start: string, project: string, project_name: string, hours: number) =>
  ({ id: 0, week_start, project, project_name, hours }) as unknown as ProjectWeeklyEffort;

describe("buildYearlyEffortMatrix", () => {
  test("groups hours by project and week_start month, with month and grand totals", () => {
    const matrix = buildYearlyEffortMatrix([
      entry("2026-01-05", "a", "Alpha", 10),
      entry("2026-01-12", "a", "Alpha", 5.5),
      entry("2026-03-30", "a", "Alpha", 8), // week spans into April — counts toward March
      entry("2026-01-05", "b", "Beta", 30),
    ]);

    expect(matrix.rows.map((r) => r.projectId)).toEqual(["b", "a"]); // total desc
    const alpha = matrix.rows[1];
    expect(alpha.monthHours[0]).toBe(15.5);
    expect(alpha.monthHours[2]).toBe(8);
    expect(alpha.monthHours[3]).toBe(0);
    expect(alpha.total).toBe(23.5);
    expect(matrix.monthTotals[0]).toBe(45.5);
    expect(matrix.monthTotals[2]).toBe(8);
    expect(matrix.grandTotal).toBe(53.5);
    expect(matrix.maxCellHours).toBe(30);
  });

  test("ties on total sort by project name", () => {
    const matrix = buildYearlyEffortMatrix([
      entry("2026-02-02", "z", "Zeta", 4),
      entry("2026-02-02", "e", "Eta", 4),
    ]);
    expect(matrix.rows.map((r) => r.projectName)).toEqual(["Eta", "Zeta"]);
  });

  test("empty input yields zeroed totals", () => {
    const matrix = buildYearlyEffortMatrix([]);
    expect(matrix.rows).toEqual([]);
    expect(matrix.monthTotals).toEqual(new Array(12).fill(0));
    expect(matrix.grandTotal).toBe(0);
    expect(matrix.maxCellHours).toBe(0);
  });
});

describe("formatHours / yearDateRange", () => {
  test("formats zero as a dash and fractions to one decimal", () => {
    expect(formatHours(0)).toBe("—");
    expect(formatHours(40)).toBe("40");
    expect(formatHours(7.25)).toBe("7.3");
  });

  test("covers the full calendar year", () => {
    expect(yearDateRange(2026)).toEqual({ gte: "2026-01-01", lte: "2026-12-31" });
  });
});
