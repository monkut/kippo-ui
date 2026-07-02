import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { monthlyAssignmentsList } from "~/lib/api/generated/monthly-assignments/monthly-assignments";
import { projectsWeeklyeffortList } from "~/lib/api/generated/projects/projects";
import type { ProjectMonthlyAssignment, ProjectWeeklyEffort } from "~/lib/api/generated/models";
import { readList } from "~/lib/api/read-list";
import { getMonthStart, monthDateRange } from "~/components/weekly-effort/utils";

export type UseMonthlyEffortReturn = {
  monthlyAssignments: ProjectMonthlyAssignment[];
  /** Target month (YYYY-MM-DD, first day) the assignments / cumulative effort reflect. */
  targetMonth: string;
  /** Cumulative saved effort hours for the target month, keyed by project id. */
  monthHoursByProject: Record<string, number>;
  /** Distinct projects the user logged any effort on in the target month (id + name). */
  monthEffortProjects: { project: string; project_name: string }[];
  /** Force a refetch of assignments + cumulative effort for the given week's month
   * (used after an effort entry is created / updated / deleted). */
  refresh: (weekStartDate: string) => Promise<void>;
};

/**
 * Monthly assignments + cumulative weekly effort for the TARGET month (the month of
 * the selected week), so both the "今月の割当" panel and the input auto-calc follow the
 * week being entered rather than the wall-clock month.
 */
export function useMonthlyEffort(
  weekStart: string,
  username: string | undefined,
  enabled: boolean,
): UseMonthlyEffortReturn {
  const [monthlyAssignments, setMonthlyAssignments] = useState<ProjectMonthlyAssignment[]>([]);
  const [monthUserEntries, setMonthUserEntries] = useState<ProjectWeeklyEffort[]>([]);

  // Month (YYYY-MM) whose monthly data was last applied, and a monotonic request id.
  // The ref keeps same-month week navigation a no-op; the seq counter ensures a slow
  // earlier-month response cannot overwrite a newer one (last request wins).
  const lastFetchedAssignmentMonthRef = useRef<string | null>(null);
  const monthlyRequestSeqRef = useRef(0);

  const fetchMonthlyData = useCallback(async (weekStartDate: string, user?: string) => {
    const requestId = ++monthlyRequestSeqRef.current;
    const monthStart = getMonthStart(weekStartDate);
    const { dayGte, dayLte } = monthDateRange(weekStartDate);
    try {
      const [assignmentsRes, monthEffortRes] = await Promise.all([
        monthlyAssignmentsList({ month: monthStart }),
        projectsWeeklyeffortList({
          user_username: user,
          week_start_gte: dayGte,
          week_start_lte: dayLte,
        }),
      ]);
      // A newer request superseded this one (e.g. fast month navigation) — drop the
      // stale result so it cannot clobber the current month's data.
      if (requestId !== monthlyRequestSeqRef.current) return;
      const userAssignments = readList<ProjectMonthlyAssignment>(assignmentsRes.data)
        .filter((a) => a.user_username === user)
        .sort((a, b) => b.percentage - a.percentage);
      setMonthlyAssignments(userAssignments);
      setMonthUserEntries(readList<ProjectWeeklyEffort>(monthEffortRes.data));
      lastFetchedAssignmentMonthRef.current = weekStartDate.substring(0, 7);
    } catch {
      // Keep previously loaded monthly data on failure
    }
  }, []);

  // Fetch on mount and only when the selected week crosses into a new month.
  useEffect(() => {
    if (!enabled || !weekStart) return;
    if (lastFetchedAssignmentMonthRef.current === weekStart.substring(0, 7)) return;
    fetchMonthlyData(weekStart, username);
  }, [enabled, weekStart, username, fetchMonthlyData]);

  const refresh = useCallback(
    (weekStartDate: string) => fetchMonthlyData(weekStartDate, username),
    [fetchMonthlyData, username],
  );

  const targetMonth = useMemo(() => getMonthStart(weekStart), [weekStart]);

  const monthHoursByProject = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const entry of monthUserEntries) {
      totals[entry.project] = (totals[entry.project] || 0) + entry.hours;
    }
    return totals;
  }, [monthUserEntries]);

  const monthEffortProjects = useMemo(() => {
    const names = new Map<string, string>();
    for (const entry of monthUserEntries) {
      if (!names.has(entry.project)) names.set(entry.project, entry.project_name);
    }
    return Array.from(names, ([project, project_name]) => ({ project, project_name }));
  }, [monthUserEntries]);

  return {
    monthlyAssignments,
    targetMonth,
    monthHoursByProject,
    monthEffortProjects,
    refresh,
  };
}
