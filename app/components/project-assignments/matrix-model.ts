import { lastOfMonth } from "~/lib/dates";
import type {
  KippoProject,
  OrganizationMemberDetail,
  ProjectMonthlyAssignment,
} from "~/lib/api/generated/models";
import {
  assignmentDisplayName,
  memberDisplayName,
  percentageToPersonDays,
} from "./assignment-math";

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

/** True when a project's [start_date, target_date] window overlaps the month
 * containing `monthStart` (ISO date "YYYY-MM-01"):
 *
 *   start_date <= last_day_of(month) AND (target_date is null OR target_date >= first_day_of(month))
 *
 * Projects with null `target_date` are open-ended and always pass the upper
 * bound. Projects with null `start_date` are treated as not-yet-started and
 * excluded. ISO YYYY-MM-DD strings sort lexically, so no Date math needed.
 */
export function isProjectInMonthWindow(
  project: Pick<KippoProject, "start_date" | "target_date">,
  monthStart: string,
): boolean {
  if (!project.start_date) return false;
  const monthEnd = lastOfMonth(monthStart);
  if (project.start_date > monthEnd) return false;
  if (project.target_date && project.target_date < monthStart) return false;
  return true;
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
  /** When true, hides member columns whose summed userTotal across the displayed
   * month is 0 — useful for orgs where most members are unassigned in any given
   * month and the column rail eats screen space (#21 F5). Default: false. */
  hideUnassigned?: boolean;
  /** Whether the displayed month is editable (current month or later). When
   * false, cells render as read-only `<span>`s with a `過去月のためロック` tooltip,
   * matching the pre-#22 behavior. Default: false (read-only). */
  editableMonth?: boolean;
  /** Click handler installed on each cell when `editableMonth` is true.
   * Receives the (project, user, assignment | null) tuple needed to open
   * either `EditAssignmentModal` (assignment != null) or `AddAssignmentModal`
   * (assignment === null) at the matching (project, user, month) slot. */
  onCellClick?: (args: {
    project: KippoProject;
    user: MonthlyMatrixUser;
    assignment: ProjectMonthlyAssignment | null;
  }) => void;
  /** Flip every assignment of a project (for the displayed month) to `isConfirmed`.
   * Wired to the per-row 確定 column checkbox. When omitted, the column renders
   * disabled checkboxes (read-only confirmation state). */
  onBulkSetConfirmed?: (ids: number[], isConfirmed: boolean) => Promise<boolean>;
  /** Disables the 確定 checkboxes while a mutation is in flight. */
  isSaving?: boolean;
};

/** User-selectable sort keys for the monthly assignment matrix column headers. */
export type SortKey =
  | "id"
  | "customer_name"
  | "name"
  | "start_date"
  | "target_date"
  | "rowEffortDays";

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

/** Sort comparator matching ActiveKippoProjectAdmin:
 *
 * 1. non-project category first (admin shows non-project entries first; kippo#36 moved
 *    the anon check from phase=="anon-project" to category=="non-project")
 * 2. confidence descending (nulls/undefined last)
 * 3. target_date ascending (nulls/undefined last)
 * 4. name ascending
 */
export function compareActiveKippoProjects(a: KippoProject, b: KippoProject): number {
  const aAnon = a.category === "non-project" ? 0 : 1;
  const bAnon = b.category === "non-project" ? 0 : 1;
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

/** Display names of the members the "未割当メンバーを非表示" toggle hides — those whose
 * summed monthly total across the displayed projects is 0. Built from the same
 * `buildMonthlyMatrix` the matrix uses, so it stays in sync with the hidden columns. */
export function unassignedMemberNames(
  projects: KippoProject[],
  assignments: ProjectMonthlyAssignment[],
  members?: OrganizationMemberDetail[],
): string[] {
  const matrix = buildMonthlyMatrix(projects, assignments, members);
  return matrix.users
    .filter((u) => (matrix.userTotals.get(u.user_id) ?? 0) === 0)
    .map((u) => u.display_name);
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
