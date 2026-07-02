import { useCallback, useEffect, useState } from "react";
import {
  projectsWeeklyeffortList,
  projectsWeeklyeffortCreate,
  projectsWeeklyeffortPartialUpdate,
  projectsWeeklyeffortDestroy,
} from "~/lib/api/generated/projects/projects";
import {
  weeklyEffortExpectedHoursRetrieve,
  weeklyEffortMissingWeeksRetrieve,
} from "~/lib/api/generated/weekly-effort/weekly-effort";
import { fetchAllProjects } from "~/lib/api/pagination";
import { readList } from "~/lib/api/read-list";
import type { KippoProject, ProjectWeeklyEffort } from "~/lib/api/generated/models";
import type { FormEntry } from "~/components/weekly-effort/types";
import {
  createEmptyEntry,
  isProjectOpenForWeek,
  twoWeekWindow,
} from "~/components/weekly-effort/utils";

type AuthUser = {
  username: string;
};

function buildTemplateEntries(
  sourceEntries: ProjectWeeklyEffort[],
  projectsList: KippoProject[],
  resetHours: boolean,
  targetWeekStart: string,
): FormEntry[] {
  const projectsMap = new Map(projectsList.map((p) => [p.id, p]));
  const carried = sourceEntries
    .filter((e) => isProjectOpenForWeek(projectsMap.get(e.project), targetWeekStart))
    .map((e, idx) => {
      const project = projectsMap.get(e.project);
      const filterType: "project" | "anon-project" =
        project?.category === "non-project" ? "anon-project" : "project";
      return {
        id: Date.now() + idx,
        projectId: e.project,
        projectName: e.project_name,
        hours: resetHours ? 0 : e.hours,
        filterType,
      };
    });
  return carried.length > 0 ? carried : [createEmptyEntry()];
}

export type UseWeekEntriesReturn = {
  isLoading: boolean;
  isSubmitting: boolean;
  error: string;
  setError: (err: string) => void;
  projects: KippoProject[];
  recentUserEntries: ProjectWeeklyEffort[];
  selectedWeekEntries: ProjectWeeklyEffort[];
  expectedHours: number | null;
  missingWeeks: string[];
  templateEntries: FormEntry[];
  fetchExpectedHours: (weekStartDate: string) => Promise<void>;
  createEntries: (entries: FormEntry[], weekStart: string) => Promise<boolean>;
  updateEntryHours: (entryId: number, hours: number, weekStart: string) => Promise<boolean>;
  deleteEntry: (entryId: number, weekStart: string) => Promise<boolean>;
};

/**
 * Effort entries for the selected week: the project list, the two-week window used to
 * build carry-over templates, expected hours, missing weeks, and the create / update /
 * delete mutations. After each mutation `refreshMonth` re-pulls the cumulative monthly
 * totals owned by {@link useMonthlyEffort}.
 */
