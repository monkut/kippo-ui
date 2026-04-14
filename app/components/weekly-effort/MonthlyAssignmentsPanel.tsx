import { memo } from "react";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";

type MonthlyAssignmentsPanelProps = {
  monthlyAssignments: ProjectMonthlyAssignment[];
};

function MonthlyAssignmentsPanelImpl({ monthlyAssignments }: MonthlyAssignmentsPanelProps) {
  if (monthlyAssignments.length === 0) return null;

  return (
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
  );
}

export const MonthlyAssignmentsPanel = memo(MonthlyAssignmentsPanelImpl);
