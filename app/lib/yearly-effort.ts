import type { ProjectWeeklyEffort } from "~/lib/api/generated/models";

export const MONTHS_PER_YEAR = 12;

export type YearlyEffortRow = {
  projectId: string;
  projectName: string;
  /** Hours per month, index 0 = January. */
  monthHours: number[];
  total: number;
};

export type YearlyEffortMatrix = {
  rows: YearlyEffortRow[];
  /** Hours across all projects per month, index 0 = January. */
  monthTotals: number[];
  grandTotal: number;
  /** Largest single project-month cell, used to scale the cell tint. */
  maxCellHours: number;
};

/** week_start bounds (inclusive) covering `year`. */
export function yearDateRange(year: number): { gte: string; lte: string } {
  return { gte: `${year}-01-01`, lte: `${year}-12-31` };
}

/**
 * Group a year's weekly-effort entries into project × month hours.
 *
 * An entry counts toward the month of its week_start (Monday) — the same rule the
 * weekly-effort page uses for its monthly cumulative totals. Rows sort by yearly
 * total descending, then project name.
 */
export function buildYearlyEffortMatrix(entries: ProjectWeeklyEffort[]): YearlyEffortMatrix {
  const byProject = new Map<string, YearlyEffortRow>();
  for (const entry of entries) {
    if (!entry.week_start) continue;
    const monthIndex = Number(entry.week_start.substring(5, 7)) - 1;
    const row = byProject.get(entry.project) ?? {
      projectId: entry.project,
      projectName: entry.project_name,
      monthHours: new Array<number>(MONTHS_PER_YEAR).fill(0),
      total: 0,
    };
    row.monthHours[monthIndex] += entry.hours;
    row.total += entry.hours;
    byProject.set(entry.project, row);
  }

  const rows = Array.from(byProject.values()).sort(
    (a, b) => b.total - a.total || a.projectName.localeCompare(b.projectName, "ja"),
  );
  const monthTotals = Array.from({ length: MONTHS_PER_YEAR }, (_, m) =>
    rows.reduce((sum, row) => sum + row.monthHours[m], 0),
  );
  return {
    rows,
    monthTotals,
    grandTotal: monthTotals.reduce((sum, h) => sum + h, 0),
    maxCellHours: Math.max(0, ...rows.flatMap((row) => row.monthHours)),
  };
}

/** Hours for display: integers as-is, fractions to one decimal, zero as "—". */
export function formatHours(hours: number): string {
  if (hours === 0) return "—";
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}
