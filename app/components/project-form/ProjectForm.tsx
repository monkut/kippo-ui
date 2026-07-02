import { type ReactNode, useState } from "react";
import type {
  KippoProjectOrganizationCategory,
  OrganizationMember,
  PhaseEnum,
} from "~/lib/api/generated/models";
import { DateField, NumberField, TextAreaField, TextField } from "./LabeledField";
import {
  CategorySelectField,
  DEFAULT_PHASE,
  PhaseSelectField,
  ProjectManagerField,
} from "./fields";
import { ModalActions } from "./ModalShell";

/** Shared project-create field values (KIPPO_PROJECT_FIELDS.md / kippo#41).
 * `category` is undefined when the selected key isn't a writable global — the
 * caller omits it rather than 400-ing on the globals-only serializer queryset. */
export type ProjectFormValues = {
  name: string;
  phase: PhaseEnum;
  category: string | undefined;
  project_manager: string;
  start_date: string;
  target_date: string;
  allocated_staff_days: number | null;
  problem_definition: string;
};

/** The full required KippoProject /add/ form: プロジェクト名 / ステータス / カテゴリ / 担当PM /
 * 開始日 / 完了予定日 / 必要工数 / 課題定義. State resets naturally because the host modal only
 * mounts this while open. `header` renders modal-specific read-only context above the fields. */
export function ProjectForm({
  header,
  members,
  categories,
  isSaving,
  onCancel,
  onSubmit,
}: {
  header?: ReactNode;
  members: OrganizationMember[];
  categories: KippoProjectOrganizationCategory[];
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (values: ProjectFormValues) => void;
}) {
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<PhaseEnum>(DEFAULT_PHASE);
  const [category, setCategory] = useState("");
  const [projectManagerId, setProjectManagerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [allocatedStaffDays, setAllocatedStaffDays] = useState("");
  const [problemDefinition, setProblemDefinition] = useState("");

  const trimmedName = name.trim();
  const allocatedDays = allocatedStaffDays.trim();
  // Enforce the full required /add/ set (kippo#41).
  const createComplete =
    trimmedName.length > 0 &&
    !!projectManagerId &&
    !!startDate &&
    !!targetDate &&
    !!phase &&
    !!category &&
    allocatedDays !== "" &&
    problemDefinition.trim().length > 0;
  const submitDisabled = isSaving || !createComplete;

  const handleSubmit = () => {
    if (submitDisabled) return;
    const allocated = allocatedDays === "" ? null : Number.parseInt(allocatedDays, 10);
    // Send category only when it's a writable (global) key; otherwise omit (undefined → omitted) so an
    // org-specific prefill is left unchanged rather than 400-ing on the globals-only serializer queryset.
    const categoryValue = categories.some((c) => c.key === category) ? category : undefined;
    onSubmit({
      name: trimmedName,
      phase,
      category: categoryValue,
      project_manager: projectManagerId,
      start_date: startDate,
      target_date: targetDate,
      allocated_staff_days: allocated,
      problem_definition: problemDefinition,
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
        />
        <CategorySelectField
          id="customer-project-category"
          value={category}
          onChange={setCategory}
          categories={categories}
          disabled={disabled}
        />
        <ProjectManagerField
          id="customer-project-pm"
          value={projectManagerId}
          onChange={setProjectManagerId}
          members={members}
          disabled={disabled}
        />
        <DateField
          id="customer-project-start"
          label="開始日"
          value={startDate}
          onChange={setStartDate}
          disabled={disabled}
        />
        <DateField
          id="customer-project-target"
          label="完了予定日"
          value={targetDate}
          onChange={setTargetDate}
          disabled={disabled}
        />
        <NumberField
          id="customer-project-allocated"
          label="必要工数(人日)"
          value={allocatedStaffDays}
          onChange={setAllocatedStaffDays}
          disabled={disabled}
        />
        <TextAreaField
          id="customer-project-problem"
          label="課題定義"
          value={problemDefinition}
          onChange={setProblemDefinition}
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
