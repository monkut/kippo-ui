import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "~/lib/auth-context";
import { Layout } from "~/components/layout";
import { projectsList } from "~/lib/api/generated/projects/projects";
import {
  projectsWeeklyeffortList,
  projectsWeeklyeffortCreate,
} from "~/lib/api/generated/projects/projects";
import { monthlyAssignmentsList } from "~/lib/api/generated/monthly-assignments/monthly-assignments";
import {
  weeklyEffortExpectedHoursRetrieve,
  weeklyEffortMissingWeeksRetrieve,
} from "~/lib/api/generated/weekly-effort/weekly-effort";
import type {
  KippoProject,
  ProjectWeeklyEffort,
  ProjectMonthlyAssignment,
} from "~/lib/api/generated/models";

export function meta() {
  return [{ title: "週間稼働量 - Kippo" }];
}

type FormEntry = {
  id: number;
  projectId: string;
  projectName: string;
  hours: number;
  filterType: "project" | "anon-project";
};

function getPreviousWeekStartDate(): string {
  // Matches kippo's previous_week_startdate() logic from projects/functions.py
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 5);
  // Python weekday(): Monday=0, JS getDay(): Monday=1
  while (lastWeek.getDay() !== 1) {
    lastWeek.setDate(lastWeek.getDate() - 1);
  }
  return lastWeek.toISOString().split("T")[0];
}

