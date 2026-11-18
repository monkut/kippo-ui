import { useCallback, useState } from "react";
import {
  monthlyAssignmentsDestroy,
  monthlyAssignmentsPartialUpdate,
} from "~/lib/api/generated/monthly-assignments/monthly-assignments";
import type {
  KippoProjectRequest,
  ProjectParticipantCreateRequest,
  ProjectParticipantResponse,
  PatchedProjectMonthlyAssignmentRequest,
} from "~/lib/api/generated/models";
import { projectsCreate, projectsParticipantsCreate } from "~/lib/api/generated/projects/projects";
import { apiErrorMessage, throwOnError } from "~/lib/api/api-error";

export type ProjectAssignmentMutations = {
  isSaving: boolean;
  setError: (err: string) => void;
  updateAssignment: (id: number, patch: PatchedProjectMonthlyAssignmentRequest) => Promise<boolean>;
  deleteAssignment: (id: number) => Promise<boolean>;
  /** Add a project participant: one row per month over the remaining period (kippo#72, #75 R1).
   * Resolves to the created rows + skipped months, or null on failure (error set). */
  addParticipant: (
    projectId: string,
    payload: ProjectParticipantCreateRequest,
  ) => Promise<ProjectParticipantResponse | null>;
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

  const updateAssignment = useCallback(
    (id: number, patch: PatchedProjectMonthlyAssignmentRequest) =>
      wrap(() => monthlyAssignmentsPartialUpdate(id, patch), "割当の更新に失敗しました"),
    [wrap],
  );
  const deleteAssignment = useCallback(
    (id: number) => wrap(() => monthlyAssignmentsDestroy(id), "割当の削除に失敗しました"),
    [wrap],
  );
  const addParticipant = useCallback(
    async (projectId: string, payload: ProjectParticipantCreateRequest) => {
      let result: ProjectParticipantResponse | null = null;
      const ok = await wrap(async () => {
        const response = throwOnError(await projectsParticipantsCreate(projectId, payload));
        result = response.data as ProjectParticipantResponse;
      }, "参加者の追加に失敗しました");
      return ok ? result : null;
    },
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
    updateAssignment,
    deleteAssignment,
    addParticipant,
    createProject,
  };
}
