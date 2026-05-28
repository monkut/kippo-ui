import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import type { KippoProject, ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import {
  buildCellTooltip,
  buildMonthlyMatrix,
  type CellState,
  CONFIRMED_CELL,
  formatRowMonthlyTotal,
  formatRowMonthlyTotalTooltip,
  getProjectEffortSpentDays,
  MAX_PERCENTAGE_PER_MONTH,
  type MonthlyAssignmentMatrixProps,
  type MonthlyMatrixRow,
  type MonthlyMatrixUser,
  type SortConfig,
  type SortKey,
  sortMatrixRows,
  UNCONFIRMED_CELL,
} from "./utils";

/** Click target produced by a matrix cell — covers both edit (assignment != null)
 * and add (assignment === null) paths so callers can route to the right modal.
 * `assignment` is looked up by (project, user) from the month's raw list, NOT
 * from the merged CellState — modals need the original record's id. */
export type MatrixCellClickArgs = {
  project: KippoProject;
  user: MonthlyMatrixUser;
  assignment: ProjectMonthlyAssignment | null;
};

const FIXED_HEADER_COL_COUNT = 6;
const urlPrefix = import.meta.env.VITE_URL_PREFIX || "";

function MonthlyAssignmentMatrixImpl({
  projects,
  assignments,
  members,
  hideUnassigned = false,
  editableMonth = false,
  onCellClick,
}: MonthlyAssignmentMatrixProps) {
  const matrix = useMemo(
    () => buildMonthlyMatrix(projects, assignments, members),
    [projects, assignments, members],
  );

  // (project_id, user_id) → original ProjectMonthlyAssignment, used to resolve
  // the underlying record when a cell is clicked. The matrix builder merges
  // duplicate (project, user) rows into one CellState (no id), so for the
  // edit-cell path we need the source record — `EditAssignmentModal` patches
  // by id. When duplicates exist for a (project, user) slot, we deterministically
  // pick the first one; in practice the backend doesn't emit duplicates.
  const assignmentByCell = useMemo(() => {
    const map = new Map<string, ProjectMonthlyAssignment>();
    for (const a of assignments) {
      const key = `${a.project}::${a.user}`;
      if (!map.has(key)) map.set(key, a);
    }
    return map;
  }, [assignments]);

  // #21 F5: when `hideUnassigned` is on, drop member columns whose monthly
  // userTotal is 0. Filtering only the rendered list keeps `matrix.userTotals`
  // intact so the totals row aligns with whichever columns remain.
  const visibleUsers = useMemo(
    () =>
      hideUnassigned
        ? matrix.users.filter((u) => (matrix.userTotals.get(u.user_id) ?? 0) > 0)
        : matrix.users,
    [matrix.users, matrix.userTotals, hideUnassigned],
  );

  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const sortedRows = useMemo(
    () => sortMatrixRows(matrix.rows, sortConfig),
    [matrix.rows, sortConfig],
  );

  // 3-state cycle on click: asc → desc → default (null). Clicking a new column starts at asc.
  const handleSort = useCallback((key: SortKey) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }, []);

  if (matrix.rows.length === 0) {
    return <EmptyState />;
  }

  return (
    <section className="bg-white shadow rounded-lg p-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <HeaderRow users={visibleUsers} sortConfig={sortConfig} onSort={handleSort} />
          <UserTotalsRow users={visibleUsers} userTotals={matrix.userTotals} />
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <ProjectRow
              key={row.project.id}
              row={row}
              users={visibleUsers}
              editableMonth={editableMonth}
              onCellClick={onCellClick}
              assignmentByCell={assignmentByCell}
            />
          ))}
        </tbody>
      </table>
      <Legend />
    </section>
  );
}

function EmptyState() {
  return (
    <section className="bg-white shadow rounded-lg p-6">
      <p className="text-sm text-gray-500">アクティブなプロジェクトはありません。</p>
    </section>
  );
}

