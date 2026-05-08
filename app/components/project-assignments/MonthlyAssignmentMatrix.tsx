import { memo, useMemo } from "react";
import { Link } from "react-router";
import type { KippoProject, ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import {
  buildMonthlyMatrix,
  MAX_PERCENTAGE_PER_MONTH,
  type CellState,
  type MonthlyMatrixRow,
  type MonthlyMatrixUser,
} from "./utils";

type MonthlyAssignmentMatrixProps = {
  projects: KippoProject[];
  assignments: ProjectMonthlyAssignment[];
};

const CONFIRMED_CELL = {
  className: "bg-indigo-100 text-indigo-800 border border-indigo-200",
  title: "確定済み",
} as const;
const UNCONFIRMED_CELL = {
  className: "bg-indigo-50 text-indigo-600 border border-dashed border-indigo-200",
  title: "未確定 (予測)",
} as const;

function MonthlyAssignmentMatrixImpl({ projects, assignments }: MonthlyAssignmentMatrixProps) {
  const matrix = useMemo(() => buildMonthlyMatrix(projects, assignments), [projects, assignments]);

  if (matrix.rows.length === 0) {
    return <EmptyState />;
  }

  return (
    <section className="bg-white shadow rounded-lg p-6 overflow-x-auto">
      <table className="w-full text-sm">
        <Header users={matrix.users} />
        <tbody>
          {matrix.rows.map((row) => (
            <ProjectRow key={row.project.id} row={row} users={matrix.users} />
          ))}
        </tbody>
        <Footer users={matrix.users} userTotals={matrix.userTotals} />
      </table>
      <Legend />
    </section>
  );
}

function EmptyState() {
  return (
    <section className="bg-white shadow rounded-lg p-6">
      <p className="text-sm text-gray-500">この月に割当のあるプロジェクトはありません。</p>
    </section>
  );
}

function Header({ users }: { users: MonthlyMatrixUser[] }) {
  return (
    <thead>
      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
        <th className="py-2 pr-4 min-w-[14rem]">プロジェクト</th>
        <th className="py-2 px-3 min-w-[8rem]">期間</th>
        {users.map((user) => (
          <th key={user.user_id} className="py-2 px-3 text-right min-w-[5rem]">
            {user.display_name}
          </th>
        ))}
        <th className="py-2 pl-3 text-right">月合計</th>
      </tr>
    </thead>
  );
}

function ProjectRow({ row, users }: { row: MonthlyMatrixRow; users: MonthlyMatrixUser[] }) {
  const idPrefix = row.project.id.slice(0, 8);
  return (
    <tr className="border-b border-gray-100 last:border-0 align-top">
      <td className="py-2 pr-4">
        <Link
          to={`/projects/${row.project.id}/assignments`}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          {row.project.name}
        </Link>
        <div className="text-[11px] text-gray-400 font-mono mt-0.5">{idPrefix}…</div>
      </td>
      <td className="py-2 px-3 text-xs text-gray-600">
        <div>{row.project.start_date ?? "—"}</div>
        <div>{row.project.target_date ?? "—"}</div>
      </td>
      {users.map((user) => (
        <td key={user.user_id} className="py-2 px-3 text-right">
          <PercentageCell cell={row.cells.get(user.user_id)} />
        </td>
      ))}
      <td className="py-2 pl-3 text-right font-medium text-gray-700">{row.rowTotal}%</td>
    </tr>
  );
}

function PercentageCell({ cell }: { cell: CellState | undefined }) {
  if (!cell) return <span className="text-gray-300">—</span>;
  const style = cell.isConfirmed ? CONFIRMED_CELL : UNCONFIRMED_CELL;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.className}`}
      title={style.title}
    >
      {cell.percentage}%
    </span>
  );
}

function Footer({ users, userTotals }: { users: MonthlyMatrixUser[]; userTotals: Map<string, number> }) {
  return (
    <tfoot>
      <tr className="border-t-2 border-gray-300 text-xs">
        <td colSpan={2} className="py-2 pr-4 text-gray-500 font-medium">
          ユーザー月合計
        </td>
        {users.map((user) => {
          const total = userTotals.get(user.user_id) ?? 0;
          const overAllocated = total > MAX_PERCENTAGE_PER_MONTH;
          return (
            <td
              key={user.user_id}
              className={`py-2 px-3 text-right font-medium ${overAllocated ? "text-red-700" : "text-gray-700"}`}
              title={overAllocated ? `${total}% — 100%を超えています` : undefined}
            >
              {total}%{overAllocated ? " ⚠" : ""}
            </td>
          );
        })}
        <td />
      </tr>
    </tfoot>
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
        ユーザーの月合計が100%を超えると警告表示
      </span>
    </div>
  );
}

export const MonthlyAssignmentMatrix = memo(MonthlyAssignmentMatrixImpl);
