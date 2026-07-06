import { useCallback, useState } from "react";
import {
  monthlyAssignmentsCreate,
  monthlyAssignmentsDestroy,
  monthlyAssignmentsPartialUpdate,
} from "~/lib/api/generated/monthly-assignments/monthly-assignments";
import type {
  KippoProjectRequest,
  PatchedProjectMonthlyAssignmentRequest,
  ProjectMonthlyAssignmentRequest,
} from "~/lib/api/generated/models";
import { projectsCreate } from "~/lib/api/generated/projects/projects";
import { apiErrorMessage, throwOnError } from "~/lib/api/api-error";

export type ProjectAssignmentMutations = {
  isSaving: boolean;
  setError: (err: string) => void;
  createAssignment: (payload: ProjectMonthlyAssignmentRequest) => Promise<boolean>;
  updateAssignment: (id: number, patch: PatchedProjectMonthlyAssignmentRequest) => Promise<boolean>;
  deleteAssignment: (id: number) => Promise<boolean>;
  bulkCreateAssignments: (payloads: ProjectMonthlyAssignmentRequest[]) => Promise<boolean>;
  bulkSetConfirmed: (ids: number[], isConfirmed: boolean) => Promise<boolean>;
  /** Create a KippoProject from its required fields (organization + name).
   * `columnset` is resolved from the org's default columnset on the backend. */
  createProject: (payload: KippoProjectRequest) => Promise<boolean>;
};

function useWrap(refresh: () => Promise<void>, setHookError: (err: string) => void) {
  const [isSaving, setIsSaving] = useState(false);
  const wrap = useCallback(
    async <T>(operation: () => Promise<T>, errorMessage: string): Promise<boolean> => {
      setIsSaving(true);
      setHookError("");
      try {
        await operation();
        await refresh();
        return true;
      } catch (error) {
        // Surface DRF field errors when the operation throwOnError'd a non-2xx response; otherwise
        // fall back to the generic message (apiErrorMessage returns null for non-ApiError throws).
        setHookError(apiErrorMessage(error) ?? errorMessage);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [refresh, setHookError],
  );
  return { isSaving, wrap };
}

export function useProjectAssignmentMutations(
  refresh: () => Promise<void>,
  setHookError: (err: string) => void,
): ProjectAssignmentMutations {
  const { isSaving, wrap } = useWrap(refresh, setHookError);

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
  // Pattern-accept flow: post each row sequentially. The kippo backend has no bulk
  // endpoint; on partial failure the rows already created remain (acceptable for v1).
  const bulkCreateAssignments = useCallback(
    (payloads: ProjectMonthlyAssignmentRequest[]) =>
      wrap(async () => {
        for (const payload of payloads) {
          await monthlyAssignmentsCreate(payload);
        }
      }, "パターンの登録に失敗しました"),
    [wrap],
  );
  // Month-level confirm / unconfirm (kippo#23): sequential PATCHes, same
  // constraint as bulkCreateAssignments — no bulk endpoint. Backend post_save
  // (kippo#17, merged via monkut/kippo#288) drives auto-extension on each row.
  const bulkSetConfirmed = useCallback(
    (ids: number[], isConfirmed: boolean) =>
      wrap(
        async () => {
          for (const id of ids) {
            await monthlyAssignmentsPartialUpdate(id, { is_confirmed: isConfirmed });
          }
        },
        isConfirmed ? "月の確定に失敗しました" : "月の確定解除に失敗しました",
      ),
    [wrap],
  );

  const createProject = useCallback(
    (payload: KippoProjectRequest) =>
      wrap(
        async () => throwOnError(await projectsCreate(payload)),
        "プロジェクトの作成に失敗しました",
      ),
    [wrap],
  );

  return {
    isSaving,
    setError: setHookError,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    bulkCreateAssignments,
    bulkSetConfirmed,
    createProject,
  };
}