export function useWeekEntries(
  user: AuthUser | null,
  weekStart: string,
  refreshMonth: (weekStartDate: string) => void,
): UseWeekEntriesReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [expectedHours, setExpectedHours] = useState<number | null>(null);
  const [missingWeeks, setMissingWeeks] = useState<string[]>([]);
  const [recentUserEntries, setRecentUserEntries] = useState<ProjectWeeklyEffort[]>([]);
  const [selectedWeekEntries, setSelectedWeekEntries] = useState<ProjectWeeklyEffort[]>([]);
  const [projects, setProjects] = useState<KippoProject[]>([]);
  const [templateEntries, setTemplateEntries] = useState<FormEntry[]>([]);

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

  // Initial load
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError("");

      try {
        const initialWindow = twoWeekWindow(weekStart);
        const [allProjects, weeklyEffortRes, missingWeeksRes, expectedHoursRes] = await Promise.all(
          [
            fetchAllProjects(),
            projectsWeeklyeffortList({
              user_username: user.username,
              week_start_gte: initialWindow.gte,
              week_start_lte: initialWindow.lte,
            }),
            weeklyEffortMissingWeeksRetrieve().catch(() => null),
            weeklyEffortExpectedHoursRetrieve({ week_start: weekStart }).catch(() => null),
          ],
        );

        setProjects(allProjects);

        if (expectedHoursRes?.status === 200) {
          setExpectedHours(expectedHoursRes.data.expected_hours ?? null);
        }

        if (missingWeeksRes?.status === 200 && missingWeeksRes.data.missing_weeks) {
          setMissingWeeks(missingWeeksRes.data.missing_weeks);
        }

        const userEntries = readList<ProjectWeeklyEffort>(weeklyEffortRes.data);
        setRecentUserEntries(userEntries);

        const entriesForSelectedWeek = userEntries.filter((e) => e.week_start === weekStart);
        setSelectedWeekEntries(entriesForSelectedWeek);

        if (entriesForSelectedWeek.length > 0) {
          setTemplateEntries([]);
        } else {
          const previousWeekEntries = userEntries.filter((e) => e.week_start !== weekStart);
          setTemplateEntries(
            previousWeekEntries.length > 0
              ? buildTemplateEntries(previousWeekEntries, allProjects, false, weekStart)
              : [createEmptyEntry()],
          );
        }
      } catch {
        setError("データの取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Refetch expected hours / template entries when week_start changes
  useEffect(() => {
    if (!weekStart || projects.length === 0) return;

    const updateWeekData = async () => {
      fetchExpectedHours(weekStart);

      const window = twoWeekWindow(weekStart);

      try {
        const weeklyEffortRes = await projectsWeeklyeffortList({
          user_username: user?.username,
          week_start_gte: window.gte,
          week_start_lte: window.lte,
        });

        const windowEntries = readList<ProjectWeeklyEffort>(weeklyEffortRes.data);
        setRecentUserEntries(windowEntries);

        const entriesForSelectedWeek = windowEntries.filter((e) => e.week_start === weekStart);
        setSelectedWeekEntries(entriesForSelectedWeek);

        if (entriesForSelectedWeek.length > 0) {
          setTemplateEntries([]);
        } else {
          const previousWeekEntries = windowEntries.filter((e) => e.week_start !== weekStart);
          setTemplateEntries(
            previousWeekEntries.length > 0
              ? buildTemplateEntries(previousWeekEntries, projects, true, weekStart)
              : [createEmptyEntry()],
          );
        }
      } catch {
        // Failed to fetch week data - keep current entries
      }
    };

    updateWeekData();
    // `projects` intentionally omitted: including it causes a duplicate-fetch cascade on initial mount (#44).
    // `projects` is set exactly once by the initial-load effect; the runtime early return above still gates first invocation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, fetchExpectedHours, user]);

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

        const userEntries = readList<ProjectWeeklyEffort>(weeklyEffortRes.data);
        setRecentUserEntries(userEntries);
        setSelectedWeekEntries(userEntries.filter((e) => e.week_start === currentWeekStart));

        if (missingWeeksRes.status === 200 && missingWeeksRes.data.missing_weeks) {
          setMissingWeeks(missingWeeksRes.data.missing_weeks);
        }

        void refreshMonth(currentWeekStart);
        setTemplateEntries([createEmptyEntry()]);
        return true;
      } catch {
        setError("エントリの保存に失敗しました");
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, selectedWeekEntries, refreshMonth],
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
        const userEntries = readList<ProjectWeeklyEffort>(weeklyEffortRes.data);
        setRecentUserEntries(userEntries);
        setSelectedWeekEntries(userEntries.filter((e) => e.week_start === currentWeekStart));
        void refreshMonth(currentWeekStart);
        return true;
      } catch {
        setError("更新に失敗しました");
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, refreshMonth],
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

        const userEntries = readList<ProjectWeeklyEffort>(weeklyEffortRes.data);
        setRecentUserEntries(userEntries);
        setSelectedWeekEntries(userEntries.filter((e) => e.week_start === currentWeekStart));

        if (missingWeeksRes.status === 200 && missingWeeksRes.data.missing_weeks) {
          setMissingWeeks(missingWeeksRes.data.missing_weeks);
        }
        void refreshMonth(currentWeekStart);
        return true;
      } catch {
        setError("削除に失敗しました");
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, refreshMonth],
  );

  return {
    isLoading,
    isSubmitting,
    error,
    setError,
    projects,
    recentUserEntries,
    selectedWeekEntries,
    expectedHours,
    missingWeeks,
    templateEntries,
    fetchExpectedHours,
    createEntries,
    updateEntryHours,
    deleteEntry,
  };
}
