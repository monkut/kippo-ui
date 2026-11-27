import {
  requirementsAssumptionsDestroy,
  requirementsBusinessRequirementsDestroy,
  requirementsProblemDefinitionsDestroy,
  requirementsTechnicalRequirementsDestroy,
} from "~/lib/api/generated/requirements/requirements";

type DeleteAction = {
  confirmMessage: (title: string) => string;
  destroy: (id: number) => Promise<unknown>;
  errorMessage: string;
};

const DELETE_ACTIONS = {
  assumption: {
    confirmMessage: (title) => `前提条件「${title}」を削除しますか？`,
    destroy: requirementsAssumptionsDestroy,
    errorMessage: "前提条件の削除に失敗しました",
  },
  problem: {
    confirmMessage: (title) =>
      `課題定義「${title}」を削除しますか？\n関連するビジネス要件も削除されます。`,
    destroy: requirementsProblemDefinitionsDestroy,
    errorMessage: "課題定義の削除に失敗しました",
  },
  business: {
    confirmMessage: (title) =>
      `ビジネス要件「${title}」を削除しますか？\n関連する技術要件も削除されます。`,
    destroy: requirementsBusinessRequirementsDestroy,
    errorMessage: "ビジネス要件の削除に失敗しました",
  },
  technical: {
    confirmMessage: (title) => `技術要件「${title}」を削除しますか？`,
    destroy: requirementsTechnicalRequirementsDestroy,
    errorMessage: "技術要件の削除に失敗しました",
  },
} satisfies Record<string, DeleteAction>;

export type DeletableKind = keyof typeof DELETE_ACTIONS;

export type DeleteResult =
  | { status: "cancelled" }
  | { status: "deleted" }
  | { status: "failed"; message: string };

/** Ask for confirmation, then delete the requirement element of `kind`. */
export async function confirmAndDelete(
  kind: DeletableKind,
  id: number,
  title: string,
): Promise<DeleteResult> {
  const action: DeleteAction = DELETE_ACTIONS[kind];
  if (!window.confirm(action.confirmMessage(title))) return { status: "cancelled" };
  try {
    await action.destroy(id);
    return { status: "deleted" };
  } catch (err) {
    console.error(action.errorMessage, err);
    return { status: "failed", message: action.errorMessage };
  }
}
