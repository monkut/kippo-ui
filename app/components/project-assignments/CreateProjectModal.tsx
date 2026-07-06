import { useEffect, useState } from "react";
import type {
  KippoCustomer,
  KippoProjectRequest,
  Organization,
  PhaseEnum,
} from "~/lib/api/generated/models";
import { customersList } from "~/lib/api/generated/customers/customers";
import { organizationsList } from "~/lib/api/generated/organizations/organizations";
import { readList } from "~/lib/api/read-list";
import { DateField, SelectField, TextField } from "~/components/project-form/LabeledField";
import {
  CREATE_PHASE_OPTIONS,
  CategorySelectField,
  DEFAULT_PHASE,
  PhaseSelectField,
} from "~/components/project-form/fields";
import { ErrorBanner, ModalActions, ModalShell } from "~/components/project-form/ModalShell";
import { useProjectCategories } from "~/components/project-form/useProjectFormData";

type CreateProjectModalProps = {
  open: boolean;
  isSaving: boolean;
  onClose: () => void;
  /** Persist the new project. Returns true on success so the modal can close.
   * Slim registration: customer / name / start_date / phase / category (kippo#40 /
   * T19, slimmed); `columnset` resolves from the organization's default on the
   * backend. Everything else — 担当PM, 完了予定日, the contract / 請求方法 — is
   * added on a later edit as needed. */
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
  const [phase, setPhase] = useState<PhaseEnum>(DEFAULT_PHASE);
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setOrganizationId("");
    setName("");
    setCustomer(null);
    setPhase(DEFAULT_PHASE);
    setCategory("");
    setStartDate("");
  }, [open]);

  // Clear org-scoped selections when the organization changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setCustomer(null);
    setCategory("");
  }, [organizationId]);

  return {
    organizationId,
    setOrganizationId,
    name,
    setName,
    customer,
    setCustomer,
    phase,
    setPhase,
    category,
    setCategory,
    startDate,
    setStartDate,
  };
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
        if (!cancelled) setResults(readList<KippoCustomer>(response.data));
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
  const categories = useProjectCategories(open, form.organizationId);

  // Default to the sole/first organization once loaded — most users belong to one org.
  useEffect(() => {
    if (open && organizations.length > 0 && !form.organizationId) {
      form.setOrganizationId(organizations[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organizations]);

  if (!open) return null;

  const trimmedName = form.name.trim();
  // category is optional (model default; may be unsubmittable when the org has no writable global
  // category — handleSubmit omits it) so it must NOT gate submit, or 作成 would deadlock for such orgs.
  const submitDisabled =
    isSaving ||
    isLoadingOrgs ||
    !form.organizationId ||
    trimmedName.length === 0 ||
    !form.customer ||
    !form.phase ||
    !form.startDate;

  const handleSubmit = async () => {
    if (submitDisabled) return;
    // Send category only when it's a writable (global) key; otherwise omit (undefined → omitted)
    // rather than 400-ing on the globals-only serializer queryset.
    const categoryValue = categories.some((c) => c.key === form.category)
      ? form.category
      : undefined;
    const ok = await onSubmit({
      organization: form.organizationId,
      name: trimmedName,
      customer: form.customer?.id ?? null,
      phase: form.phase,
      category: categoryValue,
      start_date: form.startDate,
    });
    if (ok) onClose();
  };

  return (
    <ModalShell title="新規プロジェクト作成" onClose={onClose}>
      {orgError && <ErrorBanner message={orgError} />}
      <p className="mb-4 text-sm text-gray-500">
        登録には企業・開始日が必須です。カラムセットは組織の既定値が適用されます。担当PM・完了予定日・請求方法（契約）などは作成後の編集で登録します。
      </p>
      <div className="space-y-4">
        <OrganizationSelectField
          value={form.organizationId}
          onChange={form.setOrganizationId}
          organizations={organizations}
          disabled={isSaving || isLoadingOrgs}
          isLoading={isLoadingOrgs}
        />
        <TextField
          id="create-project-name"
          label="プロジェクト名"
          value={form.name}
          onChange={form.setName}
          disabled={isSaving}
          maxLength={256}
        />
        <CustomerAutocompleteField
          open={open}
          organizationId={form.organizationId}
          customer={form.customer}
          onSelect={form.setCustomer}
          disabled={isSaving || !form.organizationId}
        />
        <DateField
          id="create-project-start"
          label="開始日"
          value={form.startDate}
          onChange={form.setStartDate}
          disabled={isSaving}
        />
        <PhaseSelectField
          id="create-project-phase"
          value={form.phase}
          onChange={form.setPhase}
          disabled={isSaving}
          options={CREATE_PHASE_OPTIONS}
        />
        <CategorySelectField
          id="create-project-category"
          value={form.category}
          onChange={form.setCategory}
          categories={categories}
          disabled={isSaving || !form.organizationId}
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
    <SelectField
      id="create-project-org"
      label="組織"
      value={value}
      onChange={onChange}
      disabled={disabled || organizations.length === 0}
    >
      {isLoading && <option value="">読み込み中...</option>}
      {!isLoading && organizations.length === 0 && <option value="">(組織がありません)</option>}
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </SelectField>
  );
}
