import { memo, useMemo } from "react";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";

type MonthlyAssignmentsPanelProps = {
  monthlyAssignments: ProjectMonthlyAssignment[];
  /** Saved cumulative effort hours for the target month, keyed by project id. */
  monthHoursByProject: Record<string, number>;
  /** Target month (YYYY-MM-DD, first day) the panel reflects. */
  targetMonth: string;
};

function MonthlyAssignmentsPanelImpl({
  monthlyAssignments,
  monthHoursByProject,
  targetMonth,
}: MonthlyAssignmentsPanelProps) {
  const monthTotalHours = useMemo(
    () => Object.values(monthHoursByProject).reduce((sum, h) => sum + h, 0),
    [monthHoursByProject],
  );

  if (monthlyAssignments.length === 0) return null;

  const monthLabel = targetMonth.substring(0, 7).replace("-", "年") + "月";

  return (
    <section className="bg-white shadow rounded-lg p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">プロジェクト割当</h2>
        <span className="text-sm text-gray-500">{monthLabel}</span>
      </div>
      <div className="space-y-2">
        {monthlyAssignments.map((assignment) => {
          const actualHours = monthHoursByProject[assignment.project] ?? 0;
          const actualPercent =
            monthTotalHours > 0 ? Math.round((actualHours / monthTotalHours) * 100) : null;
          return (
            <div
              key={assignment.id}
              className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
            >
              <span className="text-gray-700">{assignment.project_name}</span>
              <span className="flex items-baseline gap-3 tabular-nums">
                {actualPercent !== null && (
                  <span
                    className="text-xs text-gray-500"
                    title="Cumulative Monthly Project Effort Percentage"
                  >
                    実績 {actualPercent}%
                  </span>
                )}
                <span className="text-indigo-600 font-medium" title="計画割当">
                  {assignment.percentage}%
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const MonthlyAssignmentsPanel = memo(MonthlyAssignmentsPanelImpl);
