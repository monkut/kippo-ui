import { memo, useMemo } from "react";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { buildGrid, formatMonth, type CellState, type GridRow } from "./utils";

type AssignmentsTableProps = {
  assignments: ProjectMonthlyAssignment[];
  onAddClick?: () => void;
  onSuggestClick?: () => void;
  onCellClick?: (assignment: ProjectMonthlyAssignment) => void;
};

const MAX_PERCENTAGE_PER_MONTH = 100;

function AssignmentsTableImpl({ assignments, onAddClick, onSuggestClick, onCellClick }: AssignmentsTableProps) {
  const { months, byUser, monthTotals, byCellId } = useMemo(() => {
    const grid = buildGrid(assignments);
    const cellLookup = new Map<string, ProjectMonthlyAssignment>();
    for (const assignment of assignments) {
      if (assignment.month) cellLookup.set(`${assignment.user}|${assignment.month}`, assignment);
    }
    return { ...grid, byCellId: cellLookup };
  }, [assignments]);

  if (assignments.length === 0) {
    return <EmptyState onAddClick={onAddClick} onSuggestClick={onSuggestClick} />;
  }

  return (
    <section className="bg-white shadow rounded-lg p-6 overflow-x-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-medium text-gray-900">月次割当</h2>
        <Toolbar onAddClick={onAddClick} onSuggestClick={onSuggestClick} />
      </div>
      <table className="w-full text-sm">
        <TableHeader months={months} />
        <tbody>
          {byUser.map((row) => (
            <UserRow key={row.userKey} row={row} months={months} byCellId={byCellId} onCellClick={onCellClick} />
          ))}
        </tbody>
        <TableFooter months={months} monthTotals={monthTotals} />
      </table>
      <Legend />
    </section>
  );
}

function EmptyState({ onAddClick, onSuggestClick }: { onAddClick?: () => void; onSuggestClick?: () => void }) {
  return (
    <section className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-lg font-medium text-gray-900">月次割当</h2>
        <Toolbar onAddClick={onAddClick} onSuggestClick={onSuggestClick} />
      </div>
      <p className="text-sm text-gray-500">割当はまだ登録されていません。</p>
    </section>
  );
}

function Toolbar({ onAddClick, onSuggestClick }: { onAddClick?: () => void; onSuggestClick?: () => void }) {
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

function TableHeader({ months }: { months: string[] }) {
  return (
    <thead>
      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
        <th className="py-2 pr-4">ユーザー</th>
        {months.map((month) => (
          <th key={month} className="py-2 px-3 text-right">
            {formatMonth(month)}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function UserRow({
  row,
  months,
  byCellId,
  onCellClick,
}: {
  row: GridRow;
  months: string[];
  byCellId: Map<string, ProjectMonthlyAssignment>;
  onCellClick?: (assignment: ProjectMonthlyAssignment) => void;
}) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-4 text-gray-900 font-medium whitespace-nowrap">{row.displayName}</td>
      {months.map((month) => {
        const assignment = byCellId.get(`${row.userKey}|${month}`);
        return (
          <td key={month} className="py-2 px-3 text-right">
            <PercentageCell cell={row.cells.get(month)} assignment={assignment} onClick={onCellClick} />
          </td>
        );
      })}
    </tr>
  );
}

function TableFooter({ months, monthTotals }: { months: string[]; monthTotals: Map<string, number> }) {
  return (
    <tfoot>
      <tr className="border-t-2 border-gray-300 text-xs">
        <td className="py-2 pr-4 text-gray-500 font-medium">月合計</td>
        {months.map((month) => (
          <MonthTotalCell key={month} total={monthTotals.get(month) ?? 0} />
        ))}
      </tr>
    </tfoot>
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
  cell,
  assignment,
  onClick,
}: {
  cell: CellState | undefined;
  assignment?: ProjectMonthlyAssignment;
  onClick?: (assignment: ProjectMonthlyAssignment) => void;
}) {
  if (!cell) return <span className="text-gray-300">—</span>;
  const styles = cell.isConfirmed
    ? "bg-indigo-100 text-indigo-800 border border-indigo-200 hover:bg-indigo-200"
    : "bg-indigo-50 text-indigo-600 border border-dashed border-indigo-200 hover:bg-indigo-100";
  const sharedClass = `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles}`;
  const tooltip = cell.isConfirmed ? "確定済み (クリックで編集)" : "未確定 / 予測 (クリックで編集)";

  if (assignment && onClick) {
    return (
      <button type="button" onClick={() => onClick(assignment)} className={sharedClass} title={tooltip}>
        {cell.percentage}%
      </button>
    );
  }
  return (
    <span className={sharedClass} title={cell.isConfirmed ? "確定済み" : "未確定 (予測)"}>
      {cell.percentage}%
    </span>
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
        <span className="inline-block w-3 h-3 rounded bg-indigo-50 border border-dashed border-indigo-200" />
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
