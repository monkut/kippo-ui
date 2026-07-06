import { type ReactNode, useState } from "react";
import type { KippoProjectOrganizationCategory, PhaseEnum } from "~/lib/api/generated/models";
import { DateField, TextField } from "./LabeledField";
import {
  CREATE_PHASE_OPTIONS,
  CategorySelectField,
  DEFAULT_PHASE,
  PhaseSelectField,
} from "./fields";
import { ModalActions } from "./ModalShell";

/** Shared project-create field values (slim registration).
 * `category` is undefined when the selected key isn't a writable global — the
 * caller omits it rather than 400-ing on the globals-only serializer queryset. */
export type ProjectFormValues = {
  name: string;
  phase: PhaseEnum;
  category: string | undefined;
  start_date: string;
};

/** The slim KippoProject /add/ form: プロジェクト名 / ステータス / カテゴリ / 開始日. Everything
 * else (担当PM, 完了予定日, 契約, 見積 …) is added on a later edit as needed. State resets
 * naturally because the host modal only mounts this while open. `header` renders
 * modal-specific read-only context above the fields. */
export function ProjectForm({
  header,
  categories,
  isSaving,
  onCancel,
  onSubmit,
}: {
  header?: ReactNode;
  categories: KippoProjectOrganizationCategory[];
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (values: ProjectFormValues) => void;
}) {
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<PhaseEnum>(DEFAULT_PHASE);
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState("");

  const trimmedName = name.trim();
  // Enforce the slim required /add/ set. category is optional (the model defaults it, and it may be
  // unsubmittable when the org has no writable global category — handleSubmit omits it in that case),
  // so it must NOT gate submit or the 作成 button would deadlock for such orgs.
  const createComplete = trimmedName.length > 0 && !!startDate && !!phase;
  const submitDisabled = isSaving || !createComplete;

  const handleSubmit = () => {
    if (submitDisabled) return;
    // Send category only when it's a writable (global) key; otherwise omit (undefined → omitted) so an
    // org-specific prefill is left unchanged rather than 400-ing on the globals-only serializer queryset.
    const categoryValue = categories.some((c) => c.key === category) ? category : undefined;
    onSubmit({
      name: trimmedName,
      phase,
      category: categoryValue,
      start_date: startDate,
    });
  };

  const disabled = isSaving;

  return (
    <>
      <div className="space-y-4">
        {header}
        <TextField
          id="customer-project-name"
          label="プロジェクト名"
          value={name}
          onChange={setName}
          disabled={disabled}
          maxLength={256}
        />
        <PhaseSelectField
          id="customer-project-phase"
          value={phase}
          onChange={setPhase}
          disabled={disabled}
          options={CREATE_PHASE_OPTIONS}
        />
        <CategorySelectField
          id="customer-project-category"
          value={category}
          onChange={setCategory}
          categories={categories}
          disabled={disabled}
        />
        <DateField
          id="customer-project-start"
          label="開始日"
          value={startDate}
          onChange={setStartDate}
          disabled={disabled}
        />
      </div>
      <ModalActions
        onCancel={onCancel}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        submitDisabled={submitDisabled}
        submitLabel="作成"
      />
    </>
  );
}
