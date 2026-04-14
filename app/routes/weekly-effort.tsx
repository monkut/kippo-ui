import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "~/lib/auth-context";
import { Layout } from "~/components/layout";
import { WeekCalendar } from "~/components/weekly-effort/WeekCalendar";
import { MissingWeeksPanel } from "~/components/weekly-effort/MissingWeeksPanel";
import { MonthlyAssignmentsPanel } from "~/components/weekly-effort/MonthlyAssignmentsPanel";
import { ExistingEntriesList } from "~/components/weekly-effort/ExistingEntriesList";
import { WeeklyEffortForm } from "~/components/weekly-effort/WeeklyEffortForm";
import { HolidayModal } from "~/components/weekly-effort/HolidayModal";
import { createEmptyEntry, getPreviousWeekStartDate } from "~/components/weekly-effort/utils";
import type { FormEntry } from "~/components/weekly-effort/types";
import { useWeeklyEffort } from "~/hooks/useWeeklyEffort";

export function meta() {
  return [{ title: "週間稼働量 - Kippo" }];
}

export default function WeeklyEffort() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [weekStart, setWeekStart] = useState(getPreviousWeekStartDate());
  const [entries, setEntries] = useState<FormEntry[]>([]);
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);

  const {
    isLoading,
    isSubmitting,
    error,
    projects,
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
  } = useWeeklyEffort(user, weekStart);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Sync template entries from hook into local form state whenever week / data changes
  useEffect(() => {
    setEntries(templateEntries);
  }, [templateEntries]);

  const handleAddEntry = useCallback((filterType: "project" | "anon-project") => {
    setEntries((prev) => [
      ...prev,
      {
        id: Date.now(),
        projectId: "",
        projectName: "",
        hours: 0,
        filterType,
      },
    ]);
  }, []);

  const handleSubmit = useCallback(async () => {
    const ok = await createEntries(entries, weekStart);
    if (ok) {
      setEntries([createEmptyEntry()]);
    }
  }, [createEntries, entries, weekStart]);

  const handleUpdateHours = useCallback(
    (entryId: number, hours: number) => updateEntryHours(entryId, hours, weekStart),
    [updateEntryHours, weekStart],
  );

  const handleDelete = useCallback(
    (entryId: number) => deleteEntry(entryId, weekStart),
    [deleteEntry, weekStart],
  );

  const handleHolidayChanged = useCallback(() => {
    refreshAfterHolidayChange(weekStart);
  }, [refreshAfterHolidayChange, weekStart]);

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

  const hasExistingEntries = selectedWeekEntries.length > 0;

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">期待稼働時間</h2>
                <div className="text-3xl font-bold text-indigo-600">
                  {expectedHours === null ? "---" : `${expectedHours} 時間`}
                </div>
                <p className="text-sm text-gray-500 mt-1">週開始日: {weekStart}</p>

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

              <section className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">カレンダー</h2>
                <WeekCalendar
                  weekStart={weekStart}
                  onWeekSelect={setWeekStart}
                  personalHolidays={weekPersonalHolidays}
                  publicHolidays={weekPublicHolidays}
                />
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

            <MissingWeeksPanel missingWeeks={missingWeeks} onWeekSelect={setWeekStart} />
            <MonthlyAssignmentsPanel monthlyAssignments={monthlyAssignments} />

            {hasExistingEntries && (
              <ExistingEntriesList
                selectedWeekEntries={selectedWeekEntries}
                weekStart={weekStart}
                isSubmitting={isSubmitting}
                onUpdateHours={handleUpdateHours}
                onDelete={handleDelete}
                onAddEntry={handleAddEntry}
                onHolidayCreated={handleHolidayChanged}
              >
                <WeeklyEffortForm
                  variant="inline"
                  entries={entries}
                  onEntriesChange={setEntries}
                  projects={projects}
                  weekStart={weekStart}
                  expectedHours={expectedHours}
                  isSubmitting={isSubmitting}
                  onSubmit={handleSubmit}
                  onAddEntry={handleAddEntry}
                />
              </ExistingEntriesList>
            )}

            {!hasExistingEntries && (
              <WeeklyEffortForm
                variant="full"
                entries={entries}
                onEntriesChange={setEntries}
                projects={projects}
                weekStart={weekStart}
                onWeekStartChange={setWeekStart}
                expectedHours={expectedHours}
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
                onAddEntry={handleAddEntry}
                onOpenHolidayModal={() => setHolidayModalOpen(true)}
              />
            )}
          </>
        )}

        <HolidayModal
          open={holidayModalOpen}
          initialDate={weekStart}
          onClose={() => setHolidayModalOpen(false)}
          onHolidayCreated={handleHolidayChanged}
        />
      </div>
    </Layout>
  );
}
