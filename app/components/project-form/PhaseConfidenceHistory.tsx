import type { KippoProjectPhaseConfidenceChange } from "~/lib/api/generated/models";
import { formatDisplayDateTime } from "~/lib/dates";
import { CollapsibleSection } from "./PageFields";

/** "旧 → 新", or the single value when nothing changed. */
export function transitionLabel(previous: string, next: string): string {
  return previous === next ? next : `${previous} → ${next}`;
}

/** 変更者: display name, else username, else "-" (no user recorded, or the user was deleted). */
export function changeAuthorLabel(change: KippoProjectPhaseConfidenceChange): string {
  return change.changed_by_display_name || change.changed_by_username || "-";
}

/** フェーズ・確度変更履歴 — read-only log of the project's phase / 確度 changes, newest first
 * (mirrors the Django admin's read-only inline; kippo writes a row on each change). */
export function PhaseConfidenceHistory({
  changes,
}: {
  changes: readonly KippoProjectPhaseConfidenceChange[];
}) {
  return (
    <CollapsibleSection title="フェーズ・確度変更履歴">
      {changes.length === 0 ? (
        <p className="text-sm text-gray-500">変更履歴はありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="py-2 pr-4 font-medium">変更日時</th>
                <th className="py-2 pr-4 font-medium">変更者</th>
                <th className="py-2 pr-4 font-medium">フェーズ</th>
                <th className="py-2 font-medium">確度</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-4 text-gray-900 whitespace-nowrap">
                    {formatDisplayDateTime(change.changed_datetime)}
                  </td>
                  <td className="py-2 pr-4 text-gray-900">{changeAuthorLabel(change)}</td>
                  <td className="py-2 pr-4 text-gray-900">
                    {change.previous_phase === change.new_phase
                      ? change.new_phase_display
                      : transitionLabel(change.previous_phase_display, change.new_phase_display)}
                  </td>
                  <td className="py-2 text-gray-900 whitespace-nowrap">
                    {transitionLabel(`${change.previous_confidence}%`, `${change.new_confidence}%`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CollapsibleSection>
  );
}
