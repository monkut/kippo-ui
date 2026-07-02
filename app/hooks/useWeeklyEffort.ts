import { useCallback } from "react";
import type {
  KippoProject,
  PersonalHoliday,
  ProjectMonthlyAssignment,
  ProjectWeeklyEffort,
  PublicHoliday,
} from "~/lib/api/generated/models";
import type { FormEntry } from "~/components/weekly-effort/types";
import { useWeekEntries } from "~/hooks/useWeekEntries";
import { useMonthlyEffort } from "~/hooks/useMonthlyEffort";
import { useMonthHolidays } from "~/hooks/useMonthHolidays";

type AuthUser = {
  username: string;
};

export type UseWeeklyEffortReturn = {
  isLoading: boolean;
  isSubmitting: boolean;
  error: string;
  setError: (err: string) => void;
  projects: KippoProject[];
  recentUserEntries: ProjectWeeklyEffort[];
  selectedWeekEntries: ProjectWeeklyEffort[];
  monthlyAssignments: ProjectMonthlyAssignment[];
  /** Target month (YYYY-MM-DD, first day) the assignments / cumulative effort reflect. */
  targetMonth: string;
  /** Cumulative saved effort hours for the target month, keyed by project id. */
  monthHoursByProject: Record<string, number>;
  /** Distinct projects the user logged any effort on in the target month (id + name). */
  monthEffortProjects: { project: string; project_name: string }[];
  expectedHours: number | null;
  missingWeeks: string[];
  weekPersonalHolidays: PersonalHoliday[];
  weekPublicHolidays: PublicHoliday[];
  monthPersonalHolidays: PersonalHoliday[];
  monthPublicHolidays: PublicHoliday[];
  isLoadingMonthHolidays: boolean;
  templateEntries: FormEntry[];
  createEntries: (entries: FormEntry[], weekStart: string) => Promise<boolean>;
  updateEntryHours: (entryId: number, hours: number, weekStart: string) => Promise<boolean>;
  deleteEntry: (entryId: number, weekStart: string) => Promise<boolean>;
  refreshAfterHolidayChange: (weekStart: string) => Promise<void>;
};

/**
 * Weekly-effort page data, composed from three focused hooks:
 *  - {@link useMonthlyEffort} — target-month assignments + cumulative effort,
 *  - {@link useMonthHolidays} — month + week holidays,
 *  - {@link useWeekEntries}   — the selected week's entries, templates, and mutations.
 */
export function useWeeklyEffort(user: AuthUser | null, weekStart: string): UseWeeklyEffortReturn {
  const enabled = !!user;
  const monthly = useMonthlyEffort(weekStart, user?.username, enabled);
  const holidays = useMonthHolidays(weekStart, enabled);
  const week = useWeekEntries(user, weekStart, monthly.refresh);

  const refreshAfterHolidayChange = useCallback(
    async (currentWeekStart: string) => {
      await Promise.all([
        week.fetchExpectedHours(currentWeekStart),
        holidays.refresh(currentWeekStart),
      ]);
    },
    [week.fetchExpectedHours, holidays.refresh],
  );

  return {
    isLoading: week.isLoading,
    isSubmitting: week.isSubmitting,
    error: week.error,
    setError: week.setError,
    projects: week.projects,
    recentUserEntries: week.recentUserEntries,
    selectedWeekEntries: week.selectedWeekEntries,
    monthlyAssignments: monthly.monthlyAssignments,
    targetMonth: monthly.targetMonth,
    monthHoursByProject: monthly.monthHoursByProject,
    monthEffortProjects: monthly.monthEffortProjects,
    expectedHours: week.expectedHours,
    missingWeeks: week.missingWeeks,
    weekPersonalHolidays: holidays.weekPersonalHolidays,
    weekPublicHolidays: holidays.weekPublicHolidays,
    monthPersonalHolidays: holidays.monthPersonalHolidays,
    monthPublicHolidays: holidays.monthPublicHolidays,
    isLoadingMonthHolidays: holidays.isLoadingMonthHolidays,
    templateEntries: week.templateEntries,
    createEntries: week.createEntries,
    updateEntryHours: week.updateEntryHours,
    deleteEntry: week.deleteEntry,
    refreshAfterHolidayChange,
  };
}
