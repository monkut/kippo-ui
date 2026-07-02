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

/** Drop assignments whose project isn't in `visibleProjects` — matches the
 * matrix's own visibility filter (`buildMonthlyMatrix` silently skips rows for
 * unknown projects). Used at the route to keep the page-level confirm/unconfirm
 * action (kippo#23) scoped to projects the user can actually see in the table,
 * since `useMonthlyAssignments` returns every assignment for the month
 * regardless of whether the project falls inside `isProjectInMonthWindow`.
 */
export function filterAssignmentsToVisibleProjects(
  assignments: ProjectMonthlyAssignment[],
  visibleProjects: Pick<KippoProject, "id">[],
): ProjectMonthlyAssignment[] {
  const visibleIds = new Set(visibleProjects.map((p) => p.id));
  return assignments.filter((a) => visibleIds.has(a.project));
}

/** Count assignments split by `is_confirmed` for the page-level confirm/unconfirm
 * action (kippo#23). Callers pre-filter `assignments` to the displayed month —
 * `useMonthlyAssignments` already returns only rows for the current month, and
 * excluded usernames are stripped at the same layer. */
export function countAssignmentsByConfirmation(assignments: ProjectMonthlyAssignment[]): {
  confirmed: number;
  unconfirmed: number;
} {
  let confirmed = 0;
  let unconfirmed = 0;
  for (const assignment of assignments) {
    if (assignment.is_confirmed) {
      confirmed += 1;
    } else {
      unconfirmed += 1;
    }
  }
  return { confirmed, unconfirmed };
}

export type ProjectConfirmation = { ids: number[]; confirmed: number; total: number };

/** Per-project confirmation state for the displayed month, keyed by project id.
 * `ids` are every assignment row for the project (all users), so the 確定 column
 * can flip the whole project at once. */
export function buildProjectConfirmation(
  assignments: ProjectMonthlyAssignment[],
): Map<string, ProjectConfirmation> {
  const map = new Map<string, ProjectConfirmation>();
  for (const a of assignments) {
    let entry = map.get(a.project);
    if (!entry) {
      entry = { ids: [], confirmed: 0, total: 0 };
      map.set(a.project, entry);
    }
    entry.ids.push(a.id);
    entry.total += 1;
    if (a.is_confirmed) entry.confirmed += 1;
  }
  return map;
}

/** A project row is fully confirmed (locked) once it has ≥1 assignment and every
 * one is confirmed. An empty project (no assignments) is never "confirmed", so it
 * stays editable. */
export function isProjectRowConfirmed(c: ProjectConfirmation | undefined): boolean {
  return c !== undefined && c.total > 0 && c.confirmed === c.total;
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

/** Compose the multi-line tooltip shown on the 月合計 (人日) row cell when the
 * project has effort spent data — gives the reader the three numbers behind
 * the headline display in one place:
 *
 *   Monthly Staff Days: 1.1
 *   Total Project Staff Days: 14
 *   Spent Project Staff Days: 10
 *
 * Returns null when no effort spent data is available (caller falls back to
 * the legacy `% 合計: NN%` tooltip).
 */
export function formatRowMonthlyTotalTooltip(
  rowEffortDays: number,
  allocatedStaffDays: number | null | undefined,
  effortSpentDays: number | null | undefined,
): string | null {
  if (typeof allocatedStaffDays !== "number" || allocatedStaffDays <= 0) return null;
  if (typeof effortSpentDays !== "number") return null;
  return [
    `Monthly Staff Days: ${formatPersonDays(rowEffortDays)}`,
    `Total Project Staff Days: ${allocatedStaffDays}`,
    `Spent Project Staff Days: ${formatPersonDays(effortSpentDays)}`,
  ].join("\n");
}

/** Convert `projectstatus_display.current_effort_hours` to person-days, using the
 * project's own `allocated_effort_hours / allocated_staff_days` ratio as the
 * day_workhours conversion. Returns null when any of the three inputs is missing
 * or zero (caller falls back to the "no spent data" cell format).
 */
export function getProjectEffortSpentDays(project: KippoProject): number | null {
  const stats = project.projectstatus_display;
  const allocatedDays = project.allocated_staff_days;
  const allocatedHours = project.allocated_effort_hours;
  if (!stats || typeof stats.current_effort_hours !== "number") return null;
  if (typeof allocatedHours !== "number" || allocatedHours <= 0) return null;
  if (typeof allocatedDays !== "number" || allocatedDays <= 0) return null;
  return (stats.current_effort_hours * allocatedDays) / allocatedHours;
}

/** Render the 月合計 (人日) cell text for one project row.
 *
 * - When `allocated_staff_days > 0` and `effortSpentDays > 0` and there are
 *   remaining days: "<monthly>/(<allocated> - <spent>) <pct>%"
 *     e.g. "1.1/(14 - 10) 28%"      ← pct is over REMAINING budget
 * - When `allocated_staff_days > 0` (no spent data or 0 spent, or no remaining):
 *     "<monthly>/<allocated> <pct>%" (e.g. "64.3/100 64%")
 * - Otherwise: "<monthly>人日"        (e.g. "64.3人日")
 *
 * Callers should render "—" themselves when `rowEffortDays` is null (no
 * contributing cells with known availability) — this helper assumes a number.
 */
export function formatRowMonthlyTotal(
  rowEffortDays: number,
  allocatedStaffDays: number | null | undefined,
  effortSpentDays?: number | null,
): string {
  if (typeof allocatedStaffDays === "number" && allocatedStaffDays > 0) {
    if (typeof effortSpentDays === "number" && effortSpentDays > 0) {
      const remaining = allocatedStaffDays - effortSpentDays;
      if (remaining > 0) {
        const pct = Math.round((rowEffortDays / remaining) * 100);
        return `${formatPersonDays(rowEffortDays)}/(${allocatedStaffDays} - ${formatPersonDays(effortSpentDays)}) ${pct}%`;
      }
    }
    const pct = Math.round((rowEffortDays / allocatedStaffDays) * 100);
    return `${formatPersonDays(rowEffortDays)}/${allocatedStaffDays} ${pct}%`;
  }
  return `${formatPersonDays(rowEffortDays)}人日`;
}

/** Compose the multi-line tooltip shown on each project × member percentage cell.
 *
 * Falls back to "<memberName>\n<baseTitle>" when the member's monthly availability
 * isn't known (e.g. backend is pre-deploy on the `?month=` field). Format is
 * intentionally pure-ASCII for the staff-days lines to keep tooltip rendering
 * predictable across browsers/locales:
 *
 *   <memberName>
 *   <baseTitle>
 *   Monthly Total Staff Days: <available>
 *   Monthly Project Assignment %: <percentage>%
 *   Monthly Project Staff Days: (<available> x <percentage>%) <staffDays>
 */
export function buildCellTooltip(
  memberName: string,
  baseTitle: string,
  percentage: number,
  availableWorkDays: number | null | undefined,
): string {
  const head = [memberName, baseTitle];
  if (typeof availableWorkDays !== "number") return head.join("\n");
  const staffDays = (percentage / 100) * availableWorkDays;
  return [
    ...head,
    `Monthly Total Staff Days: ${availableWorkDays}`,
    `Monthly Project Assignment %: ${percentage}%`,
    `Monthly Project Staff Days: (${availableWorkDays} x ${percentage}%) ${formatPersonDays(staffDays)}`,
  ].join("\n");
}