function getCurrentMonthStart(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function WeeklyEffort() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data states
  const [weekStart, setWeekStart] = useState(getPreviousWeekStartDate());
  const [expectedHours, setExpectedHours] = useState<number | null>(null);
  const [missingWeeks, setMissingWeeks] = useState<string[]>([]);
  const [monthlyAssignments, setMonthlyAssignments] = useState<ProjectMonthlyAssignment[]>([]);
  const [allUserEntries, setAllUserEntries] = useState<ProjectWeeklyEffort[]>([]);
  const [selectedWeekEntries, setSelectedWeekEntries] = useState<ProjectWeeklyEffort[]>([]);
  const [projects, setProjects] = useState<KippoProject[]>([]);
  const [entries, setEntries] = useState<FormEntry[]>([]);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Fetch expected hours when week_start changes
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

  // Fetch initial data - all requests in parallel for faster load
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError("");

      try {
        // Fetch ALL data in parallel for faster initial load
        const [projectsRes, weeklyEffortRes, assignmentsRes, missingWeeksRes, expectedHoursRes] =
          await Promise.all([
            projectsList({ is_active: true }),
            projectsWeeklyeffortList({}),
            monthlyAssignmentsList({ month: getCurrentMonthStart() }),
            weeklyEffortMissingWeeksRetrieve().catch(() => null),
            weeklyEffortExpectedHoursRetrieve({ week_start: weekStart }).catch(() => null),
          ]);

        // Process projects
        if (projectsRes.data?.results) {
          setProjects(projectsRes.data.results);
        }

        // Process expected hours
        if (expectedHoursRes?.status === 200) {
          setExpectedHours(expectedHoursRes.data.expected_hours ?? null);
        }

        // Process missing weeks
        if (missingWeeksRes?.status === 200 && missingWeeksRes.data.missing_weeks) {
          setMissingWeeks(missingWeeksRes.data.missing_weeks);
        }

        // Process weekly effort entries for the current user
        if (weeklyEffortRes.data?.results) {
          const userEntries = weeklyEffortRes.data.results.filter(
            (e) => e.user_username === user.username,
          );
          setAllUserEntries(userEntries);

          // Find entries for the selected week
          const entriesForSelectedWeek = userEntries.filter((e) => e.week_start === weekStart);
          setSelectedWeekEntries(entriesForSelectedWeek);

          // Auto-populate form entries from selected week entries (or latest if none)
          const projectsMap = new Map((projectsRes.data?.results || []).map((p) => [p.id, p]));
          if (entriesForSelectedWeek.length > 0) {
            const formEntries: FormEntry[] = entriesForSelectedWeek.map((e, idx) => {
              const project = projectsMap.get(e.project);
              const filterType: "project" | "anon-project" =
                project?.phase === "anon-project" ? "anon-project" : "project";
              return {
                id: Date.now() + idx,
                projectId: e.project,
                projectName: e.project_name,
                hours: e.hours,
                filterType,
              };
            });
            setEntries(formEntries);
          } else if (userEntries.length > 0) {
            // Fall back to latest entries as template
            const sortedEntries = [...userEntries].sort((a, b) =>
              (b.week_start || "").localeCompare(a.week_start || ""),
            );
            const latestWeekStart = sortedEntries[0].week_start;
            const latestEntries = sortedEntries.filter((e) => e.week_start === latestWeekStart);
            const formEntries: FormEntry[] = latestEntries.map((e, idx) => {
              const project = projectsMap.get(e.project);
              const filterType: "project" | "anon-project" =
                project?.phase === "anon-project" ? "anon-project" : "project";
              return {
                id: Date.now() + idx,
                projectId: e.project,
                projectName: e.project_name,
                hours: e.hours,
                filterType,
              };
            });
            setEntries(formEntries.length > 0 ? formEntries : [createEmptyEntry()]);
          } else {
            setEntries([createEmptyEntry()]);
          }
        }

        // Process monthly assignments for the current user
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

  // Refetch expected hours and update selected week entries when week_start changes
  useEffect(() => {
    if (!weekStart || allUserEntries.length === 0 || projects.length === 0) return;

    fetchExpectedHours(weekStart);

    // Update entries for the selected week
    const entriesForSelectedWeek = allUserEntries.filter((e) => e.week_start === weekStart);
    setSelectedWeekEntries(entriesForSelectedWeek);

    // Update form entries based on selected week or fall back to previous week's data
    const projectsMap = new Map(projects.map((p) => [p.id, p]));

    if (entriesForSelectedWeek.length > 0) {
      // Selected week has entries - use them
      const formEntries: FormEntry[] = entriesForSelectedWeek.map((e, idx) => {
        const project = projectsMap.get(e.project);
        const filterType: "project" | "anon-project" =
          project?.phase === "anon-project" ? "anon-project" : "project";
        return {
          id: Date.now() + idx,
          projectId: e.project,
          projectName: e.project_name,
          hours: e.hours,
          filterType,
        };
      });
      setEntries(formEntries);
    } else {
      // No entries for selected week - use previous week's data as template
      // Calculate previous week (7 days before selected week)
      const selectedDate = new Date(weekStart);
      selectedDate.setDate(selectedDate.getDate() - 7);
      const previousWeekStart = selectedDate.toISOString().split("T")[0];

      const previousWeekEntries = allUserEntries.filter((e) => e.week_start === previousWeekStart);

      if (previousWeekEntries.length > 0) {
        // Use previous week's entries as template (with hours reset to 0)
        const formEntries: FormEntry[] = previousWeekEntries.map((e, idx) => {
          const project = projectsMap.get(e.project);
          const filterType: "project" | "anon-project" =
            project?.phase === "anon-project" ? "anon-project" : "project";
          return {
            id: Date.now() + idx,
            projectId: e.project,
            projectName: e.project_name,
            hours: 0, // Reset hours for new week entry
            filterType,
          };
        });
        setEntries(formEntries);
      } else {
        // No previous week data either - use latest entries as template
        const sortedEntries = [...allUserEntries].sort((a, b) =>
          (b.week_start || "").localeCompare(a.week_start || ""),
        );
        if (sortedEntries.length > 0) {
          const latestWeekStart = sortedEntries[0].week_start;
          const latestEntries = sortedEntries.filter((e) => e.week_start === latestWeekStart);
          const formEntries: FormEntry[] = latestEntries.map((e, idx) => {
            const project = projectsMap.get(e.project);
            const filterType: "project" | "anon-project" =
              project?.phase === "anon-project" ? "anon-project" : "project";
            return {
              id: Date.now() + idx,
              projectId: e.project,
              projectName: e.project_name,
              hours: 0, // Reset hours for new week entry
              filterType,
            };
          });
          setEntries(formEntries);
        } else {
          setEntries([createEmptyEntry()]);
        }
      }
    }
  }, [weekStart, fetchExpectedHours, allUserEntries, projects]);

  function createEmptyEntry(filterType: "project" | "anon-project" = "project"): FormEntry {
    return {
      id: Date.now(),
      projectId: "",
      projectName: "",
      hours: 0,
      filterType,
    };
  }

  const addEntry = (filterType: "project" | "anon-project") => {
    const filteredProjects = projects.filter((p) =>
      filterType === "anon-project"
        ? p.phase === "anon-project" && p.display_as_active !== false && !p.is_closed
        : p.phase !== "anon-project" && p.display_as_active !== false && !p.is_closed,
    );

    const firstProject = filteredProjects[0];
    setEntries([
      ...entries,
      {
        id: Date.now(),
        projectId: firstProject?.id || "",
        projectName: firstProject?.name || "",
        hours: 0,
        filterType,
      },
    ]);
  };

  const removeEntry = (id: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((e) => e.id !== id));
    }
  };

  const updateEntry = (id: number, field: keyof FormEntry, value: string | number) => {
    setEntries(
      entries.map((e) => {
        if (e.id !== id) return e;
        if (field === "projectId") {
          const project = projects.find((p) => p.id === value);
          return {
            ...e,
            projectId: value as string,
            projectName: project?.name || "",
          };
        }
        return { ...e, [field]: value };
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const validEntries = entries.filter((e) => e.projectId && e.hours >= 0);
      if (validEntries.length === 0) {
        setError("有効なエントリがありません");
        return;
      }

      // Check for duplicates by fetching existing entries for this week
      const existingRes = await projectsWeeklyeffortList({
        week_start_gte: weekStart,
        week_start_lte: weekStart,
      });

      const existingForUser =
        existingRes.data?.results?.filter((e) => e.user_username === user?.username) || [];

      // Check if any entry would be a duplicate
      for (const entry of validEntries) {
        const duplicate = existingForUser.find((e) => e.project === entry.projectId);
        if (duplicate) {
          setError(`${entry.projectName} は既にこの週のエントリが存在します。`);
          return;
        }
      }

      // Create all entries
      for (const entry of validEntries) {
        await projectsWeeklyeffortCreate({
          week_start: weekStart,
          project: entry.projectId,
          user: "", // Will be set by backend
          hours: entry.hours,
        });
      }

      // Refresh data after successful submission (without full page reload)
      const [weeklyEffortRes, missingWeeksRes] = await Promise.all([
        projectsWeeklyeffortList({}),
        weeklyEffortMissingWeeksRetrieve(),
      ]);

      // Update user entries
      if (weeklyEffortRes.data?.results) {
        const userEntries = weeklyEffortRes.data.results.filter(
          (e) => e.user_username === user?.username,
        );
        setAllUserEntries(userEntries);

        // Update selected week entries
        const entriesForSelectedWeek = userEntries.filter((e) => e.week_start === weekStart);
        setSelectedWeekEntries(entriesForSelectedWeek);
      }

      // Update missing weeks
      if (missingWeeksRes.status === 200 && missingWeeksRes.data.missing_weeks) {
        setMissingWeeks(missingWeeksRes.data.missing_weeks);
      }

      // Clear form entries after successful save
      setEntries([createEmptyEntry()]);
    } catch {
      setError("エントリの保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate total hours for selected week entries
  const selectedWeekTotalHours = selectedWeekEntries.reduce((sum, e) => sum + e.hours, 0);

  // Calculate total hours for form entries
  const formTotalHours = entries.reduce((sum, e) => sum + e.hours, 0);

  // Filter projects for dropdowns
  // Use `!== false` to treat undefined as default true (Django model default)
  const projectProjects = projects.filter(
    (p) => p.phase !== "anon-project" && p.display_as_active !== false && !p.is_closed,
  );
  const nonProjectProjects = projects.filter(
    (p) => p.phase === "anon-project" && p.display_as_active !== false && !p.is_closed,
  );

  if (authLoading) {
    return (
      <Layout title="KIPPO プロジェクト週間稼働量">
        <div className="flex justify-center items-center h-64">読み込み中...</div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout title="KIPPO プロジェクト週間稼働量">
      <div className="space-y-6 max-w-4xl mx-auto">
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">読み込み中...</div>
          </div>
        ) : (
          <>
            {/* Expected Hours Section */}
            <section className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">期待稼働時間</h2>
              <div className="text-3xl font-bold text-indigo-600">
                {expectedHours === null ? "---" : `${expectedHours} 時間`}
              </div>
              <p className="text-sm text-gray-500 mt-1">週開始日: {weekStart}</p>
            </section>

            {/* Missing Weeks Section */}
            {missingWeeks.length > 0 && (
              <section className="bg-white shadow rounded-lg p-6 border-l-4 border-amber-400">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  未入力の週
                  <span className="ml-2 text-sm font-normal text-amber-600">
                    ({missingWeeks.length}件)
                  </span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  {missingWeeks.map((week) => (
                    <button
                      key={week}
                      type="button"
                      onClick={() => setWeekStart(week)}
                      className="px-3 py-1.5 text-sm bg-amber-50 text-amber-800 rounded-md hover:bg-amber-100 border border-amber-200"
                    >
                      {week}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  週開始日をクリックすると、その週の入力フォームに移動します
                </p>
              </section>
            )}

            {/* Monthly Assignments Section */}
            {monthlyAssignments.length > 0 && (
              <section className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">今月のプロジェクト割当</h2>
                <div className="space-y-2">
                  {monthlyAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-gray-700">{assignment.project_name}</span>
                      <span className="text-indigo-600 font-medium">{assignment.percentage}%</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Selected Week Existing Entries Section */}
            {selectedWeekEntries.length > 0 && (
              <section className="bg-white shadow rounded-lg p-6 border-l-4 border-green-400">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  登録済みの入力 ({weekStart})
                </h2>
                <div className="space-y-2">
                  {selectedWeekEntries.map((entry) => {
                    const percentage =
                      selectedWeekTotalHours > 0
                        ? Math.round((entry.hours / selectedWeekTotalHours) * 100)
                        : 0;
                    return (
                      <div
                        key={entry.id}
                        className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                      >
                        <span className="text-gray-700">{entry.project_name}</span>
                        <div className="text-right">
                          <span className="text-gray-900 font-medium">{entry.hours} 時間</span>
                          <span className="text-gray-500 text-sm ml-2">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-center pt-2 font-medium">
                    <span className="text-gray-900">合計</span>
                    <span className="text-gray-900">{selectedWeekTotalHours} 時間</span>
                  </div>
                </div>
              </section>
            )}

            {/* Input Entries Section */}
            <section className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">今週の入力</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Week Start Picker */}
                <div>
                  <label
                    htmlFor="week-start"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    週開始日 (月曜日)
                  </label>
                  <input
                    type="date"
                    id="week-start"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Entry List */}
                <div className="space-y-3">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-md"
                    >
                      <div className="flex-1">
                        <label
                          htmlFor={`project-${entry.id}`}
                          className="block text-xs font-medium text-gray-500 mb-1"
                        >
                          {entry.filterType === "anon-project" ? "Non-Project" : "プロジェクト"}
                        </label>
                        <select
                          id={`project-${entry.id}`}
                          value={entry.projectId}
                          onChange={(e) => updateEntry(entry.id, "projectId", e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                          disabled={isSubmitting}
                        >
                          <option value="">-- 選択してください --</option>
                          {entry.filterType === "anon-project"
                            ? nonProjectProjects.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))
                            : projectProjects.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                        </select>
                      </div>
                      <div className="w-24">
                        <label
                          htmlFor={`hours-${entry.id}`}
                          className="block text-xs font-medium text-gray-500 mb-1"
                        >
                          時間
                        </label>
                        <input
                          type="number"
                          id={`hours-${entry.id}`}
                          value={entry.hours}
                          onChange={(e) =>
                            updateEntry(entry.id, "hours", Number.parseInt(e.target.value, 10) || 0)
                          }
                          min="0"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                          disabled={isSubmitting}
                        />
                      </div>
                      {entries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md mt-5"
                          title="削除"
                          disabled={isSubmitting}
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                          >
                            <title>削除</title>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Form Total */}
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-700">入力合計</span>
                  <span
                    className={`text-lg font-bold ${
                      expectedHours !== null && formTotalHours >= expectedHours
                        ? "text-green-600"
                        : "text-gray-900"
                    }`}
                  >
                    {formTotalHours} 時間
                    {expectedHours !== null && (
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        / {expectedHours} 時間
                      </span>
                    )}
                  </span>
                </div>

                {/* Add Buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => addEntry("project")}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100"
                    disabled={isSubmitting}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                    >
                      <title>追加</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    Project
                  </button>
                  <button
                    type="button"
                    onClick={() => addEntry("anon-project")}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                    disabled={isSubmitting}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                    >
                      <title>追加</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                    Non-Project
                  </button>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "保存中..." : "保存"}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
