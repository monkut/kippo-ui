import { memo, useMemo } from "react";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { formatMonth } from "~/lib/dates";
import { assignmentDisplayName, ASSIGNMENT_CELL, MAX_PERCENTAGE_PER_MONTH } from "./utils";

type AssignmentsTableProps = {
  assignments: ProjectMonthlyAssignment[];
  month: string; // first-of-month ISO date "YYYY-MM-01"
  isSaving: boolean;
  onAddClick?: () => void;
  onSuggestClick?: () => void;
  onCellClick?: (assignment: ProjectMonthlyAssignment) => void;
};

function AssignmentsTableImpl({
  assignments,
  month,
  isSaving,
  onAddClick,
  onSuggestClick,
  onCellClick,
}: AssignmentsTableProps) {
  const monthAssignments = useMemo(
    () =>
      assignments
        .filter((a) => a.month === month)
        .sort((a, b) => assignmentDisplayName(a).localeCompare(assignmentDisplayName(b))),
    [assignments, month],
  );

  if (monthAssignments.length === 0) {
    return <EmptyState month={month} onAddClick={onAddClick} onSuggestClick={onSuggestClick} />;
  }
  return (
    <PopulatedSection
      month={month}
      monthAssignments={monthAssignments}
      isSaving={isSaving}
      onAddClick={onAddClick}
      onSuggestClick={onSuggestClick}
      onCellClick={onCellClick}
    />
  );
}

type PopulatedSectionProps = {
  month: string;
  monthAssignments: ProjectMonthlyAssignment[];
  isSaving: boolean;
  onAddClick?: () => void;
  onSuggestClick?: () => void;
  onCellClick?: (assignment: ProjectMonthlyAssignment) => void;
};

function PopulatedSection({
  month,
  monthAssignments,
  isSaving,
  onAddClick,
  onSuggestClick,
  onCellClick,
}: PopulatedSectionProps) {
  return (
    <section className="bg-white shadow rounded-lg p-6 overflow-x-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-medium text-gray-900">{formatMonth(month)} の割当</h2>
        <Toolbar onAddClick={onAddClick} onSuggestClick={onSuggestClick} />
      </div>
      <AssignmentsBodyTable
        monthAssignments={monthAssignments}
        isSaving={isSaving}
        onCellClick={onCellClick}
      />
      <Legend />
    </section>
  );
}

type AssignmentsBodyTableProps = {
  monthAssignments: ProjectMonthlyAssignment[];
  isSaving: boolean;
  onCellClick?: (assignment: ProjectMonthlyAssignment) => void;
};

function AssignmentsBodyTable({
  monthAssignments,
  isSaving,
  onCellClick,
}: AssignmentsBodyTableProps) {
  const monthTotal = monthAssignments.reduce((sum, a) => sum + a.percentage, 0);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
          <th className="py-2 pr-4">ユーザー</th>
          <th className="py-2 px-3 text-right min-w-[6rem]">割当</th>
        </tr>
      </thead>
      <tbody>
        {monthAssignments.map((assignment) => (
          <UserRow
            key={assignment.id}
            assignment={assignment}
            isSaving={isSaving}
            onCellClick={onCellClick}
          />
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-gray-300 text-xs">
          <td className="py-2 pr-4 text-gray-500 font-medium">月合計</td>
          <MonthTotalCell total={monthTotal} />
        </tr>
      </tfoot>
    </table>
  );
}

function EmptyState({
  month,
  onAddClick,
  onSuggestClick,
}: {
  month: string;
  onAddClick?: () => void;
  onSuggestClick?: () => void;
}) {
  return (
    <section className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-lg font-medium text-gray-900">{formatMonth(month)} の割当</h2>
        <Toolbar onAddClick={onAddClick} onSuggestClick={onSuggestClick} />
      </div>
      <p className="text-sm text-gray-500">この月の割当はまだ登録されていません。</p>
    </section>
  );
}

function Toolbar({
  onAddClick,
  onSuggestClick,
}: {
  onAddClick?: () => void;
  onSuggestClick?: () => void;
}) {
  return (
    <div className="flex gap-2">
      {onSuggestClick && (
        <button
          type="button"
          onClick={onSuggestClick}
          className="px-3 py-1.5 text-sm font-medium text-indigo-700 bg-white border border-indigo-300 rounded-md hover:bg-indigo-50"
        >
          候補パターンを生成
        </button>
      )}
      {onAddClick && (
        <button
          type="button"
          onClick={onAddClick}
          className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          + 割当を追加
        </button>
      )}
    </div>
  );
}

function UserRow({
  assignment,
  isSaving,
  onCellClick,
}: {
  assignment: ProjectMonthlyAssignment;
  isSaving: boolean;
  onCellClick?: (assignment: ProjectMonthlyAssignment) => void;
}) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-4 text-gray-900 font-medium whitespace-nowrap">
        {assignmentDisplayName(assignment)}
      </td>
      <td className="py-2 px-3 text-right">
        <PercentageCell assignment={assignment} onClick={onCellClick} />
      </td>
    </tr>
  );
}

function MonthTotalCell({ total }: { total: number }) {
  const overAllocated = total > MAX_PERCENTAGE_PER_MONTH;
  return (
    <td
      className={`py-2 px-3 text-right font-medium ${overAllocated ? "text-red-700" : "text-gray-700"}`}
      title={overAllocated ? `${total}% — 100%を超えています` : undefined}
    >
      {total}%{overAllocated ? " ⚠" : ""}
    </td>
  );
}

function PercentageCell({
  assignment,
  onClick,
}: {
  assignment: ProjectMonthlyAssignment;
  onClick?: (assignment: ProjectMonthlyAssignment) => void;
}) {
  // Hover layered on here — base appearance is shared with MonthlyAssignmentMatrix.
  const sharedClass = `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ASSIGNMENT_CELL.className} hover:bg-indigo-200`;
  const tooltip = "クリックで編集";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={() => onClick(assignment)}
        className={sharedClass}
        title={tooltip}
      >
        {assignment.percentage}%
      </button>
    );
  }
  return (
    <span className={sharedClass} title={ASSIGNMENT_CELL.title}>
      {assignment.percentage}%
    </span>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
      <span className="inline-flex items-center gap-1.5">
        <span className="text-red-700 font-medium">⚠ 100%超</span>
        月合計が100%を超えると警告表示
      </span>
    </div>
  );
}

export const AssignmentsTable = memo(AssignmentsTableImpl);
