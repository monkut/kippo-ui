import type { KippoCustomer, KippoProjectRequest } from "~/lib/api/generated/models";
import { ModalShell } from "~/components/project-form/ModalShell";
import { ProjectForm, type ProjectFormValues } from "~/components/project-form/ProjectForm";
import { useProjectFormData } from "~/components/project-form/useProjectFormData";

// Create a project for a customer from the Customers list (kippo#42). Organization + customer are
// fixed (from the customer) and shown read-only. Collects the required KippoProject /add/ fields
// (KIPPO_PROJECT_FIELDS.md / kippo#41) via the shared ProjectForm. (The contract / 請求方法 is
// created separately after the project.) Editing an existing project is the /projects/:id/edit page.
export type ProjectFormTarget = { customer: KippoCustomer };

type CustomerProjectModalProps = {
  open: boolean;
  target: ProjectFormTarget | null;
  isSaving: boolean;
  onClose: () => void;
  onCreate: (payload: KippoProjectRequest) => Promise<boolean>;
};

export function CustomerProjectModal({
  open,
  target,
  isSaving,
  onClose,
  onCreate,
}: CustomerProjectModalProps) {
  const organizationId = target?.customer.organization ?? "";
  const organizationName = target?.customer.organization_name ?? "";
  const customerName = target?.customer.name ?? "";

  const { members, categories } = useProjectFormData(open, organizationId);

  if (!open || !target) return null;

  const handleSubmit = async (values: ProjectFormValues) => {
    const ok = await onCreate({
      organization: target.customer.organization,
      customer: target.customer.id,
      ...values,
    });
    if (ok) onClose();
  };

  return (
    <ModalShell title="新規プロジェクト作成" onClose={onClose} contentClassName="my-8">
      <ProjectForm
        header={
          <div className="text-sm text-gray-600">
            <span className="font-medium">組織:</span> {organizationName}
            {customerName && (
              <>
                <span className="mx-2 text-gray-300">/</span>
                <span className="font-medium">顧客:</span> {customerName}
              </>
            )}
          </div>
        }
        members={members}
        categories={categories}
        isSaving={isSaving}
        onCancel={onClose}
        onSubmit={handleSubmit}
      />
    </ModalShell>
  );
}
