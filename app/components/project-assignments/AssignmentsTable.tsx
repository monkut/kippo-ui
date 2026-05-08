import { memo, useMemo } from "react";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { buildGrid, formatMonth, type CellState, type GridRow } from "./utils";

type AssignmentsTableProps = {
  assignments: ProjectMonthlyAssignment[];
};

const MAX_PERCENTAGE_PER_MONTH = 100;

function AssignmentsTableImpl({ assignments }: AssignmentsTableProps) {
  const { months, byUser, monthTotals } = useMemo(() => buildGrid(assignments), [assignments]);

  if (assignments.length === 0) {
    return <EmptyState />;
  }

  return (
    <section className="bg-white shadow rounded-lg p-6 overflow-x-auto">
      <h2 className="text-lg font-medium text-gray-900 mb-4">月次割当</h2>
      <table className="w-full text-sm">
        <TableHeader months={months} />
        <tbody>
          {byUser.map((row) => (
            <UserRow key={row.userKey} row={row} months={months} />
          ))}
        </tbody>
        <TableFooter months={months} monthTotals={monthTotals} />
      </table>
      <Legend />
    </section>
  );
}

function EmptyState() {
  return (
    <section className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-2">月次割当</h2>
      <p className="text-sm text-gray-500">割当はまだ登録されていません。</p>
    </section>
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

function UserRow({ row, months }: { row: GridRow; months: string[] }) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-4 text-gray-900 font-medium whitespace-nowrap">{row.displayName}</td>
      {months.map((month) => (
        <td key={month} className="py-2 px-3 text-right">
          <PercentageCell cell={row.cells.get(month)} />
        </td>
      ))}
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

function PercentageCell({ cell }: { cell: CellState | undefined }) {
  if (!cell) return <span className="text-gray-300">—</span>;
  const styles = cell.isConfirmed
    ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
    : "bg-indigo-50 text-indigo-600 border border-dashed border-indigo-200";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles}`}
      title={cell.isConfirmed ? "確定済み" : "未確定 (予測)"}
    >
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
