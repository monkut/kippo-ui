import type {
  KippoProject,
  OrganizationMember,
  OrganizationMemberDetail,
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

/** Usernames of system / placeholder accounts hidden from project-assignment UIs. */
export const EXCLUDED_USERNAMES: ReadonlySet<string> = new Set([
  "(unassigned)",
  "admin",
  "kiconia-api",
  "luca.pacioli",
]);

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

export function assignmentDisplayName(assignment: ProjectMonthlyAssignment): string {
  return assignment.user_display_name?.trim() || assignment.user_username;
}

export function memberDisplayName(member: OrganizationMember | OrganizationMemberDetail): string {
  return member.display_name?.trim() || member.username;
}

/** Convert a workload percentage into the equivalent person-days for the given month.
 *
 * Returns null when the member's `available_work_days` is missing — happens when the
 * caller didn't pass `?month=` to the members endpoint (or backend is pre-deploy).
 */
export function percentageToPersonDays(
  percentage: number,
  availableWorkDays: number | null | undefined,
): number | null {
  if (typeof availableWorkDays !== "number") return null;
  return (percentage / 100) * availableWorkDays;
}

/** Format a person-day count with at most one decimal place, trimming trailing ".0". */
export function formatPersonDays(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

/** Compose the multi-line tooltip shown on each project × member percentage cell.
 *
 * Falls back to just `baseTitle` when the member's monthly availability isn't known
 * (e.g. backend is pre-deploy on the `?month=` field). Format is intentionally
 * pure-ASCII to keep tooltip rendering predictable across browsers/locales:
 *
 *   <baseTitle>
 *   Monthly Total Staff Days: <available>
 *   Monthly Project Assignment %: <percentage>%
 *   Monthly Project Staff Days: (<available> x <percentage>%) <staffDays>
 */
export function buildCellTooltip(
  baseTitle: string,
  percentage: number,
  availableWorkDays: number | null | undefined,
): string {
  if (typeof availableWorkDays !== "number") return baseTitle;
  const staffDays = (percentage / 100) * availableWorkDays;
  return [
    baseTitle,
    `Monthly Total Staff Days: ${availableWorkDays}`,
    `Monthly Project Assignment %: ${percentage}%`,
    `Monthly Project Staff Days: (${availableWorkDays} x ${percentage}%) ${formatPersonDays(staffDays)}`,
  ].join("\n");
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
  /** Workdays this user is available in the displayed month — drives person-day totals.
   * Null when the members endpoint was called without `?month=`. */
  available_work_days?: number | null;
};

export type MonthlyMatrixRow = {
  project: KippoProject;
  cells: Map<string, CellState>; // user_id → cell
  rowTotal: number; // Σ percentages across users (legacy; kept for callers that still need it)
  /** Σ (cell.percentage / 100 × user.available_work_days) — month-scaled effort in person-days.
   * Null when no contributing cell has a known available_work_days. */
  rowEffortDays: number | null;
};

export type MonthlyMatrix = {
  users: MonthlyMatrixUser[]; // columns, sorted by display_name
  rows: MonthlyMatrixRow[]; // one row per project, sorted by project.name
  userTotals: Map<string, number>; // user_id → Σ percentages across projects (footer)
  userEffortDays: Map<string, number>; // user_id → Σ person-days across projects (footer)
};

export type MonthlyAssignmentMatrixProps = {
  projects: KippoProject[];
  assignments: ProjectMonthlyAssignment[];
  /** Org-scoped members carrying `available_work_days` for the displayed month
   * (populated by passing `?month=` when fetching from the organizations endpoint). */
  members?: OrganizationMemberDetail[];
};

/** User-selectable sort keys for the monthly assignment matrix column headers. */
export type SortKey = "id" | "name" | "start_date" | "target_date" | "rowEffortDays";

export type SortConfig = { key: SortKey; dir: "asc" | "desc" };

function sortValueFor(row: MonthlyMatrixRow, key: SortKey): string | number | null {
  if (key === "rowEffortDays") return row.rowEffortDays;
  return row.project[key] ?? null;
}

/** Apply a user-selected sort on top of whatever order `buildMonthlyMatrix` produced.
 *
 * Returns the input unchanged when `config` is null (default sort —
 * `compareActiveKippoProjects` — already applied by `buildMonthlyMatrix`).
 * Nulls always sort last, regardless of direction.
 */
export function sortMatrixRows(
  rows: MonthlyMatrixRow[],
  config: SortConfig | null,
): MonthlyMatrixRow[] {
  if (!config) return rows;
  const sign = config.dir === "asc" ? 1 : -1;
  const sorted = [...rows];
  sorted.sort((a, b) => {
    const av = sortValueFor(a, config.key);
    const bv = sortValueFor(b, config.key);
    if (av === null && bv === null) return 0;
    if (av === null) return 1; // null always last
    if (bv === null) return -1;
    const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
    return sign * cmp;
  });
  return sorted;
}

/** Sort comparator matching ActiveKippoProjectAdmin (kippo/projects/admin.py:1117):
 *
 * 1. anon-project phase first (admin shows non-project entries first)
 * 2. confidence descending (nulls/undefined last)
 * 3. target_date ascending (nulls/undefined last)
 * 4. name ascending
 */
export function compareActiveKippoProjects(a: KippoProject, b: KippoProject): number {
  const aAnon = a.phase === "anon-project" ? 0 : 1;
  const bAnon = b.phase === "anon-project" ? 0 : 1;
  if (aAnon !== bAnon) return aAnon - bAnon;

  const aConfidence = a.confidence ?? -Infinity;
  const bConfidence = b.confidence ?? -Infinity;
  if (aConfidence !== bConfidence) return bConfidence - aConfidence;

  const aTarget = a.target_date ?? "9999-99-99";
  const bTarget = b.target_date ?? "9999-99-99";
  if (aTarget !== bTarget) return aTarget.localeCompare(bTarget);

  return a.name.localeCompare(b.name);
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
 *
 * When members carry `available_work_days` (populated by passing `?month=` to the
 * org members endpoint), per-row and per-user totals are also computed in person-days —
 * a unit-correct alternative to summing raw percentages across users with different
 * monthly capacities. Rows/columns without `available_work_days` get null totals.
 */
export function buildMonthlyMatrix(
  projects: KippoProject[],
  assignments: ProjectMonthlyAssignment[],
  members?: OrganizationMemberDetail[],
): MonthlyMatrix {
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const cellsByProject = new Map<string, Map<string, CellState>>();
  const rowTotalsByProject = new Map<string, number>();
  const userById = new Map<string, MonthlyMatrixUser>(
    (members ?? []).map((m) => [
      m.user_id,
      {
        user_id: m.user_id,
        display_name: memberDisplayName(m),
        available_work_days: m.available_work_days,
      },
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

  const userEffortDays = computeUserEffortDays(users, userTotals);
  const rows = buildMatrixRows(projects, cellsByProject, rowTotalsByProject, userById);
  return { users, rows, userTotals, userEffortDays };
}

/** Σ_projects (cell.percentage / 100 × user.available_work_days) — keyed by user_id. */
function computeUserEffortDays(
  users: MonthlyMatrixUser[],
  userTotals: Map<string, number>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const user of users) {
    if (typeof user.available_work_days !== "number") continue;
    const totalPct = userTotals.get(user.user_id) ?? 0;
    out.set(user.user_id, (totalPct / 100) * user.available_work_days);
  }
  return out;
}

function buildMatrixRows(
  projects: KippoProject[],
  cellsByProject: Map<string, Map<string, CellState>>,
  rowTotalsByProject: Map<string, number>,
  userById: Map<string, MonthlyMatrixUser>,
): MonthlyMatrixRow[] {
  return projects
    .map((project) => {
      const cells = cellsByProject.get(project.id) ?? new Map<string, CellState>();
      let rowEffortDays: number | null = null;
      for (const [userId, cell] of cells) {
        const days = percentageToPersonDays(
          cell.percentage,
          userById.get(userId)?.available_work_days,
        );
        if (typeof days !== "number") continue;
        rowEffortDays = (rowEffortDays ?? 0) + days;
      }
      return {
        project,
        cells,
        rowTotal: rowTotalsByProject.get(project.id) ?? 0,
        rowEffortDays,
      };
    })
    .sort((a, b) => compareActiveKippoProjects(a.project, b.project));
}
