import type {
  KippoProjectOrganizationCategory,
  LeadSourceEnum,
  OrganizationMember,
  PhaseEnum,
} from "~/lib/api/generated/models";
import { SelectField } from "./LabeledField";

// lead_source key -> Japanese label (mirrors VALID_LEAD_SOURCES in kippo projects/definitions.py).
export const LEAD_SOURCE_OPTIONS: { value: LeadSourceEnum; label: string }[] = [
  { value: "sunx", label: "SUNX経由" },
  { value: "info", label: "info" },
  { value: "employee-referral", label: "社員紹介" },
  { value: "customer-referral", label: "顧客紹介" },
  { value: "continuation", label: "継続" },
];

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

export const DEFAULT_PHASE: PhaseEnum = "proposing-low";

// Phases selectable at project CREATE: 契約(稼働中) is excluded because the API cannot attach a
// contract at create time, so it always rejects a create directly in that phase. The move to
// 契約(稼働中) happens on a later edit, once the contract (with its period) has been added.
export const CREATE_PHASE_OPTIONS = PHASE_OPTIONS.filter(
  (option) => option.value !== "under-contract",
);

export function ProjectManagerField({
  id,
  value,
  onChange,
  members,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  members: OrganizationMember[];
  disabled: boolean;
}) {
  return (
    <SelectField
      id={id}
      label="担当PM"
      value={value}
      onChange={onChange}
      disabled={disabled || members.length === 0}
    >
      <option value="">{members.length === 0 ? "(メンバーがいません)" : "選択してください"}</option>
      {members.map((member) => (
        <option key={member.user_id} value={member.user_id}>
          {member.display_name || member.username}
        </option>
      ))}
    </SelectField>
  );
}

export function PhaseSelectField({
  id,
  value,
  onChange,
  disabled,
  options = PHASE_OPTIONS,
}: {
  id: string;
  value: PhaseEnum;
  onChange: (v: PhaseEnum) => void;
  disabled: boolean;
  options?: { value: PhaseEnum; label: string }[];
}) {
  return (
    <SelectField
      id={id}
      label="ステータス"
      value={value}
      onChange={(v) => onChange(v as PhaseEnum)}
      disabled={disabled}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </SelectField>
  );
}

export function CategorySelectField({
  id,
  value,
  onChange,
  categories,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  categories: KippoProjectOrganizationCategory[];
  disabled: boolean;
}) {
  return (
    <SelectField
      id={id}
      label="カテゴリ"
      value={value}
      onChange={onChange}
      disabled={disabled || categories.length === 0}
    >
      <option value="">
        {categories.length === 0 ? "(カテゴリがありません)" : "選択してください"}
      </option>
      {categories.map((category) => (
        <option key={category.key} value={category.key}>
          {category.label}
        </option>
      ))}
    </SelectField>
  );
}
