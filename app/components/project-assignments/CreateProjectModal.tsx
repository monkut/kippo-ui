import { useEffect, useState } from "react";
import type {
  KippoCustomer,
  KippoProjectRequest,
  Organization,
  OrganizationMember,
} from "~/lib/api/generated/models";
import { customersList } from "~/lib/api/generated/customers/customers";
import {
  organizationsList,
  organizationsMembersRetrieve,
} from "~/lib/api/generated/organizations/organizations";

type CreateProjectModalProps = {
  open: boolean;
  isSaving: boolean;
  onClose: () => void;
  /** Persist the new project. Returns true on success so the modal can close.
   * Registration requires customer / project_manager / start_date / target_date
   * (kippo#40 / T19); `columnset` resolves from the organization's default on the
   * backend. The contract / 請求方法 is added separately after creation. */
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
  const [customer, setCustomer] = useState<KippoCustomer | null>(null);
  const [projectManagerId, setProjectManagerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setOrganizationId("");
    setName("");
    setCustomer(null);
    setProjectManagerId("");
    setStartDate("");
    setTargetDate("");
  }, [open]);

  // Clear org-scoped selections when the organization changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setCustomer(null);
    setProjectManagerId("");
  }, [organizationId]);

  return {
    organizationId,
    setOrganizationId,
    name,
    setName,
    customer,
    setCustomer,
    projectManagerId,
    setProjectManagerId,
    startDate,
    setStartDate,
    targetDate,
    setTargetDate,
  };
}

/** Org members for the project-manager picker (kippo#40 / T19). */
function useOrgMembers(open: boolean, organizationId: string) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);

  useEffect(() => {
    if (!open || !organizationId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await organizationsMembersRetrieve(organizationId);
        if (!cancelled) setMembers(response.status === 200 ? (response.data.members ?? []) : []);
      } catch {
        if (!cancelled) setMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

  return members;
}

/** Debounced customer search within the selected org for the 企業 autocomplete (kippo#34 / T04). */
function useCustomerSearch(open: boolean, organizationId: string, query: string) {
  const [results, setResults] = useState<KippoCustomer[]>([]);

  useEffect(() => {
    if (!open || !organizationId || query.trim().length === 0) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await customersList({
          organization: organizationId,
          search: query.trim(),
        });
        if (!cancelled) setResults(response.data?.results ?? []);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, organizationId, query]);

  return results;
}

export function CreateProjectModal({ open, isSaving, onClose, onSubmit }: CreateProjectModalProps) {
  const { organizations, isLoading: isLoadingOrgs, error: orgError } = useOrganizations(open);
  const form = useCreateProjectForm(open);
  const members = useOrgMembers(open, form.organizationId);

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
    isSaving ||
    isLoadingOrgs ||
    !form.organizationId ||
    trimmedName.length === 0 ||
    !form.customer ||
    !form.projectManagerId ||
    !form.startDate ||
    !form.targetDate;

  const handleSubmit = async () => {
    if (submitDisabled) return;
    const ok = await onSubmit({
      organization: form.organizationId,
      name: trimmedName,
      customer: form.customer?.id ?? null,
      project_manager: form.projectManagerId,
      start_date: form.startDate,
      target_date: form.targetDate,
    });
    if (ok) onClose();
  };

  return (
    <ModalShell title="新規プロジェクト作成" onClose={onClose}>
      {orgError && <ErrorBanner message={orgError} />}
      <p className="mb-4 text-sm text-gray-500">
        登録には企業・担当PM・開始日・完了予定日が必須です。カラムセットは組織の既定値が適用されます。請求方法（契約）は作成後に登録します。
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
        <CustomerAutocompleteField
          open={open}
          organizationId={form.organizationId}
          customer={form.customer}
          onSelect={form.setCustomer}
          disabled={isSaving || !form.organizationId}
        />
        <ProjectManagerField
          value={form.projectManagerId}
          onChange={form.setProjectManagerId}
          members={members}
          disabled={isSaving || !form.organizationId}
        />
        <DateField
          id="create-project-start"
          label="開始日"
          value={form.startDate}
          onChange={form.setStartDate}
          disabled={isSaving}
        />
        <DateField
          id="create-project-target"
          label="完了予定日"
          value={form.targetDate}
          onChange={form.setTargetDate}
          disabled={isSaving}
        />
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

/** 企業 autocomplete — searches /api/customers/ within the org; on select shows the
 * customer's contract-folder URL (document_url) read-only (kippo#34 / T04). */
function CustomerAutocompleteField({
  open,
  organizationId,
  customer,
  onSelect,
  disabled,
}: {
  open: boolean;
  organizationId: string;
  customer: KippoCustomer | null;
  onSelect: (customer: KippoCustomer | null) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const results = useCustomerSearch(open, organizationId, query);
  const showResults = query.trim().length > 0 && !customer;

  return (
    <div>
      <label
        htmlFor="create-project-customer"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        企業
      </label>
      {customer ? (
        <div className="flex items-center justify-between rounded-md border border-gray-300 px-3 py-2 text-sm">
          <span className="font-medium text-gray-800">{customer.name}</span>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            disabled={disabled}
            className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            変更
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            id="create-project-customer"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={disabled}
            placeholder="企業名で検索"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
          />
          {showResults && results.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(result);
                      setQuery("");
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-indigo-50"
                  >
                    {result.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {/* 契約書フォルダURL — the linked customer's document_url (kippo#34 / T04) */}
      {customer?.document_url && (
        <p className="mt-1 text-xs text-gray-500">
          契約書フォルダ:{" "}
          <a
            href={customer.document_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            {customer.document_url}
          </a>
        </p>
      )}
    </div>
  );
}

function ProjectManagerField({
  value,
  onChange,
  members,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  members: OrganizationMember[];
  disabled: boolean;
}) {
  return (
    <div>
      <label htmlFor="create-project-pm" className="block text-sm font-medium text-gray-700 mb-1">
        担当PM
      </label>
      <select
        id="create-project-pm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || members.length === 0}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
      >
        <option value="">
          {members.length === 0 ? "(メンバーがいません)" : "選択してください"}
        </option>
        {members.map((member) => (
          <option key={member.user_id} value={member.user_id}>
            {member.display_name || member.username}
          </option>
        ))}
      </select>
    </div>
  );
}

function DateField({
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
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
      />
    </div>
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