function HeaderRow({
  users,
  sortConfig,
  onSort,
}: {
  users: MonthlyMatrixUser[];
  sortConfig: SortConfig | null;
  onSort: (key: SortKey) => void;
}) {
  return (
    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500 align-bottom">
      <SortableHeader
        label="プロジェクトID"
        sortKey="id"
        sortConfig={sortConfig}
        onSort={onSort}
        className="py-2 pr-4 min-w-[7rem]"
      />
      <SortableHeader
        label="顧客"
        sortKey="customer_name"
        sortConfig={sortConfig}
        onSort={onSort}
        className="py-2 pr-4 whitespace-nowrap min-w-[6rem]"
      />
      <SortableHeader
        label="プロジェクト名"
        sortKey="name"
        sortConfig={sortConfig}
        onSort={onSort}
        className="py-2 pr-4 whitespace-nowrap"
      />
      <SortableHeader
        label="開始日"
        sortKey="start_date"
        sortConfig={sortConfig}
        onSort={onSort}
        className="py-2 px-3 min-w-[6rem]"
      />
      <SortableHeader
        label="終了日"
        sortKey="target_date"
        sortConfig={sortConfig}
        onSort={onSort}
        className="py-2 px-3 min-w-[6rem]"
      />
      <SortableHeader
        label="月合計 (人日)"
        sortKey="rowEffortDays"
        sortConfig={sortConfig}
        onSort={onSort}
        className="py-2 px-3 min-w-[5rem] text-right whitespace-nowrap"
        titleHint="月の合計工数 (人日)。各セルの % × 担当者の当月稼働可能日数 の合計です。"
      />
      {users.map((user) => (
        <th
          key={user.user_id}
          className="py-2 px-1 text-left align-bottom h-32 min-w-[1.75rem] normal-case tracking-normal"
        >
          <span
            className="[writing-mode:sideways-lr] inline-block text-[11px] font-medium text-gray-700 whitespace-nowrap"
            title={
              typeof user.available_work_days === "number"
                ? `${user.display_name} — 当月稼働可能 ${user.available_work_days}人日`
                : user.display_name
            }
          >
            {user.display_name}
          </span>
        </th>
      ))}
    </tr>
  );
}

function SortableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
  className,
  titleHint,
}: {
  label: string;
  sortKey: SortKey;
  sortConfig: SortConfig | null;
  onSort: (key: SortKey) => void;
  className: string;
  titleHint?: string;
}) {
  const isActive = sortConfig?.key === sortKey;
  const arrow = isActive ? (sortConfig.dir === "asc" ? "▲" : "▼") : "";
  const ariaSort = !isActive ? "none" : sortConfig.dir === "asc" ? "ascending" : "descending";
  const buttonTitle = titleHint
    ? `${titleHint}\n(クリックでソート: 昇順 → 降順 → 既定)`
    : "クリックでソート: 昇順 → 降順 → 既定";
  return (
    <th className={className} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider text-xs font-medium cursor-pointer hover:text-gray-900 ${
          isActive ? "text-gray-900" : "text-gray-500"
        }`}
        title={buttonTitle}
      >
        <span>{label}</span>
        <span className="text-[10px] w-3 inline-block text-center">{arrow}</span>
      </button>
    </th>
  );
}

function ProjectRow({
  row,
  users,
  editableMonth,
  onCellClick,
  assignmentByCell,
}: {
  row: MonthlyMatrixRow;
  users: MonthlyMatrixUser[];
  editableMonth: boolean;
  onCellClick?: (args: MatrixCellClickArgs) => void;
  assignmentByCell: Map<string, ProjectMonthlyAssignment>;
}) {
  const effortSpentDays = getProjectEffortSpentDays(row.project);
  const breakdownTooltip =
    typeof row.rowEffortDays === "number"
      ? formatRowMonthlyTotalTooltip(
          row.rowEffortDays,
          row.project.allocated_staff_days,
          effortSpentDays,
        )
      : null;
  const cellTitle = breakdownTooltip ?? `% 合計: ${row.rowTotal}%`;
  return (
    <tr className="border-b border-gray-100 last:border-0 align-top hover:bg-gray-50">
      <td className="py-2 pr-4">
        <CopyableProjectId projectId={row.project.id} />
      </td>
      <td className="py-2 pr-4 whitespace-nowrap text-xs text-gray-700">
        {row.project.customer_name ?? "—"}
      </td>
      <td className="py-2 pr-4 whitespace-nowrap">
        <Link
          to={`/projects/${row.project.id}/assignments`}
          title="クリックして割当を追加・編集"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          {row.project.name}
        </Link>
        <a
          href={`${urlPrefix}/admin/projects/activekippoproject/${row.project.id}/change/`}
          title="管理画面で編集"
          className="ml-2 text-xs text-gray-500 hover:text-indigo-600 hover:underline"
        >
          (details)
        </a>
      </td>
      <td className="py-2 px-3 text-xs text-gray-600">{row.project.start_date ?? "—"}</td>
      <td className="py-2 px-3 text-xs text-gray-600">{row.project.target_date ?? "—"}</td>
      <td
        className="py-2 px-3 text-right font-medium text-gray-700 whitespace-nowrap"
        title={cellTitle}
      >
        {typeof row.rowEffortDays === "number" ? (
          <a
            href={`${urlPrefix}/projects/project/${row.project.id}/status/`}
            title="プロジェクトステータスを開く"
            className="text-indigo-600 hover:text-indigo-500 hover:underline"
          >
            {formatRowMonthlyTotal(
              row.rowEffortDays,
              row.project.allocated_staff_days,
              effortSpentDays,
            )}
          </a>
        ) : (
          "—"
        )}
      </td>
      {users.map((user) => (
        <td key={user.user_id} className="py-2 px-1 text-center">
          <PercentageCell
            cell={row.cells.get(user.user_id)}
            user={user}
            project={row.project}
            editableMonth={editableMonth}
            onCellClick={onCellClick}
            assignmentByCell={assignmentByCell}
          />
        </td>
      ))}
    </tr>
  );
}

function CopyableProjectId({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false);
  const idPrefix = projectId.slice(0, 8);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(projectId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — silently no-op; full ID still visible via title.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "コピーしました" : `${projectId} (クリックでコピー)`}
      className="text-[11px] font-mono text-gray-500 hover:text-indigo-600 cursor-pointer"
    >
      {copied ? "✓ コピー済" : `${idPrefix}…`}
    </button>
  );
}

const PAST_MONTH_LOCKED_TITLE = "過去月のためロック";

function PercentageCell({
  cell,
  user,
  project,
  editableMonth,
  onCellClick,
  assignmentByCell,
}: {
  cell: CellState | undefined;
  user: MonthlyMatrixUser;
  project: KippoProject;
  editableMonth: boolean;
  onCellClick?: (args: MatrixCellClickArgs) => void;
  assignmentByCell: Map<string, ProjectMonthlyAssignment>;
}) {
  const isClickable = editableMonth && !!onCellClick;

  if (!cell) {
    // Empty slot: when the month is editable + a handler is wired, render a
    // faint placeholder button so users can ADD a new assignment via the same
    // single-click path. Otherwise (past months, or no handler) stay as the
    // static `—` to match pre-#22 read-only behavior.
    if (!isClickable) return <span className="text-gray-300">—</span>;
    return (
      <button
        type="button"
        onClick={() => onCellClick?.({ project, user, assignment: null })}
        title={`${user.display_name} に割当を追加`}
        className="text-gray-300 hover:text-indigo-600 cursor-pointer"
      >
        —
      </button>
    );
  }

  const style = cell.isConfirmed ? CONFIRMED_CELL : UNCONFIRMED_CELL;
  const baseTooltip = buildCellTooltip(
    user.display_name,
    style.title,
    cell.percentage,
    user.available_work_days,
  );
  const tooltip = isClickable ? baseTooltip : `${baseTooltip}\n${PAST_MONTH_LOCKED_TITLE}`;
  const sharedClass = `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.className}`;

  if (!isClickable) {
    return (
      <span className={sharedClass} title={tooltip}>
        {cell.percentage}%
      </span>
    );
  }

  // Hover layered on per-variant — matches AssignmentsTable's clickable cell.
  const hoverClass = cell.isConfirmed ? "hover:bg-indigo-200" : "hover:bg-gray-100";
  const assignment = assignmentByCell.get(`${project.id}::${user.user_id}`) ?? null;
  return (
    <button
      type="button"
      onClick={() => onCellClick?.({ project, user, assignment })}
      className={`${sharedClass} ${hoverClass} cursor-pointer`}
      title={tooltip}
    >
      {cell.percentage}%
    </button>
  );
}

function UserTotalsRow({
  users,
  userTotals,
}: {
  users: MonthlyMatrixUser[];
  userTotals: Map<string, number>;
}) {
  return (
    <tr className="border-b-2 border-gray-300 bg-gray-50 text-xs">
      <td colSpan={FIXED_HEADER_COL_COUNT} className="py-2 pr-4 text-gray-500 font-medium">
        ユーザー月合計
      </td>
      {users.map((user) => {
        const total = userTotals.get(user.user_id) ?? 0;
        const overAllocated = total > MAX_PERCENTAGE_PER_MONTH;
        return (
          <td
            key={user.user_id}
            className={`py-2 px-1 text-center font-medium ${overAllocated ? "text-red-700" : "text-gray-700"}`}
            title={overAllocated ? `${total}% — 100%を超えています` : undefined}
          >
            {total}%{overAllocated ? " ⚠" : ""}
          </td>
        );
      })}
    </tr>
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
        ユーザーの月合計が100%を超えると警告表示
      </span>
    </div>
  );
}

export const MonthlyAssignmentMatrix = memo(MonthlyAssignmentMatrixImpl);
