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

export type ProjectMember = {
  user_id: string;
  username: string;
  display_name: string;
};

/** Extract the unique set of project members from existing assignments, sorted by display name.
 *
 * Phase 3c (#57) doesn't have a kippo backend users-list endpoint, so the picker for "add
 * assignment" is sourced from users who already appear in this project's assignment rows.
 * Adding genuinely-new users to a project requires a backend follow-up to expose
 * `OrganizationMembership` users. */
export function extractProjectMembers(assignments: ProjectMonthlyAssignment[]): ProjectMember[] {
  const seen = new Map<string, ProjectMember>();
  for (const assignment of assignments) {
    if (seen.has(assignment.user)) continue;
    seen.set(assignment.user, {
      user_id: assignment.user,
      username: assignment.user_username,
      display_name: assignment.user_display_name?.trim() || assignment.user_username,
    });
  }
  return Array.from(seen.values()).sort((a, b) => a.display_name.localeCompare(b.display_name));
}

/** First-of-month ISO date for the month after `reference`. Wraps December → next year. */
export function firstOfNextMonth(reference: Date): string {
  const year = reference.getFullYear();
  const month = reference.getMonth() + 1; // JS months are 0-indexed
  if (month === 12) {
    return `${year + 1}-01-01`;
  }
  // month + 1 is already the next-month value (1-12), and we want it 0-padded.
  const nextMonth = (month + 1).toString().padStart(2, "0");
  return `${year}-${nextMonth}-01`;
}
