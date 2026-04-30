import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  projectsWeeklyeffortList,
  projectsWeeklyeffortCreate,
  projectsWeeklyeffortPartialUpdate,
  projectsWeeklyeffortDestroy,
} from "~/lib/api/generated/projects/projects";
import { personalHolidaysList } from "~/lib/api/generated/personal-holidays/personal-holidays";
import { publicHolidaysList } from "~/lib/api/generated/public-holidays/public-holidays";
import { monthlyAssignmentsList } from "~/lib/api/generated/monthly-assignments/monthly-assignments";
import {
  weeklyEffortExpectedHoursRetrieve,
  weeklyEffortMissingWeeksRetrieve,
} from "~/lib/api/generated/weekly-effort/weekly-effort";
import { fetchAllProjects } from "~/lib/api/pagination";
import type {
  KippoProject,
  PersonalHoliday,
  ProjectMonthlyAssignment,
  ProjectWeeklyEffort,
  PublicHoliday,
} from "~/lib/api/generated/models";
import type { FormEntry } from "~/components/weekly-effort/types";
import {
  createEmptyEntry,
  formatDateStr,
  getCurrentMonthStart,
  monthDateRange,
  twoWeekWindow,
} from "~/components/weekly-effort/utils";

type AuthUser = {
  username: string;
};

function buildTemplateEntries(
  sourceEntries: ProjectWeeklyEffort[],
  projectsList: KippoProject[],
  resetHours: boolean,
): FormEntry[] {
  const projectsMap = new Map(projectsList.map((p) => [p.id, p]));
  return sourceEntries.map((e, idx) => {
    const project = projectsMap.get(e.project);
    const filterType: "project" | "anon-project" =
      project?.phase === "anon-project" ? "anon-project" : "project";
    return {
      id: Date.now() + idx,
      projectId: e.project,
      projectName: e.project_name,
      hours: resetHours ? 0 : e.hours,
      filterType,
    };
  });
}

