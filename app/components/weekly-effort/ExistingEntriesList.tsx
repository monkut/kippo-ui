import { memo, useState, type ReactNode } from "react";
import type { ProjectWeeklyEffort } from "~/lib/api/generated/models";
import { personalHolidaysCreate } from "~/lib/api/generated/personal-holidays/personal-holidays";
import { normalizeDigits } from "./utils";

type ExistingEntriesListProps = {
  selectedWeekEntries: ProjectWeeklyEffort[];
  weekStart: string;
  isSubmitting: boolean;
  onUpdateHours: (entryId: number, hours: number) => Promise<boolean> | void;
  onDelete: (entryId: number) => Promise<boolean> | void;
  onAddEntry: (filterType: "project" | "anon-project") => void;
  onHolidayCreated: () => void;
  children?: ReactNode;
};

function ExistingEntriesListImpl({
  selectedWeekEntries,
  weekStart,
  isSubmitting,
  onUpdateHours,
  onDelete,
  onAddEntry,
  onHolidayCreated,
  children,
}: ExistingEntriesListProps) {
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editingHours, setEditingHours] = useState<string>("");
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);

  const [showInlineHolidayInput, setShowInlineHolidayInput] = useState(false);
  const [inlineHolidayDate, setInlineHolidayDate] = useState("");
  const [inlineIsHalfDay, setInlineIsHalfDay] = useState(false);
  const [isSubmittingInlineHoliday, setIsSubmittingInlineHoliday] = useState(false);

  const selectedWeekTotalHours = selectedWeekEntries.reduce((sum, e) => sum + e.hours, 0);

  const startEditEntry = (entry: ProjectWeeklyEffort) => {
    setEditingEntryId(entry.id);
    setEditingHours(String(entry.hours));
  };

  const cancelEditEntry = () => {
    setEditingEntryId(null);
    setEditingHours("");
  };

  const handleSaveEdit = async (entryId: number) => {
    const result = await onUpdateHours(entryId, parseInt(editingHours, 10) || 0);
    if (result !== false) {
      setEditingEntryId(null);
      setEditingHours("");
    }
  };

  const handleDelete = async (entryId: number) => {
    if (!confirm("このエントリを削除しますか？")) return;
    const result = await onDelete(entryId);
    if (result !== false) {
      setEditingEntryId(null);
    }
  };

  const startInlineHolidayInput = () => {
    setInlineHolidayDate(weekStart);
    setInlineIsHalfDay(false);
    setShowInlineHolidayInput(true);
  };

  const cancelInlineHolidayInput = () => {
    setShowInlineHolidayInput(false);
    setInlineHolidayDate("");
    setInlineIsHalfDay(false);
  };

  const submitInlineHoliday = async () => {
    if (!inlineHolidayDate) return;
    setIsSubmittingInlineHoliday(true);
    try {
      await personalHolidaysCreate({
        day: inlineHolidayDate,
        is_half: inlineIsHalfDay,
      });
      onHolidayCreated();
      cancelInlineHolidayInput();
    } catch {
      // Failed to create holiday
    } finally {
      setIsSubmittingInlineHoliday(false);
    }
  };

  return (
    <section className="bg-white shadow rounded-lg p-6 border-l-4 border-green-400">
      <div
        className="flex justify-between items-center mb-4 group"
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
      >
        <h2 className="text-lg font-medium text-gray-900">登録済みの入力 ({weekStart})</h2>
        <div
          className={`flex gap-2 transition-opacity ${isHeaderHovered ? "opacity-100" : "opacity-0"}`}
        >
          <button
            type="button"
            onClick={() => onAddEntry("project")}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Project
          </button>
          <button
            type="button"
            onClick={() => onAddEntry("anon-project")}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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
              className="group grid grid-cols-[1fr_4rem_auto_3.5rem_6rem] items-center gap-2 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded cursor-pointer"
              onClick={() => !isEditing && !isSubmitting && startEditEntry(entry)}
            >
              <span className="text-gray-700 min-w-0 truncate">{entry.project_name}</span>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={editingHours}
                    onChange={(e) => setEditingHours(normalizeDigits(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm border px-2 py-1 text-right tabular-nums"
                    disabled={isSubmitting}
                    autoFocus
                  />
                  <span className="text-gray-500 text-sm">時間</span>
                  <div className="col-start-5 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveEdit(entry.id);
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
                        handleDelete(entry.id);
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
                  </div>
                </>
              ) : (
                <>
                  <span className="text-right text-gray-900 font-medium tabular-nums pr-2">
                    {entry.hours}
                  </span>
                  <span className="text-gray-900 font-medium text-sm">時間</span>
                  <span className="text-right text-gray-500 text-sm tabular-nums">
                    ({percentage}%)
                  </span>
                  <svg
                    className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity justify-self-end"
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
          );
        })}

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
                <label htmlFor="inline-is-half-day" className="ml-2 block text-sm text-gray-700">
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {children}

        <div className="flex justify-between items-center pt-2 font-medium">
          <span className="text-gray-900">合計</span>
          <span className="text-gray-900">{selectedWeekTotalHours} 時間</span>
        </div>
      </div>
    </section>
  );
}

export const ExistingEntriesList = memo(ExistingEntriesListImpl);
