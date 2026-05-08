import { useCallback, useState } from "react";
import {
  monthlyAssignmentsCreate,
  monthlyAssignmentsDestroy,
  monthlyAssignmentsPartialUpdate,
} from "~/lib/api/generated/monthly-assignments/monthly-assignments";
import type {
  PatchedProjectMonthlyAssignmentRequest,
  ProjectMonthlyAssignmentRequest,
} from "~/lib/api/generated/models";

export type ProjectAssignmentMutations = {
  isSaving: boolean;
  setError: (err: string) => void;
  createAssignment: (payload: ProjectMonthlyAssignmentRequest) => Promise<boolean>;
  updateAssignment: (id: number, patch: PatchedProjectMonthlyAssignmentRequest) => Promise<boolean>;
  deleteAssignment: (id: number) => Promise<boolean>;
};

export function useProjectAssignmentMutations(
  refresh: () => Promise<void>,
  setHookError: (err: string) => void,
): ProjectAssignmentMutations {
  const [isSaving, setIsSaving] = useState(false);

  const wrap = useCallback(
    async <T>(operation: () => Promise<T>, errorMessage: string): Promise<boolean> => {
      setIsSaving(true);
      setHookError("");
      try {
        await operation();
        await refresh();
        return true;
      } catch {
        setHookError(errorMessage);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [refresh, setHookError],
  );

  const createAssignment = useCallback(
    (payload: ProjectMonthlyAssignmentRequest) =>
      wrap(() => monthlyAssignmentsCreate(payload), "割当の作成に失敗しました"),
    [wrap],
  );
  const updateAssignment = useCallback(
    (id: number, patch: PatchedProjectMonthlyAssignmentRequest) =>
      wrap(() => monthlyAssignmentsPartialUpdate(id, patch), "割当の更新に失敗しました"),
    [wrap],
  );
  const deleteAssignment = useCallback(
    (id: number) => wrap(() => monthlyAssignmentsDestroy(id), "割当の削除に失敗しました"),
    [wrap],
  );

  return { isSaving, setError: setHookError, createAssignment, updateAssignment, deleteAssignment };
}
