import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { addMonths } from "~/lib/dates";

/** Months shown at once on 自分の割当 (kiconiaworks/kippo#74). */
export const MY_ASSIGNMENTS_WINDOW_MONTHS = 12;
/** The default window starts this many months before the current month. */
export const MY_ASSIGNMENTS_MONTHS_BEFORE = 5;

export type MyAssignmentsColumn = { projectId: string; projectName: string; total: number };
export type MyAssignmentsRow = {
  month: string;
  percentByProject: ReadonlyMap<string, number>;
  total: number;
};
export type MyAssignmentsMatrix = { columns: MyAssignmentsColumn[]; rows: MyAssignmentsRow[] };

/** First-of-month ISO dates from `startMonth`, `count` months long. */
export function monthRange(startMonth: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(startMonth, i));
}

/** Rows = months, columns = projects (largest summed percentage first), cells = percentage. */
export function buildMyAssignmentsMatrix(
  assignments: ProjectMonthlyAssignment[],
  months: string[],
): MyAssignmentsMatrix {
  const columnsById = new Map<string, MyAssignmentsColumn>();
  const cellsByMonth = new Map<string, Map<string, number>>(months.map((m) => [m, new Map()]));
  for (const a of assignments) {
    const cells = a.month ? cellsByMonth.get(a.month) : undefined;
    if (!cells) continue;
    cells.set(a.project, (cells.get(a.project) ?? 0) + a.percentage);
    const column = columnsById.get(a.project) ?? {
      projectId: a.project,
      projectName: a.project_name,
      total: 0,
    };
    columnsById.set(a.project, { ...column, total: column.total + a.percentage });
  }
  const columns = Array.from(columnsById.values()).sort(
    (a, b) => b.total - a.total || a.projectName.localeCompare(b.projectName),
  );
  const rows = months.map((month) => {
    const percentByProject = cellsByMonth.get(month) ?? new Map<string, number>();
    const total = Array.from(percentByProject.values()).reduce((sum, p) => sum + p, 0);
    return { month, percentByProject, total };
  });
  return { columns, rows };
}
