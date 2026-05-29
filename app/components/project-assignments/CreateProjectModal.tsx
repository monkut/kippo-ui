import { useEffect, useState } from "react";
import type { KippoProjectRequest, Organization } from "~/lib/api/generated/models";
import { organizationsList } from "~/lib/api/generated/organizations/organizations";

type CreateProjectModalProps = {
  open: boolean;
  isSaving: boolean;
  onClose: () => void;
  /** Persist the new project. Returns true on success so the modal can close.
   * Only the project's required fields are sent — `columnset` is resolved from
   * the organization's default columnset on the backend (kippo#…). */
  onSubmit: (payload: KippoProjectRequest) => Promise<boolean>;
};

/** Pull the org list out of the `/api/organizations/` response. The endpoint
 * returns `{organizations: [...]}` at runtime, but drf-spectacular auto-paginates
 * the schema (`{count, results}`) — so the generated type disagrees with reality.
 * Read both shapes defensively rather than trusting the generated type. */
function extractOrganizations(data: unknown): Organization[] {
  const payload = data as {
    organizations?: Organization[];
    results?: { organizations?: Organization[] }[];
  };
  if (Array.isArray(payload.organizations)) return payload.organizations;
  if (Array.isArray(payload.results)) return payload.results.flatMap((r) => r.organizations ?? []);
  return [];
}

function useOrganizations(open: boolean) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setError("");
    setOrganizations([]);
    let cancelled = false;
    (async () => {
      try {
        const response = await organizationsList();
        if (cancelled) return;
        setOrganizations(extractOrganizations(response.data));
      } catch {
        if (!cancelled) setError("組織の取得に失敗しました");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  return { organizations, isLoading, error };
}

function useCreateProjectForm(open: boolean) {
  const [organizationId, setOrganizationId] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setOrganizationId("");
    setName("");
  }, [open]);

  return { organizationId, setOrganizationId, name, setName };
}

export function CreateProjectModal({ open, isSaving, onClose, onSubmit }: CreateProjectModalProps) {
  const { organizations, isLoading: isLoadingOrgs, error: orgError } = useOrganizations(open);
  const form = useCreateProjectForm(open);

  // Default to the sole/first organization once loaded — most users belong to one org.
  useEffect(() => {
    if (open && organizations.length > 0 && !form.organizationId) {
      form.setOrganizationId(organizations[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organizations]);

  if (!open) return null;

  const trimmedName = form.name.trim();
  const submitDisabled =
    isSaving || isLoadingOrgs || !form.organizationId || trimmedName.length === 0;

  const handleSubmit = async () => {
    if (submitDisabled) return;
    const ok = await onSubmit({ organization: form.organizationId, name: trimmedName });
    if (ok) onClose();
  };

  return (
    <ModalShell title="新規プロジェクト作成" onClose={onClose}>
      {orgError && <ErrorBanner message={orgError} />}
      <p className="mb-4 text-sm text-gray-500">
        必須項目のみで作成します。カラムセットは組織の既定値が適用されます。
      </p>
      <div className="space-y-4">
        <OrganizationSelectField
          value={form.organizationId}
          onChange={form.setOrganizationId}
          organizations={organizations}
          disabled={isSaving || isLoadingOrgs}
          isLoading={isLoadingOrgs}
        />
        <NameField value={form.name} onChange={form.setName} disabled={isSaving} />
      </div>
      <ModalActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        submitDisabled={submitDisabled}
        submitLabel="作成"
      />
    </ModalShell>
  );
}

function OrganizationSelectField({
  value,
  onChange,
  organizations,
  disabled,
  isLoading,
}: {
  value: string;
  onChange: (v: string) => void;
  organizations: Organization[];
  disabled: boolean;
  isLoading: boolean;
}) {
  // One org → nothing to choose; show it as a read-only label (still submitted via state).
  if (!isLoading && organizations.length === 1) {
    return (
      <div className="text-sm text-gray-600">
        <span className="font-medium">組織:</span> {organizations[0].name}
      </div>
    );
  }
  return (
    <div>
      <label htmlFor="create-project-org" className="block text-sm font-medium text-gray-700 mb-1">
        組織
      </label>
      <select
        id="create-project-org"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || organizations.length === 0}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
      >
        {isLoading && <option value="">読み込み中...</option>}
        {!isLoading && organizations.length === 0 && <option value="">(組織がありません)</option>}
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function NameField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label htmlFor="create-project-name" className="block text-sm font-medium text-gray-700 mb-1">
        プロジェクト名
      </label>
      <input
        id="create-project-name"
        type="text"
        maxLength={256}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
      />
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
          <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{message}</div>;
}

function ModalActions({
  onCancel,
  onSubmit,
  isSaving,
  submitDisabled,
  submitLabel,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  submitDisabled?: boolean;
  submitLabel: string;
}) {
  return (
    <div className="mt-6 flex gap-3 justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
      >
        キャンセル
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSaving || submitDisabled}
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? "保存中..." : submitLabel}
      </button>
    </div>
  );
}
