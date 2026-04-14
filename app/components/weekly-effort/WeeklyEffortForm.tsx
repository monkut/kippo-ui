import { memo, useMemo, type FormEvent } from "react";
import type { KippoProject } from "~/lib/api/generated/models";
import type { FormEntry } from "./types";
import { normalizeDigits } from "./utils";

type WeeklyEffortFormProps = {
  entries: FormEntry[];
  onEntriesChange: (entries: FormEntry[]) => void;
  projects: KippoProject[];
  weekStart: string;
  onWeekStartChange?: (weekStart: string) => void;
  expectedHours: number | null;
  isSubmitting: boolean;
  onSubmit: () => void;
  onAddEntry: (filterType: "project" | "anon-project") => void;
  onOpenHolidayModal?: () => void;
  variant: "inline" | "full";
};

function WeeklyEffortFormImpl({
  entries,
  onEntriesChange,
  projects,
  weekStart,
  onWeekStartChange,
  expectedHours,
  isSubmitting,
  onSubmit,
  onAddEntry,
  onOpenHolidayModal,
  variant,
}: WeeklyEffortFormProps) {
  const { projectProjects, nonProjectProjects } = useMemo(() => {
    const isProjectOpenForWeek = (project: KippoProject): boolean => {
      if (!project.closed_datetime) return true;
      return weekStart <= project.closed_datetime.split("T")[0];
    };
    return {
      projectProjects: projects
        .filter((p) => p.phase !== "anon-project" && isProjectOpenForWeek(p))
        .sort((a, b) => a.name.localeCompare(b.name)),
      nonProjectProjects: projects
        .filter((p) => p.phase === "anon-project" && isProjectOpenForWeek(p))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [projects, weekStart]);

  const formTotalHours = useMemo(() => entries.reduce((sum, e) => sum + e.hours, 0), [entries]);

  const updateEntry = (id: number, field: keyof FormEntry, value: string | number) => {
    onEntriesChange(
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

  const removeEntry = (id: number) => {
    if (entries.length > 1) {
      onEntriesChange(entries.filter((e) => e.id !== id));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const entryRows = (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
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
              {(entry.filterType === "anon-project" ? nonProjectProjects : projectProjects).map(
                (p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ),
              )}
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
              value={entry.hours === 0 ? "" : String(entry.hours)}
              onChange={(e) => {
                const value = normalizeDigits(e.target.value);
                updateEntry(entry.id, "hours", value === "" ? 0 : parseInt(value, 10));
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );

  if (variant === "inline") {
    if (entries.length === 0) return null;
    return (
      <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-gray-200 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">新規入力</span>
          <button
            type="button"
            onClick={() => onEntriesChange([])}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            キャンセル
          </button>
        </div>
        {entryRows}
        <button
          type="submit"
          className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting}
        >
          {isSubmitting ? "保存中..." : "保存"}
        </button>
      </form>
    );
  }

  return (
    <section className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">稼働入力</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="week-start" className="block text-sm font-medium text-gray-700 mb-1">
            週開始日 (月曜日)
          </label>
          <input
            type="date"
            id="week-start"
            value={weekStart}
            onChange={(e) => onWeekStartChange?.(e.target.value)}
            className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
            disabled={isSubmitting}
          />
        </div>

        {entryRows}

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
              <span className="text-sm font-normal text-gray-500 ml-2">/ {expectedHours} 時間</span>
            )}
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onAddEntry("project")}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Project
          </button>
          <button
            type="button"
            onClick={() => onAddEntry("anon-project")}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Non-Project
          </button>
          {onOpenHolidayModal && (
            <button
              type="button"
              onClick={onOpenHolidayModal}
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              個人休日
            </button>
          )}
        </div>

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
  );
}

export const WeeklyEffortForm = memo(WeeklyEffortFormImpl);
