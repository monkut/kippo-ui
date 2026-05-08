import type {
  KippoProject,
  OrganizationMember,
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

export const MAX_PERCENTAGE_PER_MONTH = 100;

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

/** Merge a duplicate (user, month/project) row: sum %, downgrade isConfirmed if any contributor is unconfirmed. */
function mergeAssignmentCell(
  existing: CellState | undefined,
  assignment: ProjectMonthlyAssignment,
): CellState {
  return {
    percentage: (existing?.percentage ?? 0) + assignment.percentage,
    isConfirmed: (existing?.isConfirmed ?? true) && (assignment.is_confirmed ?? false),
  };
}

function assignmentDisplayName(assignment: ProjectMonthlyAssignment): string {
  return assignment.user_display_name?.trim() || assignment.user_username;
}

/** Pivot a flat assignment list into a (user × month → percentage) grid. */
export function buildGrid(assignments: ProjectMonthlyAssignment[]): Grid {
  const monthsSet = new Set<string>();
  const userGrid = new Map<string, GridRow>();
  const monthTotals = new Map<string, number>();

  for (const assignment of assignments) {
    if (!assignment.month) continue;
    monthsSet.add(assignment.month);

    const userKey = assignment.user;
    const row = userGrid.get(userKey) ?? {
      userKey,
      displayName: assignmentDisplayName(assignment),
      cells: new Map<string, CellState>(),
    };
    row.cells.set(
      assignment.month,
      mergeAssignmentCell(row.cells.get(assignment.month), assignment),
    );
    userGrid.set(userKey, row);

    monthTotals.set(
      assignment.month,
      (monthTotals.get(assignment.month) ?? 0) + assignment.percentage,
    );
  }

  return {
    months: Array.from(monthsSet).sort(),
    byUser: Array.from(userGrid.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    ),
    monthTotals,
  };
}

/** "2026-04-01" → "2026-04". */
export function formatMonth(month: string): string {
  return month.slice(0, 7);
}

export function firstOfMonth(reference: Date): string {
  const year = reference.getFullYear();
  const month = (reference.getMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}-01`;
}

export function addMonths(monthStart: string, delta: number): string {
  const [yearStr, monthStr] = monthStart.split("-");
  const totalMonths = Number(yearStr) * 12 + (Number(monthStr) - 1) + delta;
  const year = Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 1).toString().padStart(2, "0");
  return `${year}-${month}-01`;
}

export function firstOfNextMonth(reference: Date): string {
  return addMonths(firstOfMonth(reference), 1);
}

export type MonthlyMatrixUser = {
  user_id: string;
  display_name: string;
};

export type MonthlyMatrixRow = {
  project: KippoProject;
  cells: Map<string, CellState>; // user_id → cell
  rowTotal: number;
};

export type MonthlyMatrix = {
  users: MonthlyMatrixUser[]; // columns, sorted by display_name
  rows: MonthlyMatrixRow[]; // one row per project, sorted by project.name
  userTotals: Map<string, number>; // user_id → sum across projects (footer)
};

export type MonthlyAssignmentMatrixProps = {
  projects: KippoProject[];
  assignments: ProjectMonthlyAssignment[];
  members?: OrganizationMember[];
};

function memberDisplayName(member: OrganizationMember): string {
  return member.display_name?.trim() || member.username;
}

function applyAssignmentToProject(
  assignment: ProjectMonthlyAssignment,
  projectCells: Map<string, CellState>,
  rowTotalsByProject: Map<string, number>,
): void {
  const previous = projectCells.get(assignment.user);
  const merged = mergeAssignmentCell(previous, assignment);
  projectCells.set(assignment.user, merged);
  rowTotalsByProject.set(
    assignment.project,
    (rowTotalsByProject.get(assignment.project) ?? 0) +
      (merged.percentage - (previous?.percentage ?? 0)),
  );
}

/** Pivot active projects + assignments for a single month into a (project × user → %) matrix.
 *
 * Assignments must be pre-filtered to the month by the caller. ALL projects in `projects`
 * are emitted as rows (sorted by project.name) — projects without assignments render with
 * empty cells. Assignments referencing a project not in `projects` are dropped. Duplicate
 * (project, user) rows are summed via mergeAssignmentCell.
 *
 * Columns come from `members` when provided (every org member shown, sorted by display_name).
 * Without members, columns fall back to the union of users found in `assignments`.
 */
export function buildMonthlyMatrix(
  projects: KippoProject[],
  assignments: ProjectMonthlyAssignment[],
  members?: OrganizationMember[],
): MonthlyMatrix {
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const cellsByProject = new Map<string, Map<string, CellState>>();
  const rowTotalsByProject = new Map<string, number>();
  const userById = new Map<string, MonthlyMatrixUser>(
    (members ?? []).map((m) => [
      m.user_id,
      { user_id: m.user_id, display_name: memberDisplayName(m) },
    ]),
  );
  const userTotals = new Map<string, number>();

  for (const assignment of assignments) {
    if (!projectsById.has(assignment.project)) continue;
    let projectCells = cellsByProject.get(assignment.project);
    if (!projectCells) {
      projectCells = new Map();
      cellsByProject.set(assignment.project, projectCells);
    }
    applyAssignmentToProject(assignment, projectCells, rowTotalsByProject);
    if (!userById.has(assignment.user)) {
      userById.set(assignment.user, {
        user_id: assignment.user,
        display_name: assignmentDisplayName(assignment),
      });
    }
    userTotals.set(assignment.user, (userTotals.get(assignment.user) ?? 0) + assignment.percentage);
  }

  const users = Array.from(userById.values()).sort((a, b) =>
    a.display_name.localeCompare(b.display_name),
  );
  const rows: MonthlyMatrixRow[] = projects
    .map((project) => ({
      project,
      cells: cellsByProject.get(project.id) ?? new Map<string, CellState>(),
      rowTotal: rowTotalsByProject.get(project.id) ?? 0,
    }))
    .sort((a, b) => a.project.name.localeCompare(b.project.name));

  return { users, rows, userTotals };
}
