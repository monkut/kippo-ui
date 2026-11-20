import { sumPercentages, type UserMonthRow } from "./edit-context";

// Shared pieces of the assignment modals' read-only context tables (割当の編集, 参加者を追加).

export type SectionState = { isLoading: boolean; error: string };

export function SectionBody({
  isLoading,
  error,
  children,
}: SectionState & { children: React.ReactNode }) {
  if (isLoading) return <p className="text-sm text-gray-500">読み込み中...</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  return <>{children}</>;
}

export const TH = "px-3 py-1.5 font-medium border-b border-gray-200";
export const TD = "px-3 py-1.5 border-b border-gray-100";
export const highlightRowClass = (isHighlighted: boolean) => (isHighlighted ? "bg-indigo-50" : "");

/** Marks the row the modal is changing ("編集中", "追加"). */
export function RowBadge({ label }: { label: string }) {
  return (
    <span className="ml-2 rounded border border-indigo-300 px-1 text-xs text-indigo-700">
      {label}
    </span>
  );
}

/** A user's assignments for one month on every project, with the month total (⚠ over 100%).
 * The highlighted row carries the modal's unsaved percentage, so the total follows the input. */
export function UserMonthAssignments({
  month,
  userName,
  rows,
  badgeLabel,
  ...state
}: SectionState & { month: string; userName: string; rows: UserMonthRow[]; badgeLabel: string }) {
  const total = sumPercentages(rows);
  const over = total > 100;
  return (
    <section aria-label="ユーザーの割当">
      <h4 className="mb-2 text-sm font-medium text-gray-900">
        {userName} の割当（{month}・全プロジェクト）
      </h4>
      <SectionBody {...state}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className={TH}>プロジェクト</th>
              <th className={`${TH} text-right`}>割当</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.projectId} className={highlightRowClass(row.isEditing)}>
                <td className={`${TD} text-gray-900`}>
                  {row.projectName}
                  {row.isEditing && <RowBadge label={badgeLabel} />}
                </td>
                <td className={`${TD} text-right font-medium tabular-nums`}>{row.percentage}%</td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2 font-medium">月合計</td>
              <td
                className={`px-3 py-2 text-right font-bold tabular-nums ${over ? "text-red-700" : "text-gray-900"}`}
              >
                {total}%{over ? " ⚠" : ""}
              </td>
            </tr>
          </tbody>
        </table>
        {over && (
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
            月合計が 100% を超えています（保存は可能）
          </p>
        )}
      </SectionBody>
    </section>
  );
}
