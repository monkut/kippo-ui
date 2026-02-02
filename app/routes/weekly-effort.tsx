import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "~/lib/auth-context";
import { Layout } from "~/components/layout";
import {
  projectsWeeklyeffortList,
  projectsWeeklyeffortCreate,
  projectsWeeklyeffortPartialUpdate,
  projectsWeeklyeffortDestroy,
} from "~/lib/api/generated/projects/projects";
import {
  personalHolidaysCreate,
  personalHolidaysList,
} from "~/lib/api/generated/personal-holidays/personal-holidays";
import { publicHolidaysList } from "~/lib/api/generated/public-holidays/public-holidays";
import { monthlyAssignmentsList } from "~/lib/api/generated/monthly-assignments/monthly-assignments";
import {
  weeklyEffortExpectedHoursRetrieve,
  weeklyEffortMissingWeeksRetrieve,
} from "~/lib/api/generated/weekly-effort/weekly-effort";
import { fetchAllProjects } from "~/lib/api/pagination";
import type {
  KippoProject,
  ProjectWeeklyEffort,
  ProjectMonthlyAssignment,
  PersonalHoliday,
  PublicHoliday,
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

// Calendar component to display the month with selected week highlighted
// Weeks start on Sunday to match standard calendar display
function WeekCalendar({
  weekStart,
  onWeekSelect,
  personalHolidays = [],
  publicHolidays = [],
}: {
  weekStart: string;
  onWeekSelect: (date: string) => void;
  personalHolidays?: PersonalHoliday[];
  publicHolidays?: PublicHoliday[];
}) {
  const selectedDate = new Date(weekStart);
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  // Get first day of month and last day of month
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Calculate the Sunday of the week containing the first day of the month
  const startDate = new Date(firstDayOfMonth);
  const dayOfWeek = startDate.getDay(); // 0 = Sunday
  startDate.setDate(startDate.getDate() - dayOfWeek);

  // Calculate the Saturday of the week containing the last day of the month
  const endDate = new Date(lastDayOfMonth);
  const lastDayOfWeek = endDate.getDay();
  const daysToSaturday = lastDayOfWeek === 6 ? 0 : 6 - lastDayOfWeek;
  endDate.setDate(endDate.getDate() + daysToSaturday);

  // Generate all dates to display
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // Group dates into weeks (Sunday to Saturday)
  const weeks: Date[][] = [];
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }

  // Check if a date is in the selected week (Monday to Sunday)
  // Compare by date string to avoid timezone issues
  const isInSelectedWeek = (date: Date): boolean => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const weekStartDate = new Date(weekStart + "T00:00:00");
    const weekEndDate = new Date(weekStart + "T00:00:00");
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekStartStr = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, "0")}-${String(weekStartDate.getDate()).padStart(2, "0")}`;
    const weekEndStr = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, "0")}-${String(weekEndDate.getDate()).padStart(2, "0")}`;
    return dateStr >= weekStartStr && dateStr <= weekEndStr;
  };

  // Get Monday of the week containing a date (for week selection)
  const getMondayOfWeek = (date: Date): string => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? 1 : day === 1 ? 0 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split("T")[0];
  };

  const monthNames = [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ];

  // Day headers starting with Sunday
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  // Create sets for quick holiday lookup
  const personalHolidayDates = new Set(personalHolidays.map((h) => h.day));
  const publicHolidayDates = new Set(publicHolidays.map((h) => h.day));
  const publicHolidayNames = new Map(publicHolidays.map((h) => [h.day, h.name]));

  const formatDateStr = (d: Date): string => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <div className="bg-white rounded-lg">
      {/* Month/Year header */}
      <div className="text-center font-medium text-gray-900 mb-3">
        {year}年 {monthNames[month]}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((day, idx) => (
          <div
            key={day}
            className={`text-center text-xs font-medium py-1 ${
              idx === 0 ? "text-red-600" : idx === 6 ? "text-blue-600" : "text-gray-500"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="space-y-1">
        {weeks.map((week, weekIdx) => {
          // Get Monday of this display week (second day since week starts Sunday)
          const weekMonday = getMondayOfWeek(week[1]);
          // Check if Monday (index 1) is in the selected week
          const isSelectedWeek = isInSelectedWeek(week[1]);

          return (
            <button
              key={weekIdx}
              type="button"
              onClick={() => onWeekSelect(weekMonday)}
              className={`grid grid-cols-7 gap-1 w-full rounded-md transition-colors ${
                isSelectedWeek ? "bg-indigo-100 ring-2 ring-indigo-500" : "hover:bg-gray-50"
              }`}
            >
              {week.map((date, dayIdx) => {
                const isCurrentMonth = date.getMonth() === month;
                const isToday = date.toDateString() === new Date().toDateString();
                const dateStr = formatDateStr(date);
                const isPublicHoliday = publicHolidayDates.has(dateStr);
                const isPersonalHoliday = personalHolidayDates.has(dateStr);
                const holidayName = publicHolidayNames.get(dateStr);

                let textClass = "text-gray-700";
                let bgClass = "";

                if (!isCurrentMonth) {
                  textClass = "text-gray-300";
                } else if (isPublicHoliday) {
                  textClass = "text-red-700 font-medium";
                  bgClass = "bg-red-100 rounded";
                } else if (isPersonalHoliday) {
                  textClass = "text-purple-700 font-medium";
                  bgClass = "bg-purple-100 rounded";
                } else if (isToday) {
                  textClass = "font-bold text-indigo-600";
                } else if (dayIdx === 0) {
                  textClass = "text-red-600";
                } else if (dayIdx === 6) {
                  textClass = "text-blue-600";
                }

                return (
                  <div
                    key={dayIdx}
                    className={`text-center text-sm py-1.5 ${textClass} ${bgClass}`}
                    title={holidayName || undefined}
                  >
                    {date.getDate()}
                  </div>
                );
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Calendar component for holiday selection with existing holidays highlighted
function HolidayCalendar({
  selectedDate,
  onDateSelect,
  personalHolidays,
  publicHolidays,
  disabled,
}: {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  personalHolidays: PersonalHoliday[];
  publicHolidays: PublicHoliday[];
  disabled?: boolean;
}) {
  const date = new Date(selectedDate + "T00:00:00");
  const year = date.getFullYear();
  const month = date.getMonth();

  // Get first and last days of month
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Calculate start of calendar (Sunday before first day)
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  // Calculate end of calendar (Saturday after last day)
  const endDate = new Date(lastDayOfMonth);
  const daysToSaturday = endDate.getDay() === 6 ? 0 : 6 - endDate.getDay();
  endDate.setDate(endDate.getDate() + daysToSaturday);

  // Generate all dates
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // Group into weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }

  // Create sets for quick lookup
  const personalHolidayDates = new Set(personalHolidays.map((h) => h.day));
  const publicHolidayDates = new Set(publicHolidays.map((h) => h.day));
  const publicHolidayNames = new Map(publicHolidays.map((h) => [h.day, h.name]));

  const formatDate = (d: Date): string => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const monthNames = [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ];
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  const navigateMonth = (delta: number) => {
    const newDate = new Date(year, month + delta, 1);
    onDateSelect(formatDate(newDate));
  };

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => navigateMonth(-1)}
          className="p-1 hover:bg-gray-200 rounded"
          disabled={disabled}
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <title>前月</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <span className="font-medium text-gray-900">
          {year}年 {monthNames[month]}
        </span>
        <button
          type="button"
          onClick={() => navigateMonth(1)}
          className="p-1 hover:bg-gray-200 rounded"
          disabled={disabled}
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <title>次月</title>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((day, idx) => (
          <div
            key={day}
            className={`text-center text-xs font-medium py-1 ${
              idx === 0 ? "text-red-600" : idx === 6 ? "text-blue-600" : "text-gray-500"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="space-y-1">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 gap-1">
            {week.map((day) => {
              const dateStr = formatDate(day);
              const isCurrentMonth = day.getMonth() === month;
              const isSelected = dateStr === selectedDate;
              const isPersonalHoliday = personalHolidayDates.has(dateStr);
              const isPublicHoliday = publicHolidayDates.has(dateStr);
              const publicHolidayName = publicHolidayNames.get(dateStr);
              const dayOfWeek = day.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              let bgClass = "bg-white hover:bg-gray-100";
              let textClass = isCurrentMonth ? "text-gray-900" : "text-gray-300";

              if (isPublicHoliday && isCurrentMonth) {
                bgClass = "bg-red-100 hover:bg-red-200";
                textClass = "text-red-700";
              } else if (isPersonalHoliday && isCurrentMonth) {
                bgClass = "bg-purple-100 hover:bg-purple-200";
                textClass = "text-purple-700";
              } else if (isWeekend && isCurrentMonth) {
                textClass = dayOfWeek === 0 ? "text-red-500" : "text-blue-500";
              }

              if (isSelected) {
                bgClass = "bg-amber-500 hover:bg-amber-600";
                textClass = "text-white font-bold";
              }

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => onDateSelect(dateStr)}
                  disabled={disabled}
                  title={publicHolidayName || undefined}
                  className={`p-2 text-sm rounded ${bgClass} ${textClass} disabled:opacity-50`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected date display */}
      <div className="mt-3 text-center text-sm text-gray-600">
        選択日: <span className="font-medium text-gray-900">{selectedDate}</span>
      </div>
    </div>
  );
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

  // Edit mode states
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editingHours, setEditingHours] = useState<string>("");
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);

  // Inline personal holiday input states
  const [showInlineHolidayInput, setShowInlineHolidayInput] = useState(false);
  const [inlineHolidayDate, setInlineHolidayDate] = useState("");
  const [inlineIsHalfDay, setInlineIsHalfDay] = useState(false);
  const [isSubmittingInlineHoliday, setIsSubmittingInlineHoliday] = useState(false);

  // Personal holiday modal states
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayDate, setHolidayDate] = useState(weekStart);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [isSubmittingHoliday, setIsSubmittingHoliday] = useState(false);
  const [holidayError, setHolidayError] = useState("");
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [existingPersonalHolidays, setExistingPersonalHolidays] = useState<PersonalHoliday[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);

  // Week holidays for display in form
  const [weekPersonalHolidays, setWeekPersonalHolidays] = useState<PersonalHoliday[]>([]);
  const [weekPublicHolidays, setWeekPublicHolidays] = useState<PublicHoliday[]>([]);
  const [isLoadingWeekHolidays, setIsLoadingWeekHolidays] = useState(false);

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

  // Fetch holidays for the selected week (Monday to Sunday)
  const fetchWeekHolidays = useCallback(async (weekStartDate: string) => {
    setIsLoadingWeekHolidays(true);
    try {
      const startDate = new Date(weekStartDate + "T00:00:00");
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6); // Sunday of the week

      const dayGte = weekStartDate;
      const dayLte = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

      const [personalRes, publicRes] = await Promise.all([
        personalHolidaysList({ day_gte: dayGte, day_lte: dayLte }),
        publicHolidaysList({ day_gte: dayGte, day_lte: dayLte }),
      ]);

      setWeekPersonalHolidays(personalRes.data?.results || []);
      setWeekPublicHolidays(publicRes.data?.results || []);
    } catch {
      // Failed to fetch week holidays
      setWeekPersonalHolidays([]);
      setWeekPublicHolidays([]);
    } finally {
      setIsLoadingWeekHolidays(false);
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
        // Note: fetchAllProjects handles pagination internally to retrieve all projects
        // We fetch all projects (not just active) to allow effort logging for projects at any confidence level
        const [allProjects, weeklyEffortRes, assignmentsRes, missingWeeksRes, expectedHoursRes] =
          await Promise.all([
            fetchAllProjects(),
            projectsWeeklyeffortList({ user_username: user?.username }),
            monthlyAssignmentsList({ month: getCurrentMonthStart() }),
            weeklyEffortMissingWeeksRetrieve().catch(() => null),
            weeklyEffortExpectedHoursRetrieve({ week_start: weekStart }).catch(() => null),
          ]);

        // Process projects (allProjects is already the complete array from all pages)
        setProjects(allProjects);

        // Process expected hours
        if (expectedHoursRes?.status === 200) {
          setExpectedHours(expectedHoursRes.data.expected_hours ?? null);
        }

        // Process missing weeks
        if (missingWeeksRes?.status === 200 && missingWeeksRes.data.missing_weeks) {
          setMissingWeeks(missingWeeksRes.data.missing_weeks);
        }

        // Process weekly effort entries for the current user (filtered server-side by user_username)
        if (weeklyEffortRes.data?.results) {
          const userEntries = weeklyEffortRes.data.results;
          setAllUserEntries(userEntries);

          // Find entries for the selected week
          const entriesForSelectedWeek = userEntries.filter((e) => e.week_start === weekStart);
          setSelectedWeekEntries(entriesForSelectedWeek);

          // Auto-populate form entries (or clear if existing entries for week)
          const projectsMap = new Map(allProjects.map((p) => [p.id, p]));
          if (entriesForSelectedWeek.length > 0) {
            // Selected week has entries - clear form (edit via existing entries UI)
            setEntries([]);
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

  // Refetch expected hours and update form entries when week_start changes
  useEffect(() => {
    if (!weekStart || projects.length === 0) return;

    const updateWeekData = async () => {
      fetchExpectedHours(weekStart);
      fetchWeekHolidays(weekStart);

      // Fetch entries for the previous week from API (to use as template)
      // Use Sunday dates for range to properly capture Monday week_start values
      const selectedDate = new Date(weekStart + "T00:00:00");
      // Sunday before the previous week's Monday
      const sundayBeforePrevWeek = new Date(selectedDate);
      sundayBeforePrevWeek.setDate(sundayBeforePrevWeek.getDate() - 8);
      const prevWeekGte = `${sundayBeforePrevWeek.getFullYear()}-${String(sundayBeforePrevWeek.getMonth() + 1).padStart(2, "0")}-${String(sundayBeforePrevWeek.getDate()).padStart(2, "0")}`;
      // Sunday before the selected week's Monday (excludes selected week)
      const sundayBeforeSelectedWeek = new Date(selectedDate);
      sundayBeforeSelectedWeek.setDate(sundayBeforeSelectedWeek.getDate() - 1);
      const prevWeekLte = `${sundayBeforeSelectedWeek.getFullYear()}-${String(sundayBeforeSelectedWeek.getMonth() + 1).padStart(2, "0")}-${String(sundayBeforeSelectedWeek.getDate()).padStart(2, "0")}`;

      try {
        // Fetch previous week entries for current user (to use as template)
        const weeklyEffortRes = await projectsWeeklyeffortList({
          user_username: user?.username,
          week_start_gte: prevWeekGte,
          week_start_lte: prevWeekLte,
        });

        const projectsMap = new Map(projects.map((p) => [p.id, p]));
        const previousWeekEntries = weeklyEffortRes.data?.results || [];

        // Get selected week entries from allUserEntries (already loaded)
        const entriesForSelectedWeek = allUserEntries.filter((e) => e.week_start === weekStart);
        setSelectedWeekEntries(entriesForSelectedWeek);

        if (entriesForSelectedWeek.length > 0) {
          // Selected week has entries - clear form (edit via existing entries UI)
          setEntries([]);
        } else if (previousWeekEntries.length > 0) {
          // Use previous week's entries as template (hours reset to 0)
          const formEntries: FormEntry[] = previousWeekEntries.map((e, idx) => {
            const project = projectsMap.get(e.project);
            const filterType: "project" | "anon-project" =
              project?.phase === "anon-project" ? "anon-project" : "project";
            return {
              id: Date.now() + idx,
              projectId: e.project,
              projectName: e.project_name,
              hours: 0,
              filterType,
            };
          });
          setEntries(formEntries);
        } else {
          // No previous week data - use latest from allUserEntries as fallback
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
                hours: 0,
                filterType,
              };
            });
            setEntries(formEntries);
          } else {
            setEntries([createEmptyEntry()]);
          }
        }
      } catch {
        // Failed to fetch week data - keep current entries
      }
    };

    updateWeekData();
  }, [weekStart, fetchExpectedHours, fetchWeekHolidays, projects, user, allUserEntries]);

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
    setEntries([
      ...entries,
      {
        id: Date.now(),
        projectId: "",
        projectName: "",
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

  // Start editing an existing entry
  const startEditEntry = (entry: ProjectWeeklyEffort) => {
    setEditingEntryId(entry.id);
    setEditingHours(String(entry.hours));
  };

  // Cancel editing
  const cancelEditEntry = () => {
    setEditingEntryId(null);
    setEditingHours("");
  };

  // Start inline holiday input
  const startInlineHolidayInput = () => {
    setInlineHolidayDate(weekStart);
    setInlineIsHalfDay(false);
    setShowInlineHolidayInput(true);
  };

  // Cancel inline holiday input
  const cancelInlineHolidayInput = () => {
    setShowInlineHolidayInput(false);
    setInlineHolidayDate("");
    setInlineIsHalfDay(false);
  };

  // Submit inline holiday
  const submitInlineHoliday = async () => {
    if (!inlineHolidayDate) return;

    setIsSubmittingInlineHoliday(true);
    try {
      await personalHolidaysCreate({
        day: inlineHolidayDate,
        is_half: inlineIsHalfDay,
      });

      // Refresh data
      fetchExpectedHours(weekStart);
      fetchWeekHolidays(weekStart);
      cancelInlineHolidayInput();
    } catch {
      // Failed to create holiday
    } finally {
      setIsSubmittingInlineHoliday(false);
    }
  };

  // Save updated entry
  const saveEditEntry = async (entryId: number) => {
    setIsSubmitting(true);
    setError("");
    try {
      await projectsWeeklyeffortPartialUpdate(entryId, { hours: parseInt(editingHours, 10) || 0 });

      // Refresh data
      const weeklyEffortRes = await projectsWeeklyeffortList({ user_username: user?.username });
      if (weeklyEffortRes.data?.results) {
        const userEntries = weeklyEffortRes.data.results;
        setAllUserEntries(userEntries);
        setSelectedWeekEntries(userEntries.filter((e) => e.week_start === weekStart));
      }

      setEditingEntryId(null);
      setEditingHours("");
    } catch {
      setError("更新に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete an existing entry
  const deleteEntry = async (entryId: number) => {
    if (!confirm("このエントリを削除しますか？")) return;

    setIsSubmitting(true);
    setError("");
    try {
      await projectsWeeklyeffortDestroy(entryId);

      // Refresh data
      const [weeklyEffortRes, missingWeeksRes] = await Promise.all([
        projectsWeeklyeffortList({ user_username: user?.username }),
        weeklyEffortMissingWeeksRetrieve(),
      ]);

      if (weeklyEffortRes.data?.results) {
        const userEntries = weeklyEffortRes.data.results;
        setAllUserEntries(userEntries);
        setSelectedWeekEntries(userEntries.filter((e) => e.week_start === weekStart));
      }

      if (missingWeeksRes.status === 200 && missingWeeksRes.data.missing_weeks) {
        setMissingWeeks(missingWeeksRes.data.missing_weeks);
      }

      setEditingEntryId(null);
    } catch {
      setError("削除に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
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

      // Check for duplicates by fetching existing entries for this week for current user
      const existingRes = await projectsWeeklyeffortList({
        user_username: user?.username,
        week_start_gte: weekStart,
        week_start_lte: weekStart,
      });

      const existingForUser = existingRes.data?.results || [];

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
          hours: entry.hours,
        });
      }

      // Refresh data after successful submission (without full page reload)
      const [weeklyEffortRes, missingWeeksRes] = await Promise.all([
        projectsWeeklyeffortList({ user_username: user?.username }),
        weeklyEffortMissingWeeksRetrieve(),
      ]);

      // Update user entries
      if (weeklyEffortRes.data?.results) {
        const userEntries = weeklyEffortRes.data.results;
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

  // Open holiday modal with date defaulting to week start
  // Fetch holidays for the modal calendar
  const fetchHolidaysForMonth = async (dateStr: string) => {
    setIsLoadingHolidays(true);
    try {
      const date = new Date(dateStr + "T00:00:00");
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const dayGte = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, "0")}-01`;
      const dayLte = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

      const [personalRes, publicRes] = await Promise.all([
        personalHolidaysList({ day_gte: dayGte, day_lte: dayLte }),
        publicHolidaysList({ day_gte: dayGte, day_lte: dayLte }),
      ]);

      if (personalRes.data?.results) {
        setExistingPersonalHolidays(personalRes.data.results);
      }
      if (publicRes.data?.results) {
        setPublicHolidays(publicRes.data.results);
      }
    } catch {
      // Failed to fetch holidays, continue without them
    } finally {
      setIsLoadingHolidays(false);
    }
  };

  const openHolidayModal = () => {
    setHolidayDate(weekStart);
    setIsHalfDay(false);
    setHolidayError("");
    setExistingPersonalHolidays([]);
    setPublicHolidays([]);
    setShowHolidayModal(true);
    fetchHolidaysForMonth(weekStart);
  };

  // Submit personal holiday
  const handleSubmitHoliday = async () => {
    setIsSubmittingHoliday(true);
    setHolidayError("");

    try {
      await personalHolidaysCreate({
        day: holidayDate,
        is_half: isHalfDay,
      });

      // Close modal and refresh expected hours and week holidays
      setShowHolidayModal(false);
      fetchExpectedHours(weekStart);
      fetchWeekHolidays(weekStart);
    } catch {
      setHolidayError("休日の登録に失敗しました");
    } finally {
      setIsSubmittingHoliday(false);
    }
  };

  // Calculate total hours for selected week entries
  const selectedWeekTotalHours = selectedWeekEntries.reduce((sum, e) => sum + e.hours, 0);

  // Calculate total hours for form entries
  const formTotalHours = entries.reduce((sum, e) => sum + e.hours, 0);

  // Helper to check if a project should be displayed for the selected week
  // Projects are shown if they have no closed_datetime OR if week_start <= closed_datetime
  const isProjectOpenForWeek = (project: KippoProject): boolean => {
    if (!project.closed_datetime) return true;
    return weekStart <= project.closed_datetime.split("T")[0];
  };

  // Filter projects for dropdowns
  // Show projects where closed_datetime is null OR week_start <= closed_datetime
  // Sort alphabetically by name for consistent ordering
  const projectProjects = projects
    .filter((p) => p.phase !== "anon-project" && isProjectOpenForWeek(p))
    .sort((a, b) => a.name.localeCompare(b.name));
  const nonProjectProjects = projects
    .filter((p) => p.phase === "anon-project" && isProjectOpenForWeek(p))
    .sort((a, b) => a.name.localeCompare(b.name));

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
            {/* Expected Hours and Calendar Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Expected Hours */}
              <section className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">期待稼働時間</h2>
                <div className="text-3xl font-bold text-indigo-600">
                  {expectedHours === null ? "---" : `${expectedHours} 時間`}
                </div>
                <p className="text-sm text-gray-500 mt-1">週開始日: {weekStart}</p>

                {/* Week Holidays Display */}
                {!isLoadingWeekHolidays &&
                  (weekPublicHolidays.length > 0 || weekPersonalHolidays.length > 0) && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-500 mb-2">今週の休日</div>
                      <div className="flex flex-wrap gap-1.5">
                        {weekPublicHolidays.map((h) => (
                          <span
                            key={`pub-${h.id}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
                            title={h.name}
                          >
                            {h.day.substring(5)} {h.name}
                          </span>
                        ))}
                        {weekPersonalHolidays.map((h) => (
                          <span
                            key={`per-${h.id}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                          >
                            {h.day.substring(5)} {h.is_half ? "半休" : "全休"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </section>

              {/* Calendar */}
              <section className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">カレンダー</h2>
                <WeekCalendar
                  weekStart={weekStart}
                  onWeekSelect={setWeekStart}
                  personalHolidays={weekPersonalHolidays}
                  publicHolidays={weekPublicHolidays}
                />
                {/* Legend */}
                <div className="mt-3 flex gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-red-100 border border-red-300" />
                    <span className="text-gray-600">祝日</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-purple-100 border border-purple-300" />
                    <span className="text-gray-600">個人休日</span>
                  </div>
                </div>
              </section>
            </div>

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
                <div
                  className="flex justify-between items-center mb-4 group"
                  onMouseEnter={() => setIsHeaderHovered(true)}
                  onMouseLeave={() => setIsHeaderHovered(false)}
                >
                  <h2 className="text-lg font-medium text-gray-900">
                    登録済みの入力 ({weekStart})
                  </h2>
                  <div
                    className={`flex gap-2 transition-opacity ${isHeaderHovered ? "opacity-100" : "opacity-0"}`}
                  >
                    <button
                      type="button"
                      onClick={() => addEntry("project")}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100"
                      disabled={isSubmitting}
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
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
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                      disabled={isSubmitting}
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
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
                    <button
                      type="button"
                      onClick={startInlineHolidayInput}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded hover:bg-amber-100 border border-amber-200"
                      disabled={isSubmitting || showInlineHolidayInput}
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                      >
                        <title>休日追加</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 4.5v15m7.5-7.5h-15"
                        />
                      </svg>
                      個人休日
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedWeekEntries.map((entry) => {
                    const percentage =
                      selectedWeekTotalHours > 0
                        ? Math.round((entry.hours / selectedWeekTotalHours) * 100)
                        : 0;
                    const isEditing = editingEntryId === entry.id;

                    return (
                      <div
                        key={entry.id}
                        className="group flex justify-between items-center py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded cursor-pointer"
                        onClick={() => !isEditing && !isSubmitting && startEditEntry(entry)}
                      >
                        <span className="text-gray-700">{entry.project_name}</span>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={editingHours}
                                onChange={(e) =>
                                  setEditingHours(e.target.value.replace(/[^0-9]/g, ""))
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="w-20 rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm border px-2 py-1"
                                disabled={isSubmitting}
                                autoFocus
                              />
                              <span className="text-gray-500 text-sm">時間</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveEditEntry(entry.id);
                                }}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                disabled={isSubmitting}
                                title="保存"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth="2"
                                  stroke="currentColor"
                                >
                                  <title>保存</title>
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M4.5 12.75l6 6 9-13.5"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEditEntry();
                                }}
                                className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                disabled={isSubmitting}
                                title="キャンセル"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth="2"
                                  stroke="currentColor"
                                >
                                  <title>キャンセル</title>
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteEntry(entry.id);
                                }}
                                className="p-1 text-red-400 hover:bg-red-50 hover:text-red-600 rounded"
                                disabled={isSubmitting}
                                title="削除"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth="2"
                                  stroke="currentColor"
                                >
                                  <title>削除</title>
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                  />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="text-right">
                                <span className="text-gray-900 font-medium">
                                  {entry.hours} 時間
                                </span>
                                <span className="text-gray-500 text-sm ml-2">({percentage}%)</span>
                              </div>
                              <svg
                                className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="2"
                                stroke="currentColor"
                              >
                                <title>編集</title>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                                />
                              </svg>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Inline Personal Holiday Input Form */}
                  {showInlineHolidayInput && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-amber-700">個人休日を追加</span>
                        <button
                          type="button"
                          onClick={cancelInlineHolidayInput}
                          className="text-xs text-gray-500 hover:text-gray-700"
                          disabled={isSubmittingInlineHoliday}
                        >
                          キャンセル
                        </button>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-md">
                        <div className="flex-1">
                          <label
                            htmlFor="inline-holiday-date"
                            className="block text-xs font-medium text-gray-500 mb-1"
                          >
                            日付
                          </label>
                          <input
                            type="date"
                            id="inline-holiday-date"
                            value={inlineHolidayDate}
                            onChange={(e) => setInlineHolidayDate(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm border px-3 py-2"
                            disabled={isSubmittingInlineHoliday}
                          />
                        </div>
                        <div className="flex items-center mt-5">
                          <input
                            type="checkbox"
                            id="inline-is-half-day"
                            checked={inlineIsHalfDay}
                            onChange={(e) => setInlineIsHalfDay(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            disabled={isSubmittingInlineHoliday}
                          />
                          <label
                            htmlFor="inline-is-half-day"
                            className="ml-2 block text-sm text-gray-700"
                          >
                            半休
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={submitInlineHoliday}
                          className="mt-5 p-2 text-amber-600 hover:bg-amber-100 rounded-md"
                          disabled={isSubmittingInlineHoliday || !inlineHolidayDate}
                          title="保存"
                        >
                          {isSubmittingInlineHoliday ? (
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                              <title>保存中</title>
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="2"
                              stroke="currentColor"
                            >
                              <title>保存</title>
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4.5 12.75l6 6 9-13.5"
                              />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={cancelInlineHolidayInput}
                          className="mt-5 p-2 text-gray-400 hover:bg-gray-100 rounded-md"
                          disabled={isSubmittingInlineHoliday}
                          title="キャンセル"
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="2"
                            stroke="currentColor"
                          >
                            <title>キャンセル</title>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Add Entry Form - shows when adding new entries to existing week */}
                  {entries.length > 0 && (
                    <form
                      onSubmit={handleSubmit}
                      className="mt-4 pt-4 border-t border-gray-200 space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">新規入力</span>
                        <button
                          type="button"
                          onClick={() => setEntries([])}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          キャンセル
                        </button>
                      </div>
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
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              id={`hours-${entry.id}`}
                              value={entry.hours === 0 ? "" : entry.hours}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9]/g, "");
                                updateEntry(
                                  entry.id,
                                  "hours",
                                  value === "" ? 0 : parseInt(value, 10),
                                );
                              }}
                              placeholder="0"
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
                      <button
                        type="submit"
                        className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "保存中..." : "保存"}
                      </button>
                    </form>
                  )}

                  <div className="flex justify-between items-center pt-2 font-medium">
                    <span className="text-gray-900">合計</span>
                    <span className="text-gray-900">{selectedWeekTotalHours} 時間</span>
                  </div>
                </div>
              </section>
            )}

            {/* Input Entries Section - only show when no existing entries */}
            {selectedWeekEntries.length === 0 && (
              <section className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">稼働入力</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            id={`hours-${entry.id}`}
                            value={entry.hours === 0 ? "" : entry.hours}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, "");
                              updateEntry(
                                entry.id,
                                "hours",
                                value === "" ? 0 : parseInt(value, 10),
                              );
                            }}
                            placeholder="0"
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
                  <div className="flex flex-wrap gap-3">
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
                    <button
                      type="button"
                      onClick={openHolidayModal}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-md hover:bg-amber-100 border border-amber-200"
                      disabled={isSubmitting}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                      >
                        <title>休日追加</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 4.5v15m7.5-7.5h-15"
                        />
                      </svg>
                      個人休日
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
            )}
          </>
        )}

        {/* Personal Holiday Modal */}
        {showHolidayModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div
              className="fixed inset-0 bg-black bg-opacity-25"
              onClick={() => setShowHolidayModal(false)}
            />
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">個人休日を追加</h3>

                {holidayError && (
                  <div className="mb-4 rounded-md bg-red-50 p-3">
                    <div className="text-sm text-red-800">{holidayError}</div>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Holiday Calendar */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      日付を選択
                    </label>
                    {isLoadingHolidays ? (
                      <div className="text-center py-4 text-gray-500">読み込み中...</div>
                    ) : (
                      <HolidayCalendar
                        selectedDate={holidayDate}
                        onDateSelect={(date) => {
                          setHolidayDate(date);
                          // Fetch holidays if month changed
                          const newMonth = date.substring(0, 7);
                          const currentMonth = holidayDate.substring(0, 7);
                          if (newMonth !== currentMonth) {
                            fetchHolidaysForMonth(date);
                          }
                        }}
                        personalHolidays={existingPersonalHolidays}
                        publicHolidays={publicHolidays}
                        disabled={isSubmittingHoliday}
                      />
                    )}
                  </div>

                  {/* Legend */}
                  <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-red-100 border border-red-300" />
                      <span className="text-gray-600">祝日</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-purple-100 border border-purple-300" />
                      <span className="text-gray-600">個人休日</span>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is-half-day"
                      checked={isHalfDay}
                      onChange={(e) => setIsHalfDay(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      disabled={isSubmittingHoliday}
                    />
                    <label htmlFor="is-half-day" className="ml-2 block text-sm text-gray-700">
                      半休
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowHolidayModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={isSubmittingHoliday}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitHoliday}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmittingHoliday}
                  >
                    {isSubmittingHoliday ? "登録中..." : "登録"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
