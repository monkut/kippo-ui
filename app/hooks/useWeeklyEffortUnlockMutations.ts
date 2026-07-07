import { useCallback, useState } from "react";
import { weeklyEffortUnlocksCreate } from "~/lib/api/generated/weekly-effort-unlocks/weekly-effort-unlocks";
import type { ProjectWeeklyEffortUnlockRequest } from "~/lib/api/generated/models";
import { apiErrorMessage, throwOnError } from "~/lib/api/api-error";

export type WeeklyEffortUnlockMutations = {
  isSaving: boolean;
  error: string;
  setError: (err: string) => void;
  /** Request an unlock for a closed week (POST /api/weekly-effort-unlocks/). The request is pinned
   * to the current user server-side and needs an org admin's approval before the week re-opens. */
  requestUnlock: (payload: ProjectWeeklyEffortUnlockRequest) => Promise<boolean>;
};

// Unlock requests are append-only (no update/delete). A duplicate request for the same week returns
// a 400 (`既に申請済みです`) which apiErrorMessage surfaces verbatim.
export function useWeeklyEffortUnlockMutations(): WeeklyEffortUnlockMutations {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const requestUnlock = useCallback(async (payload: ProjectWeeklyEffortUnlockRequest) => {
    setIsSaving(true);
    setError("");
    try {
      // customFetch resolves (does not throw) on 4xx — throwOnError turns the duplicate/permission
      // rejection into a catch so apiErrorMessage can show the server's Japanese reason.
      throwOnError(await weeklyEffortUnlocksCreate(payload));
      return true;
    } catch (err) {
      setError(apiErrorMessage(err) ?? "アンロックの申請に失敗しました");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { isSaving, error, setError, requestUnlock };
}
