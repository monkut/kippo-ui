import { useCallback, useState } from "react";
import { projectsCreate } from "~/lib/api/generated/projects/projects";
import type { KippoProjectRequest } from "~/lib/api/generated/models";

// Create a project from the Customers list (kippo#42 — "add project for this customer"). The call
// refreshes the customer list and reports a Japanese error. (Editing a project is the dedicated
// /projects/:id/edit page.)
export type CustomerProjectMutations = {
  isSaving: boolean;
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

  return { isSaving, createProject };
}
