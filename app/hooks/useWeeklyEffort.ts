import { useCallback, useEffect, useState } from "react";
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
import { createEmptyEntry, getCurrentMonthStart } from "~/components/weekly-effort/utils";

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
  allUserEntries: ProjectWeeklyEffort[];
  selectedWeekEntries: ProjectWeeklyEffort[];
  monthlyAssignments: ProjectMonthlyAssignment[];
  expectedHours: number | null;
  missingWeeks: string[];
  weekPersonalHolidays: PersonalHoliday[];
  weekPublicHolidays: PublicHoliday[];
  isLoadingWeekHolidays: boolean;
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
  const [allUserEntries, setAllUserEntries] = useState<ProjectWeeklyEffort[]>([]);
  const [selectedWeekEntries, setSelectedWeekEntries] = useState<ProjectWeeklyEffort[]>([]);
  const [projects, setProjects] = useState<KippoProject[]>([]);
  const [templateEntries, setTemplateEntries] = useState<FormEntry[]>([]);

  const [weekPersonalHolidays, setWeekPersonalHolidays] = useState<PersonalHoliday[]>([]);
  const [weekPublicHolidays, setWeekPublicHolidays] = useState<PublicHoliday[]>([]);
  const [isLoadingWeekHolidays, setIsLoadingWeekHolidays] = useState(false);

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

  const fetchWeekHolidays = useCallback(async (weekStartDate: string) => {
    setIsLoadingWeekHolidays(true);
    try {
      const startDate = new Date(`${weekStartDate}T00:00:00`);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      const dayGte = weekStartDate;
      const dayLte = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

      const [personalRes, publicRes] = await Promise.all([
        personalHolidaysList({ day_gte: dayGte, day_lte: dayLte }),
        publicHolidaysList({ day_gte: dayGte, day_lte: dayLte }),
      ]);

      setWeekPersonalHolidays(personalRes.data?.results || []);
      setWeekPublicHolidays(publicRes.data?.results || []);
    } catch {
      setWeekPersonalHolidays([]);
      setWeekPublicHolidays([]);
    } finally {
      setIsLoadingWeekHolidays(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError("");

      try {
        const [allProjects, weeklyEffortRes, assignmentsRes, missingWeeksRes, expectedHoursRes] =
          await Promise.all([
            fetchAllProjects(),
            projectsWeeklyeffortList({ user_username: user.username }),
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
          setAllUserEntries(userEntries);

          const entriesForSelectedWeek = userEntries.filter((e) => e.week_start === weekStart);
          setSelectedWeekEntries(entriesForSelectedWeek);

          if (entriesForSelectedWeek.length > 0) {
            setTemplateEntries([]);
          } else if (userEntries.length > 0) {
            const sortedEntries = [...userEntries].sort((a, b) =>
              (b.week_start || "").localeCompare(a.week_start || ""),
            );
            const latestWeekStart = sortedEntries[0].week_start;
            const latestEntries = sortedEntries.filter((e) => e.week_start === latestWeekStart);
            const formEntries = buildTemplateEntries(latestEntries, allProjects, false);
            setTemplateEntries(formEntries.length > 0 ? formEntries : [createEmptyEntry()]);
          } else {
            setTemplateEntries([createEmptyEntry()]);
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
      fetchWeekHolidays(weekStart);

      const selectedDate = new Date(`${weekStart}T00:00:00`);
      const sundayBeforePrevWeek = new Date(selectedDate);
      sundayBeforePrevWeek.setDate(sundayBeforePrevWeek.getDate() - 8);
      const prevWeekGte = `${sundayBeforePrevWeek.getFullYear()}-${String(sundayBeforePrevWeek.getMonth() + 1).padStart(2, "0")}-${String(sundayBeforePrevWeek.getDate()).padStart(2, "0")}`;
      const sundayBeforeSelectedWeek = new Date(selectedDate);
      sundayBeforeSelectedWeek.setDate(sundayBeforeSelectedWeek.getDate() - 1);
      const prevWeekLte = `${sundayBeforeSelectedWeek.getFullYear()}-${String(sundayBeforeSelectedWeek.getMonth() + 1).padStart(2, "0")}-${String(sundayBeforeSelectedWeek.getDate()).padStart(2, "0")}`;

      try {
        const weeklyEffortRes = await projectsWeeklyeffortList({
          user_username: user?.username,
          week_start_gte: prevWeekGte,
          week_start_lte: prevWeekLte,
        });

        const previousWeekEntries = weeklyEffortRes.data?.results || [];

        const entriesForSelectedWeek = allUserEntries.filter((e) => e.week_start === weekStart);
        setSelectedWeekEntries(entriesForSelectedWeek);

        if (entriesForSelectedWeek.length > 0) {
          setTemplateEntries([]);
        } else if (previousWeekEntries.length > 0) {
          setTemplateEntries(buildTemplateEntries(previousWeekEntries, projects, true));
        } else {
          const sortedEntries = [...allUserEntries].sort((a, b) =>
            (b.week_start || "").localeCompare(a.week_start || ""),
          );
          if (sortedEntries.length > 0) {
            const latestWeekStart = sortedEntries[0].week_start;
            const latestEntries = sortedEntries.filter((e) => e.week_start === latestWeekStart);
            setTemplateEntries(buildTemplateEntries(latestEntries, projects, true));
          } else {
            setTemplateEntries([createEmptyEntry()]);
          }
        }
      } catch {
        // Failed to fetch week data - keep current entries
      }
    };

    updateWeekData();
  }, [weekStart, fetchExpectedHours, fetchWeekHolidays, projects, user, allUserEntries]);

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

        const existingRes = await projectsWeeklyeffortList({
          user_username: user?.username,
          week_start_gte: currentWeekStart,
          week_start_lte: currentWeekStart,
        });

        const existingForUser = existingRes.data?.results || [];

        for (const entry of validEntries) {
          const duplicate = existingForUser.find((e) => e.project === entry.projectId);
          if (duplicate) {
            setError(`${entry.projectName} は既にこの週のエントリが存在します。`);
            return false;
          }
        }

        for (const entry of validEntries) {
          await projectsWeeklyeffortCreate({
            week_start: currentWeekStart,
            project: entry.projectId,
            hours: entry.hours,
          });
        }

        const [weeklyEffortRes, missingWeeksRes] = await Promise.all([
          projectsWeeklyeffortList({ user_username: user?.username }),
          weeklyEffortMissingWeeksRetrieve(),
        ]);

        if (weeklyEffortRes.data?.results) {
          const userEntries = weeklyEffortRes.data.results;
          setAllUserEntries(userEntries);
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
    [user],
  );

  const updateEntryHours = useCallback(
    async (entryId: number, hours: number, currentWeekStart: string): Promise<boolean> => {
      setIsSubmitting(true);
      setError("");
      try {
        await projectsWeeklyeffortPartialUpdate(entryId, { hours });

        const weeklyEffortRes = await projectsWeeklyeffortList({
          user_username: user?.username,
        });
        if (weeklyEffortRes.data?.results) {
          const userEntries = weeklyEffortRes.data.results;
          setAllUserEntries(userEntries);
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

        const [weeklyEffortRes, missingWeeksRes] = await Promise.all([
          projectsWeeklyeffortList({ user_username: user?.username }),
          weeklyEffortMissingWeeksRetrieve(),
        ]);

        if (weeklyEffortRes.data?.results) {
          const userEntries = weeklyEffortRes.data.results;
          setAllUserEntries(userEntries);
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
        fetchWeekHolidays(currentWeekStart),
      ]);
    },
    [fetchExpectedHours, fetchWeekHolidays],
  );

  return {
    isLoading,
    isSubmitting,
    error,
    setError,
    projects,
    allUserEntries,
    selectedWeekEntries,
    monthlyAssignments,
    expectedHours,
    missingWeeks,
    weekPersonalHolidays,
    weekPublicHolidays,
    isLoadingWeekHolidays,
    templateEntries,
    createEntries,
    updateEntryHours,
    deleteEntry,
    refreshAfterHolidayChange,
  };
}
