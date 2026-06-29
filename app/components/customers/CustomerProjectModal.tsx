import { useEffect, useState } from "react";
import type {
  KippoCustomer,
  KippoProjectOrganizationCategory,
  KippoProjectRequest,
  OrganizationMember,
  PhaseEnum,
} from "~/lib/api/generated/models";
import { organizationsMembersRetrieve } from "~/lib/api/generated/organizations/organizations";
import { projectCategoriesList } from "~/lib/api/generated/project-categories/project-categories";

// Create a project for a customer from the Customers list (kippo#42). Organization + customer are
// fixed (from the customer) and shown read-only. Collects the required KippoProject /add/ fields
// (KIPPO_PROJECT_FIELDS.md / kippo#41): プロジェクト名 / ステータス / カテゴリ / 担当PM / 開始日 / 完了予定日 /
// 必要工数 / 課題定義. (The contract / 請求方法 is created separately after the project — same as the
// existing CreateProjectModal.) Editing an existing project is the dedicated /projects/:id/edit page.
export type ProjectFormTarget = { customer: KippoCustomer };

// phase key -> Japanese label (mirrors VALID_PROJECT_PHASES in kippo projects/models.py).
export const PHASE_OPTIONS: { value: PhaseEnum; label: string }[] = [
  { value: "keep-in-touch", label: "KIT" },
  { value: "proposing-low", label: "提案(低)" },
  { value: "proposing-mid", label: "提案(中)" },
  { value: "proposing-high", label: "提案(高)" },
  { value: "verbal-order", label: "口頭受注" },
  { value: "under-contract", label: "契約(稼働中)" },
  { value: "completed", label: "完了" },
  { value: "lost", label: "失注" },
];
const DEFAULT_PHASE: PhaseEnum = "proposing-low";

type CustomerProjectModalProps = {
  open: boolean;
  target: ProjectFormTarget | null;
  isSaving: boolean;
  onClose: () => void;
  onCreate: (payload: KippoProjectRequest) => Promise<boolean>;
};

/** Org members for the 担当PM picker (mirrors CreateProjectModal). */
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

/** Writable categories for the org via kippo#341. Only globals are writable (the project serializer's
 * category queryset is organization__isnull); org-specific keys would 400 on save, so exclude them. */
