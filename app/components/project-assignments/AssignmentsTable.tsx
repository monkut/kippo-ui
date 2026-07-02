import { memo, useMemo } from "react";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { formatMonth } from "~/lib/dates";
import {
  assignmentDisplayName,
  CONFIRMED_CELL,
  MAX_PERCENTAGE_PER_MONTH,
  UNCONFIRMED_CELL,
} from "./utils";

type AssignmentsTableProps = {
  assignments: ProjectMonthlyAssignment[];
  month: string; // first-of-month ISO date "YYYY-MM-01"
  isSaving: boolean;
  onAddClick?: () => void;
  onSuggestClick?: () => void;
  onCellClick?: (assignment: ProjectMonthlyAssignment) => void;
  onToggleConfirmed?: (assignment: ProjectMonthlyAssignment) => void;
};

function AssignmentsTableImpl({
  assignments,
  month,
  isSaving,
  onAddClick,
  onSuggestClick,
  onCellClick,
  onToggleConfirmed,
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
      onToggleConfirmed={onToggleConfirmed}
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
  onToggleConfirmed?: (assignment: ProjectMonthlyAssignment) => void;
};

function PopulatedSection({
  month,
  monthAssignments,
  isSaving,
  onAddClick,
  onSuggestClick,
  onCellClick,
  onToggleConfirmed,
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
        onToggleConfirmed={onToggleConfirmed}
      />
      <Legend />
    </section>
  );
}

type AssignmentsBodyTableProps = {
  monthAssignments: ProjectMonthlyAssignment[];
  isSaving: boolean;
  onCellClick?: (assignment: ProjectMonthlyAssignment) => void;
  onToggleConfirmed?: (assignment: ProjectMonthlyAssignment) => void;
};

function AssignmentsBodyTable({
  monthAssignments,
  isSaving,
  onCellClick,
  onToggleConfirmed,
}: AssignmentsBodyTableProps) {
  const monthTotal = monthAssignments.reduce((sum, a) => sum + a.percentage, 0);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
          <th className="py-2 pr-4">ユーザー</th>
          <th className="py-2 px-3 text-right min-w-[6rem]">割当</th>
          <th className="py-2 px-3 text-center min-w-[5rem]">確定</th>
        </tr>
      </thead>
      <tbody>
        {monthAssignments.map((assignment) => (
          <UserRow
            key={assignment.id}
            assignment={assignment}
            isSaving={isSaving}
            onCellClick={onCellClick}
            onToggleConfirmed={onToggleConfirmed}
          />
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-gray-300 text-xs">
          <td className="py-2 pr-4 text-gray-500 font-medium">月合計</td>
          <MonthTotalCell total={monthTotal} />
          <td />
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
  onToggleConfirmed,
}: {
  assignment: ProjectMonthlyAssignment;
  isSaving: boolean;
  onCellClick?: (assignment: ProjectMonthlyAssignment) => void;
  onToggleConfirmed?: (assignment: ProjectMonthlyAssignment) => void;
}) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-4 text-gray-900 font-medium whitespace-nowrap">
        {assignmentDisplayName(assignment)}
      </td>
      <td className="py-2 px-3 text-right">
        <PercentageCell assignment={assignment} onClick={onCellClick} />
      </td>
      <td className="py-2 px-3 text-center">
        <ConfirmedToggle assignment={assignment} isSaving={isSaving} onToggle={onToggleConfirmed} />
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
  const isConfirmed = assignment.is_confirmed ?? false;
  // Hover classes layered on per-variant — base appearance lives in utils.ts
  // (shared with MonthlyAssignmentMatrix) but only this clickable variant has hover.
  const styles = isConfirmed
    ? `${CONFIRMED_CELL.className} hover:bg-indigo-200`
    : `${UNCONFIRMED_CELL.className} hover:bg-gray-100`;
  const sharedClass = `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles}`;
  const tooltip = isConfirmed ? "確定済み (クリックで編集)" : "未確定 / 予測 (クリックで編集)";

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
    <span
      className={sharedClass}
      title={isConfirmed ? CONFIRMED_CELL.title : UNCONFIRMED_CELL.title}
    >
      {assignment.percentage}%
    </span>
  );
}

function ConfirmedToggle({
  assignment,
  isSaving,
  onToggle,
}: {
  assignment: ProjectMonthlyAssignment;
  isSaving: boolean;
  onToggle?: (assignment: ProjectMonthlyAssignment) => void;
}) {
  const isConfirmed = assignment.is_confirmed ?? false;
  return (
    <input
      type="checkbox"
      aria-label={`${assignmentDisplayName(assignment)} の割当を確定`}
      checked={isConfirmed}
      disabled={isSaving || !onToggle}
      onChange={() => onToggle?.(assignment)}
      title={isConfirmed ? "クリックで未確定に戻す" : "クリックで確定済みにする"}
      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
    />
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded bg-indigo-100 border border-indigo-200" />
        確定済み
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded bg-gray-50 border border-dashed border-gray-300" />
        未確定 (予測)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="text-red-700 font-medium">⚠ 100%超</span>
        月合計が100%を超えると警告表示
      </span>
    </div>
  );
}

export const AssignmentsTable = memo(AssignmentsTableImpl);
