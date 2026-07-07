import { useEffect, useState } from "react";
import { useWeeklyEffortUnlockMutations } from "~/hooks/useWeeklyEffortUnlockMutations";

type RequestUnlockModalProps = {
  open: boolean;
  weekStart: string;
  /** Organization of the closed week's entries — the unlock request is org-scoped. */
  organizationId: string;
  onClose: () => void;
};

// Request-unlock flow for a締め切られた (closed) week (kippo#54 / T18). A user submits a reason;
// the request is org-admin-approved out of band (Django admin / REST), after which the week re-opens
// on the next load. Approval intentionally stays admin-only — there is no client-side org-admin flag.
export function RequestUnlockModal({
  open,
  weekStart,
  organizationId,
  onClose,
}: RequestUnlockModalProps) {
  const { isSaving, error, setError, requestUnlock } = useWeeklyEffortUnlockMutations();
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Reset transient state each time the modal opens.
  useEffect(() => {
    if (open) {
      setReason("");
      setSubmitted(false);
      setError("");
    }
  }, [open, setError]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!organizationId || reason.trim().length === 0) return;
    const ok = await requestUnlock({
      organization: organizationId,
      week_start: weekStart,
      reason: reason.trim(),
    });
    if (ok) setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="fixed inset-0 bg-black bg-opacity-25 cursor-default"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">アンロックを申請</h3>

          {submitted ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                {weekStart} のアンロックを申請しました。管理者の承認後に編集できるようになります。
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                >
                  閉じる
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600">
                <span className="font-medium">対象週:</span> {weekStart}
              </div>
              {error && (
                <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
              )}
              <div>
                <label
                  htmlFor="unlock-reason"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  申請理由
                </label>
                <textarea
                  id="unlock-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="締め後に編集が必要な理由を記入してください"
                  disabled={isSaving}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                />
              </div>
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSaving || reason.trim().length === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? "申請中..." : "申請する"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
