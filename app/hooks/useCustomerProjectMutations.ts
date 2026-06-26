import { useCallback, useState } from "react";
import { projectsCreate, projectsPartialUpdate } from "~/lib/api/generated/projects/projects";
import type { KippoProjectRequest, PatchedKippoProjectRequest } from "~/lib/api/generated/models";

// Create/update projects from the Customers list (kippo#42 — "add project for this customer" and
// editing an active project). Each call refreshes the customer list and reports a Japanese error.
export type CustomerProjectMutations = {
  isSaving: boolean;
  createProject: (payload: KippoProjectRequest) => Promise<boolean>;
  updateProject: (id: string, patch: PatchedKippoProjectRequest) => Promise<boolean>;
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
      } catch {
        setHookError(errorMessage);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [refresh, setHookError],
  );
  return { isSaving, wrap };
}

export function useCustomerProjectMutations(
  refresh: () => Promise<void>,
  setHookError: (err: string) => void,
): CustomerProjectMutations {
  const { isSaving, wrap } = useWrap(refresh, setHookError);

  const createProject = useCallback(
    (payload: KippoProjectRequest) =>
      wrap(() => projectsCreate(payload), "プロジェクトの作成に失敗しました"),
    [wrap],
  );

  const updateProject = useCallback(
    (id: string, patch: PatchedKippoProjectRequest) =>
      wrap(() => projectsPartialUpdate(id, patch), "プロジェクトの更新に失敗しました"),
    [wrap],
  );

  return { isSaving, createProject, updateProject };
}