function useCategories(open: boolean, organizationId: string) {
  const [categories, setCategories] = useState<KippoProjectOrganizationCategory[]>([]);

  useEffect(() => {
    if (!open || !organizationId) {
      setCategories([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await projectCategoriesList({ organization: organizationId });
        if (!cancelled)
          setCategories((response.data?.results ?? []).filter((c) => c.organization == null));
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

  return categories;
}

function useProjectForm(open: boolean) {
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<PhaseEnum>(DEFAULT_PHASE);
  const [category, setCategory] = useState("");
  const [projectManagerId, setProjectManagerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [allocatedStaffDays, setAllocatedStaffDays] = useState("");
  const [problemDefinition, setProblemDefinition] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setPhase(DEFAULT_PHASE);
    setCategory("");
    setProjectManagerId("");
    setStartDate("");
    setTargetDate("");
    setAllocatedStaffDays("");
    setProblemDefinition("");
  }, [open]);

  return {
    name,
    setName,
    phase,
    setPhase,
    category,
    setCategory,
    projectManagerId,
    setProjectManagerId,
    startDate,
    setStartDate,
    targetDate,
    setTargetDate,
    allocatedStaffDays,
    setAllocatedStaffDays,
    problemDefinition,
    setProblemDefinition,
  };
}

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

  const form = useProjectForm(open);
  const members = useOrgMembers(open, organizationId);
  const categories = useCategories(open, organizationId);

  if (!open || !target) return null;

  const trimmedName = form.name.trim();
  const allocatedDays = form.allocatedStaffDays.trim();
  // Enforce the full required /add/ set (kippo#41).
  const createComplete =
    trimmedName.length > 0 &&
    !!form.projectManagerId &&
    !!form.startDate &&
    !!form.targetDate &&
    !!form.phase &&
    !!form.category &&
    allocatedDays !== "" &&
    form.problemDefinition.trim().length > 0;
  const submitDisabled = isSaving || !createComplete;

  const handleSubmit = async () => {
    if (submitDisabled) return;
    const allocated = allocatedDays === "" ? null : Number.parseInt(allocatedDays, 10);
    // Send category only when it's a writable (global) key; otherwise omit (undefined → omitted) so an
    // org-specific prefill is left unchanged rather than 400-ing on the globals-only serializer queryset.
    const category = categories.some((c) => c.key === form.category) ? form.category : undefined;
    const ok = await onCreate({
      organization: target.customer.organization,
      customer: target.customer.id,
      name: trimmedName,
      phase: form.phase,
      category,
      project_manager: form.projectManagerId,
      start_date: form.startDate,
      target_date: form.targetDate,
      allocated_staff_days: allocated,
      problem_definition: form.problemDefinition,
    });
    if (ok) onClose();
  };

  const disabled = isSaving;

  return (
    <ModalShell title="新規プロジェクト作成" onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          <span className="font-medium">組織:</span> {organizationName}
          {customerName && (
            <>
              <span className="mx-2 text-gray-300">/</span>
              <span className="font-medium">顧客:</span> {customerName}
            </>
          )}
        </div>
        <TextField
          id="customer-project-name"
          label="プロジェクト名"
          value={form.name}
          onChange={form.setName}
          disabled={disabled}
          maxLength={256}
        />
        <PhaseSelectField value={form.phase} onChange={form.setPhase} disabled={disabled} />
        <CategorySelectField
          value={form.category}
          onChange={form.setCategory}
          categories={categories}
          disabled={disabled}
        />
        <ProjectManagerField
          value={form.projectManagerId}
          onChange={form.setProjectManagerId}
          members={members}
          disabled={disabled}
        />
        <DateField
          id="customer-project-start"
          label="開始日"
          value={form.startDate}
          onChange={form.setStartDate}
          disabled={disabled}
        />
        <DateField
          id="customer-project-target"
          label="完了予定日"
          value={form.targetDate}
          onChange={form.setTargetDate}
          disabled={disabled}
        />
        <NumberField
          id="customer-project-allocated"
          label="必要工数(人日)"
          value={form.allocatedStaffDays}
          onChange={form.setAllocatedStaffDays}
          disabled={disabled}
        />
        <TextAreaField
          id="customer-project-problem"
          label="課題定義"
          value={form.problemDefinition}
          onChange={form.setProblemDefinition}
          disabled={disabled}
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

function PhaseSelectField({
  value,
  onChange,
  disabled,
}: {
  value: PhaseEnum;
  onChange: (v: PhaseEnum) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label
        htmlFor="customer-project-phase"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        ステータス
      </label>
      <select
        id="customer-project-phase"
        value={value}
        onChange={(e) => onChange(e.target.value as PhaseEnum)}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
      >
        {PHASE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CategorySelectField({
  value,
  onChange,
  categories,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  categories: KippoProjectOrganizationCategory[];
  disabled: boolean;
}) {
  return (
    <div>
      <label
        htmlFor="customer-project-category"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        カテゴリ
      </label>
      <select
        id="customer-project-category"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || categories.length === 0}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
      >
        <option value="">
          {categories.length === 0 ? "(カテゴリがありません)" : "選択してください"}
        </option>
        {categories.map((category) => (
          <option key={category.key} value={category.key}>
            {category.label}
          </option>
        ))}
      </select>
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
      <label htmlFor="customer-project-pm" className="block text-sm font-medium text-gray-700 mb-1">
        担当PM
      </label>
      <select
        id="customer-project-pm"
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

function TextField({
  id,
  label,
  value,
  onChange,
  disabled,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="text"
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
      />
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

function NumberField({
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
        type="number"
        min={0}
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
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 my-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  );
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
