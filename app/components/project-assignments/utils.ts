import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";

export type CellState = {
  percentage: number;
  isConfirmed: boolean;
};

export type GridRow = {
  userKey: string;
  displayName: string;
  cells: Map<string, CellState>;
};

export type Grid = {
  months: string[];
  byUser: GridRow[];
  monthTotals: Map<string, number>;
};

/** Pivot a flat assignment list into a (user × month → percentage) grid. */
export function buildGrid(assignments: ProjectMonthlyAssignment[]): Grid {
  const monthsSet = new Set<string>();
  const userGrid = new Map<string, GridRow>();
  const monthTotals = new Map<string, number>();

  for (const assignment of assignments) {
    if (!assignment.month) continue;
    monthsSet.add(assignment.month);

    const userKey = assignment.user;
    const displayName = assignment.user_display_name?.trim() || assignment.user_username;
    const row = userGrid.get(userKey) ?? {
      userKey,
      displayName,
      cells: new Map<string, CellState>(),
    };
    const existing = row.cells.get(assignment.month);
    // If a user has multiple rows for the same month on this project (data anomaly),
    // sum the percentages and treat the cell as confirmed only if every contributing
    // row is confirmed.
    row.cells.set(assignment.month, {
      percentage: (existing?.percentage ?? 0) + assignment.percentage,
      isConfirmed: (existing?.isConfirmed ?? true) && (assignment.is_confirmed ?? false),
    });
    userGrid.set(userKey, row);

    monthTotals.set(assignment.month, (monthTotals.get(assignment.month) ?? 0) + assignment.percentage);
  }

  return {
    months: Array.from(monthsSet).sort(),
    byUser: Array.from(userGrid.values()).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    monthTotals,
  };
}

/** "2026-04-01" → "2026-04". */
export function formatMonth(month: string): string {
  return month.slice(0, 7);
}
