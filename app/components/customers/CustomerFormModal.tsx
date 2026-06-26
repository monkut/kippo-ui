import { useEffect, useState } from "react";
import type { KippoCustomer, KippoCustomerRequest, Organization } from "~/lib/api/generated/models";
import { organizationsList } from "~/lib/api/generated/organizations/organizations";

// Create/edit a KippoCustomer, mirroring KippoCustomerAdmin's add/change form (kippo#42).
// `customer` present → edit mode (organization is fixed and shown read-only); absent → create.
// 名前 is required and unique per organization; all other fields are optional.
type CustomerFormModalProps = {
  open: boolean;
  isSaving: boolean;
  customer?: KippoCustomer | null;
  onClose: () => void;
  /** Persist the customer. Returns true on success so the modal can close. */
  onSubmit: (payload: KippoCustomerRequest) => Promise<boolean>;
};

/** Pull the org list out of the `/api/organizations/` response. The endpoint returns
 * `{organizations: [...]}` at runtime, but drf-spectacular auto-paginates the schema
 * (`{count, results}`) — so read both shapes defensively (matches CreateProjectModal). */
function extractOrganizations(data: unknown): Organization[] {
  const payload = data as {
    organizations?: Organization[];
    results?: { organizations?: Organization[] }[];
  };
  if (Array.isArray(payload.organizations)) return payload.organizations;
  if (Array.isArray(payload.results)) return payload.results.flatMap((r) => r.organizations ?? []);
  return [];
}

/** Organizations for the create-mode picker (not loaded in edit mode — org is fixed). */
function useOrganizations(open: boolean, enabled: boolean) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !enabled) return;
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
  }, [open, enabled]);

  return { organizations, isLoading, error };
}

function useCustomerForm(open: boolean, customer: KippoCustomer | null | undefined) {
  const [organizationId, setOrganizationId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [contractFolderUrl, setContractFolderUrl] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setOrganizationId(customer?.organization ?? "");
    setName(customer?.name ?? "");
    setEmail(customer?.email ?? "");
    setPhone(customer?.phone ?? "");
    setWebsite(customer?.website ?? "");
    setDocumentUrl(customer?.document_url ?? "");
    setContractFolderUrl(customer?.contract_folder_url ?? "");
    setNotes(customer?.notes ?? "");
  }, [open, customer]);

  return {
    organizationId,
    setOrganizationId,
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    website,
    setWebsite,
    documentUrl,
    setDocumentUrl,
    contractFolderUrl,
    setContractFolderUrl,
    notes,
    setNotes,
  };
}

export function CustomerFormModal({
  open,
  isSaving,
  customer,
  onClose,
  onSubmit,
}: CustomerFormModalProps) {
  const isEdit = Boolean(customer);
  const form = useCustomerForm(open, customer);
  const {
    organizations,
    isLoading: isLoadingOrgs,
    error: orgError,
  } = useOrganizations(open, !isEdit);

  // Create mode: default to the sole/first org once loaded — most users belong to one org.
  useEffect(() => {
    if (open && !isEdit && organizations.length > 0 && !form.organizationId) {
      form.setOrganizationId(organizations[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, organizations]);

  if (!open) return null;

  const trimmedName = form.name.trim();
  const submitDisabled =
    isSaving || (!isEdit && isLoadingOrgs) || !form.organizationId || trimmedName.length === 0;

  const handleSubmit = async () => {
    if (submitDisabled) return;
    const ok = await onSubmit({
      organization: form.organizationId,
      name: trimmedName,
      email: form.email.trim(),
      phone: form.phone.trim(),
      website: form.website.trim(),
      document_url: form.documentUrl.trim(),
      contract_folder_url: form.contractFolderUrl.trim(),
      notes: form.notes,
    });
    if (ok) onClose();
  };

  return (
    <ModalShell title={isEdit ? "顧客を編集" : "新規顧客作成"} onClose={onClose}>
      {orgError && <ErrorBanner message={orgError} />}
      <div className="space-y-4">
        {isEdit ? (
          <div className="text-sm text-gray-600">
            <span className="font-medium">組織:</span> {customer?.organization_name}
          </div>
        ) : (
          <OrganizationSelectField
            value={form.organizationId}
            onChange={form.setOrganizationId}
            organizations={organizations}
            disabled={isSaving || isLoadingOrgs}
            isLoading={isLoadingOrgs}
          />
        )}
        <TextField
          id="customer-form-name"
          label="顧客名"
          value={form.name}
          onChange={form.setName}
          disabled={isSaving}
          maxLength={256}
        />
        <TextField
          id="customer-form-email"
          label="メールアドレス"
          type="email"
          value={form.email}
          onChange={form.setEmail}
          disabled={isSaving}
          maxLength={254}
        />
        <TextField
          id="customer-form-phone"
          label="電話番号"
          value={form.phone}
          onChange={form.setPhone}
          disabled={isSaving}
          maxLength={50}
        />
        <TextField
          id="customer-form-website"
          label="ウェブサイト"
          type="url"
          value={form.website}
          onChange={form.setWebsite}
          disabled={isSaving}
          maxLength={200}
        />
        <TextField
          id="customer-form-document-url"
          label="関連ドキュメントURL"
          type="url"
          value={form.documentUrl}
          onChange={form.setDocumentUrl}
          disabled={isSaving}
          maxLength={200}
        />
        <TextField
          id="customer-form-contract-folder-url"
          label="契約書フォルダURL"
          type="url"
          value={form.contractFolderUrl}
          onChange={form.setContractFolderUrl}
          disabled={isSaving}
          maxLength={200}
        />
        <TextAreaField
          id="customer-form-notes"
          label="備考"
          value={form.notes}
          onChange={form.setNotes}
          disabled={isSaving}
        />
      </div>
      <ModalActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        submitDisabled={submitDisabled}
        submitLabel={isEdit ? "保存" : "作成"}
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
      <label htmlFor="customer-form-org" className="block text-sm font-medium text-gray-700 mb-1">
        組織
      </label>
      <select
        id="customer-form-org"
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

function TextField({
  id,
  label,
  value,
  onChange,
  disabled,
  type = "text",
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  type?: "text" | "email" | "url";
  maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
      />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
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
