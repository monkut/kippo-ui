import type {
  KippoProject,
  ProjectAssignmentPattern,
  ProjectMonthlyAssignment,
  ProjectMonthlyAssignmentRequest,
} from "~/lib/api/generated/models";

/** Flatten a suggested pattern into a list of ProjectMonthlyAssignmentRequest payloads.
 *
 * Each (member × month → percentage) becomes one row, posted as `is_confirmed=False`
 * (per kippo#224 C1: accepted patterns materialize as projections; PMs toggle to
 * confirmed manually).
 */
export function flattenPatternToAssignmentRequests(
  pattern: ProjectAssignmentPattern,
  projectId: string,
): ProjectMonthlyAssignmentRequest[] {
  const requests: ProjectMonthlyAssignmentRequest[] = [];
  for (const member of pattern.members) {
    for (const [month, percentage] of Object.entries(member.monthly_percentages)) {
      requests.push({
        project: projectId,
        user: member.user_id,
        month,
        percentage,
        is_confirmed: false,
      });
    }
  }
  return requests;
}

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

/** First-of-month ISO date for the local-time month containing `reference`. */
export function firstOfMonth(reference: Date): string {
  const year = reference.getFullYear();
  const month = (reference.getMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}-01`;
}

/** Add `delta` months to a first-of-month ISO date, wrapping years. */
export function addMonths(monthStart: string, delta: number): string {
  const [yearStr, monthStr] = monthStart.split("-");
  const totalMonths = Number(yearStr) * 12 + (Number(monthStr) - 1) + delta;
  const year = Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 1).toString().padStart(2, "0");
  return `${year}-${month}-01`;
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

// ─────────────────────────────────────────────────────────────────────────────
// Active Projects Monthly View — pivot helper
// ─────────────────────────────────────────────────────────────────────────────

export type MonthlyMatrixUser = {
  user_id: string;
  display_name: string;
};

export type MonthlyMatrixCell = {
  percentage: number;
  isConfirmed: boolean;
};

export type MonthlyMatrixRow = {
  project: KippoProject;
  cells: Map<string, MonthlyMatrixCell>; // user_id -> cell
  rowTotal: number; // sum across users for this project, this month
};

export type MonthlyMatrix = {
  users: MonthlyMatrixUser[]; // columns, sorted by display_name
  rows: MonthlyMatrixRow[]; // one row per project that has at least one assignment in `month`
  userTotals: Map<string, number>; // user_id -> sum across projects, this month (footer)
};

/** Pivot active projects + assignments for a single month into a (project × user → %) matrix.
 *
 * - `month` is a first-of-month ISO string ("YYYY-MM-01").
 * - `assignments` are pre-filtered to that month by the caller.
 * - Only projects that have at least one assignment in the month are included as rows.
 * - Users with multiple rows for the same (project, month) (data anomaly) are summed; the
 *   merged cell is `isConfirmed=true` only when every contributing row is confirmed.
 */
export function buildMonthlyMatrix(
  projects: KippoProject[],
  assignments: ProjectMonthlyAssignment[],
): MonthlyMatrix {
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  // Group assignments by project_id, then collapse per-user cells.
  const cellsByProject = new Map<string, Map<string, MonthlyMatrixCell>>();
  const userById = new Map<string, MonthlyMatrixUser>();
  const userTotals = new Map<string, number>();

  for (const assignment of assignments) {
    if (!projectsById.has(assignment.project)) continue; // not in the active-projects set
    let projectCells = cellsByProject.get(assignment.project);
    if (!projectCells) {
      projectCells = new Map();
      cellsByProject.set(assignment.project, projectCells);
    }
    const existing = projectCells.get(assignment.user);
    projectCells.set(assignment.user, {
      percentage: (existing?.percentage ?? 0) + assignment.percentage,
      isConfirmed: (existing?.isConfirmed ?? true) && (assignment.is_confirmed ?? false),
    });
    if (!userById.has(assignment.user)) {
      userById.set(assignment.user, {
        user_id: assignment.user,
        display_name: assignment.user_display_name?.trim() || assignment.user_username,
      });
    }
    userTotals.set(assignment.user, (userTotals.get(assignment.user) ?? 0) + assignment.percentage);
  }

  const users = Array.from(userById.values()).sort((a, b) => a.display_name.localeCompare(b.display_name));

  const rows: MonthlyMatrixRow[] = [];
  for (const [projectId, cells] of cellsByProject) {
    const project = projectsById.get(projectId);
    if (!project) continue;
    const rowTotal = Array.from(cells.values()).reduce((sum, c) => sum + c.percentage, 0);
    rows.push({ project, cells, rowTotal });
  }
  rows.sort((a, b) => a.project.name.localeCompare(b.project.name));

  return { users, rows, userTotals };
}
