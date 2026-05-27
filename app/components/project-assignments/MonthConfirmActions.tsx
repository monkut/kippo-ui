import { memo } from "react";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { countAssignmentsByConfirmation } from "./utils";

type MonthConfirmActionsProps = {
  /** Assignments for the currently displayed month — `useMonthlyAssignments`
   * already pre-filters to the displayed month and strips excluded users. */
  assignments: ProjectMonthlyAssignment[];
  isSaving: boolean;
  /** Flip every passed assignment id to the given `is_confirmed` value. The
   * route owns the actual wiring (PATCH loop + refresh) via
   * `useProjectAssignmentMutations.bulkSetConfirmed`. */
  onBulkSetConfirmed: (ids: number[], isConfirmed: boolean) => Promise<boolean>;
  /** Injectable for tests — production calls `window.confirm`. */
  confirmFn?: (message: string) => boolean;
};

function MonthConfirmActionsImpl({
  assignments,
  isSaving,
  onBulkSetConfirmed,
  confirmFn,
}: MonthConfirmActionsProps) {
  const { confirmed, unconfirmed } = countAssignmentsByConfirmation(assignments);
  const confirm = confirmFn ?? ((message: string) => window.confirm(message));

  const handleConfirmAll = async () => {
    const ids = assignments.filter((a) => !a.is_confirmed).map((a) => a.id);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length}件の割当を確定しますか?`)) return;
    await onBulkSetConfirmed(ids, true);
  };

  const handleUnconfirmAll = async () => {
    const ids = assignments.filter((a) => a.is_confirmed).map((a) => a.id);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length}件の割当の確定を解除しますか?`)) return;
    await onBulkSetConfirmed(ids, false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleConfirmAll}
        disabled={isSaving || unconfirmed === 0}
        className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 border border-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:border-gray-300 disabled:cursor-not-allowed"
        title={
          unconfirmed === 0
            ? "確定対象の未確定割当はありません"
            : `${unconfirmed}件の未確定割当を確定`
        }
      >
        この月を確定 ({unconfirmed})
      </button>
      <button
        type="button"
        onClick={handleUnconfirmAll}
        disabled={isSaving || confirmed === 0}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        title={
          confirmed === 0
            ? "解除対象の確定済み割当はありません"
            : `${confirmed}件の確定済み割当を解除`
        }
      >
        この月の確定を解除 ({confirmed})
      </button>
    </div>
  );
}

export const MonthConfirmActions = memo(MonthConfirmActionsImpl);