export type UseWeeklyEffortReturn = {
  isLoading: boolean;
  isSubmitting: boolean;
  error: string;
  setError: (err: string) => void;
  projects: KippoProject[];
  recentUserEntries: ProjectWeeklyEffort[];
  selectedWeekEntries: ProjectWeeklyEffort[];
  monthlyAssignments: ProjectMonthlyAssignment[];
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

export function useWeeklyEffort(user: AuthUser | null, weekStart: string): UseWeeklyEffortReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [expectedHours, setExpectedHours] = useState<number | null>(null);
  const [missingWeeks, setMissingWeeks] = useState<string[]>([]);
  const [monthlyAssignments, setMonthlyAssignments] = useState<ProjectMonthlyAssignment[]>([]);
  const [recentUserEntries, setRecentUserEntries] = useState<ProjectWeeklyEffort[]>([]);
  const [selectedWeekEntries, setSelectedWeekEntries] = useState<ProjectWeeklyEffort[]>([]);
  const [projects, setProjects] = useState<KippoProject[]>([]);
  const [templateEntries, setTemplateEntries] = useState<FormEntry[]>([]);

  const [monthPersonalHolidays, setMonthPersonalHolidays] = useState<PersonalHoliday[]>([]);
  const [monthPublicHolidays, setMonthPublicHolidays] = useState<PublicHoliday[]>([]);
  const [isLoadingMonthHolidays, setIsLoadingMonthHolidays] = useState(false);
  const lastFetchedMonthRef = useRef<string | null>(null);

  const fetchExpectedHours = useCallback(async (weekStartDate: string) => {
    try {
      const response = await weeklyEffortExpectedHoursRetrieve({
        week_start: weekStartDate,
      });
      if (response.status === 200) {
        setExpectedHours(response.data.expected_hours ?? null);
      }
    } catch {
      // Failed to fetch expected hours
    }
  }, []);

  const fetchMonthHolidays = useCallback(async (dateStr: string) => {
    setIsLoadingMonthHolidays(true);
    try {
      const { dayGte, dayLte } = monthDateRange(dateStr);

      const [personalRes, publicRes] = await Promise.all([
        personalHolidaysList({ day_gte: dayGte, day_lte: dayLte }),
        publicHolidaysList({ day_gte: dayGte, day_lte: dayLte }),
      ]);

      setMonthPersonalHolidays(personalRes.data?.results || []);
      setMonthPublicHolidays(publicRes.data?.results || []);
      lastFetchedMonthRef.current = dateStr.substring(0, 7);
    } catch {
      setMonthPersonalHolidays([]);
      setMonthPublicHolidays([]);
    } finally {
      setIsLoadingMonthHolidays(false);
    }
  }, []);

  const { weekPersonalHolidays, weekPublicHolidays } = useMemo(() => {
    const startDate = new Date(`${weekStart}T00:00:00`);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const endStr = formatDateStr(endDate);
    return {
      weekPersonalHolidays: monthPersonalHolidays.filter(
        (h) => h.day >= weekStart && h.day <= endStr,
      ),
      weekPublicHolidays: monthPublicHolidays.filter((h) => h.day >= weekStart && h.day <= endStr),
    };
  }, [weekStart, monthPersonalHolidays, monthPublicHolidays]);

  // Initial load
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError("");

      try {
        const initialWindow = twoWeekWindow(weekStart);
        const [allProjects, weeklyEffortRes, assignmentsRes, missingWeeksRes, expectedHoursRes] =
          await Promise.all([
            fetchAllProjects(),
            projectsWeeklyeffortList({
              user_username: user.username,
              week_start_gte: initialWindow.gte,
              week_start_lte: initialWindow.lte,
            }),
            monthlyAssignmentsList({ month: getCurrentMonthStart() }),
            weeklyEffortMissingWeeksRetrieve().catch(() => null),
            weeklyEffortExpectedHoursRetrieve({ week_start: weekStart }).catch(() => null),
          ]);

        setProjects(allProjects);

        if (expectedHoursRes?.status === 200) {
          setExpectedHours(expectedHoursRes.data.expected_hours ?? null);
        }

        if (missingWeeksRes?.status === 200 && missingWeeksRes.data.missing_weeks) {
          setMissingWeeks(missingWeeksRes.data.missing_weeks);
        }

        if (weeklyEffortRes.data?.results) {
          const userEntries = weeklyEffortRes.data.results;
          setRecentUserEntries(userEntries);

          const entriesForSelectedWeek = userEntries.filter((e) => e.week_start === weekStart);
          setSelectedWeekEntries(entriesForSelectedWeek);

          if (entriesForSelectedWeek.length > 0) {
            setTemplateEntries([]);
          } else {
            const previousWeekEntries = userEntries.filter((e) => e.week_start !== weekStart);
            if (previousWeekEntries.length > 0) {
              setTemplateEntries(buildTemplateEntries(previousWeekEntries, allProjects, false));
            } else {
              setTemplateEntries([createEmptyEntry()]);
            }
          }
        }

        if (assignmentsRes.data?.results) {
          const userAssignments = assignmentsRes.data.results
            .filter((a) => a.user_username === user.username)
            .sort((a, b) => b.percentage - a.percentage);
          setMonthlyAssignments(userAssignments);
        }
      } catch {
        setError("データの取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Refetch expected hours / holidays / template entries when week_start changes
  useEffect(() => {
    if (!weekStart || projects.length === 0) return;

    const updateWeekData = async () => {
      fetchExpectedHours(weekStart);
      if (lastFetchedMonthRef.current !== weekStart.substring(0, 7)) {
        fetchMonthHolidays(weekStart);
      }

      const window = twoWeekWindow(weekStart);

      try {
        const weeklyEffortRes = await projectsWeeklyeffortList({
          user_username: user?.username,
          week_start_gte: window.gte,
          week_start_lte: window.lte,
        });

        const windowEntries = weeklyEffortRes.data?.results || [];
        setRecentUserEntries(windowEntries);

        const entriesForSelectedWeek = windowEntries.filter((e) => e.week_start === weekStart);
        setSelectedWeekEntries(entriesForSelectedWeek);

        if (entriesForSelectedWeek.length > 0) {
          setTemplateEntries([]);
        } else {
          const previousWeekEntries = windowEntries.filter((e) => e.week_start !== weekStart);
          if (previousWeekEntries.length > 0) {
            setTemplateEntries(buildTemplateEntries(previousWeekEntries, projects, true));
          } else {
            setTemplateEntries([createEmptyEntry()]);
          }
        }
      } catch {
        // Failed to fetch week data - keep current entries
      }
    };

    updateWeekData();
    // `projects` intentionally omitted: including it causes a duplicate-fetch cascade on initial mount (#44).
    // `projects` is set exactly once by Effect 1; the runtime early return above still gates first invocation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, fetchExpectedHours, fetchMonthHolidays, user]);

  const createEntries = useCallback(
    async (entries: FormEntry[], currentWeekStart: string): Promise<boolean> => {
      setIsSubmitting(true);
      setError("");

      try {
        const validEntries = entries.filter((e) => e.projectId && e.hours >= 0);
        if (validEntries.length === 0) {
          setError("有効なエントリがありません");
          return false;
        }

        for (const entry of validEntries) {
          const duplicate = selectedWeekEntries.find((e) => e.project === entry.projectId);
          if (duplicate) {
            setError(`${entry.projectName} は既にこの週のエントリが存在します。`);
            return false;
          }
        }

        try {
          for (const entry of validEntries) {
            await projectsWeeklyeffortCreate({
              week_start: currentWeekStart,
              project: entry.projectId,
              hours: entry.hours,
            });
          }
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 409 || status === 400) {
            setError(
              "他のタブで既にエントリが作成されている可能性があります。画面を更新してください。",
            );
            return false;
          }
          throw err;
        }

        const window = twoWeekWindow(currentWeekStart);
        const [weeklyEffortRes, missingWeeksRes] = await Promise.all([
          projectsWeeklyeffortList({
            user_username: user?.username,
            week_start_gte: window.gte,
            week_start_lte: window.lte,
          }),
          weeklyEffortMissingWeeksRetrieve(),
        ]);

        if (weeklyEffortRes.data?.results) {
          const userEntries = weeklyEffortRes.data.results;
          setRecentUserEntries(userEntries);
          setSelectedWeekEntries(userEntries.filter((e) => e.week_start === currentWeekStart));
        }

        if (missingWeeksRes.status === 200 && missingWeeksRes.data.missing_weeks) {
          setMissingWeeks(missingWeeksRes.data.missing_weeks);
        }

        setTemplateEntries([createEmptyEntry()]);
        return true;
      } catch {
        setError("エントリの保存に失敗しました");
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, selectedWeekEntries],
  );

  const updateEntryHours = useCallback(
    async (entryId: number, hours: number, currentWeekStart: string): Promise<boolean> => {
      setIsSubmitting(true);
      setError("");
      try {
        await projectsWeeklyeffortPartialUpdate(entryId, { hours });

        const window = twoWeekWindow(currentWeekStart);
        const weeklyEffortRes = await projectsWeeklyeffortList({
          user_username: user?.username,
          week_start_gte: window.gte,
          week_start_lte: window.lte,
        });
        if (weeklyEffortRes.data?.results) {
          const userEntries = weeklyEffortRes.data.results;
          setRecentUserEntries(userEntries);
          setSelectedWeekEntries(userEntries.filter((e) => e.week_start === currentWeekStart));
        }
        return true;
      } catch {
        setError("更新に失敗しました");
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user],
  );

  const deleteEntry = useCallback(
    async (entryId: number, currentWeekStart: string): Promise<boolean> => {
      setIsSubmitting(true);
      setError("");
      try {
        await projectsWeeklyeffortDestroy(entryId);

        const window = twoWeekWindow(currentWeekStart);
        const [weeklyEffortRes, missingWeeksRes] = await Promise.all([
          projectsWeeklyeffortList({
            user_username: user?.username,
            week_start_gte: window.gte,
            week_start_lte: window.lte,
          }),
          weeklyEffortMissingWeeksRetrieve(),
        ]);

        if (weeklyEffortRes.data?.results) {
          const userEntries = weeklyEffortRes.data.results;
          setRecentUserEntries(userEntries);
          setSelectedWeekEntries(userEntries.filter((e) => e.week_start === currentWeekStart));
        }

        if (missingWeeksRes.status === 200 && missingWeeksRes.data.missing_weeks) {
          setMissingWeeks(missingWeeksRes.data.missing_weeks);
        }
        return true;
      } catch {
        setError("削除に失敗しました");
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user],
  );

  const refreshAfterHolidayChange = useCallback(
    async (currentWeekStart: string) => {
      await Promise.all([
        fetchExpectedHours(currentWeekStart),
        fetchMonthHolidays(currentWeekStart),
      ]);
    },
    [fetchExpectedHours, fetchMonthHolidays],
  );

  return {
    isLoading,
    isSubmitting,
    error,
    setError,
    projects,
    recentUserEntries,
    selectedWeekEntries,
    monthlyAssignments,
    expectedHours,
    missingWeeks,
    weekPersonalHolidays,
    weekPublicHolidays,
    monthPersonalHolidays,
    monthPublicHolidays,
    isLoadingMonthHolidays,
    templateEntries,
    createEntries,
    updateEntryHours,
    deleteEntry,
    refreshAfterHolidayChange,
  };
}
