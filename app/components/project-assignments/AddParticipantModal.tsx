import { useEffect, useMemo, useState } from "react";
import type {
  KippoProject,
  ProjectParticipantCreateRequest,
  ProjectParticipantResponse,
  RoleEnum,
} from "~/lib/api/generated/models";
import { firstOfMonth, formatMonth, remainingPeriod } from "~/lib/dates";
import {
  ErrorBanner,
  ModalActions,
  ModalShell,
  orderMembersForPicker,
  PercentageField,
  UserSelectField,
  useDefaultUserSelection,
  useOrgMembers,
} from "./assignment-form";

const DEFAULT_PERCENTAGE = 50;

const ROLE_OPTIONS: ReadonlyArray<{ value: RoleEnum | ""; label: string }> = [
  { value: "", label: "(指定なし)" },
  // Raw values, as the admin shows them (the backend defines no display labels).
  { value: "developer", label: "developer" },
  { value: "project_manager", label: "project_manager" },
  { value: "tester", label: "tester" },
];

type AddParticipantModalProps = {
  open: boolean;
  project: KippoProject;
  effortUsernames: ReadonlySet<string>;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (
    payload: ProjectParticipantCreateRequest,
  ) => Promise<ProjectParticipantResponse | null>;
};

/** 参加者を追加 (kiconiaworks/kippo#73): one request creates the user's monthly assignments for
 * each month of the remaining period (kippo#75 R1: the later of this month and the start_date month,
 * through target_date); existing months are skipped. */
export function AddParticipantModal({
  open,
  project,
  effortUsernames,
  isSaving,
  onClose,
  onSubmit,
}: AddParticipantModalProps) {
  const { members, isLoadingMembers, fetchError } = useOrgMembers(open, project.id);
  const orderedMembers = useMemo(
    () => orderMembersForPicker(members, effortUsernames),
    [members, effortUsernames],
  );
  const [userId, setUserId] = useState("");
  const [percentage, setPercentage] = useState(DEFAULT_PERCENTAGE);
  const [role, setRole] = useState<RoleEnum | "">("");
  const [result, setResult] = useState<ProjectParticipantResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    setUserId("");
    setPercentage(DEFAULT_PERCENTAGE);
    setRole("");
    setResult(null);
  }, [open]);
  useDefaultUserSelection(open, orderedMembers, userId, setUserId);

  if (!open) return null;

  const remaining = remainingPeriod(
    project.start_date,
    project.target_date,
    firstOfMonth(new Date()),
  );
  const period = remaining ? `${formatMonth(remaining.from)} 〜 ${formatMonth(remaining.to)}` : "—";

  if (result) {
    return (
      <ModalShell title="参加者を追加しました" onClose={onClose}>
        <ParticipantResult result={result} />
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            閉じる
          </button>
        </div>
      </ModalShell>
    );
  }

  const handleSubmit = async () => {
    if (!userId) return;
    const response = await onSubmit({ user: userId, percentage, role });
    if (response) setResult(response);
  };

  return (
    <ModalShell title="参加者を追加" onClose={onClose}>
      {fetchError && <ErrorBanner message={fetchError} />}
      <p className="mb-4 text-sm text-gray-600">
        残りの期間 <span className="font-medium text-gray-900">{period}</span>{" "}
        の各月に同じ割当を登録します。登録済みの月は変更しません。
      </p>
      <div className="space-y-4">
        <UserSelectField
          value={userId}
          onChange={setUserId}
          members={orderedMembers}
          effortUsernames={effortUsernames}
          disabled={isSaving || isLoadingMembers}
          isLoading={isLoadingMembers}
        />
        <PercentageField value={percentage} onChange={setPercentage} disabled={isSaving} />
        <RoleField value={role} onChange={setRole} disabled={isSaving} />
      </div>
      <ModalActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        submitDisabled={orderedMembers.length === 0 || isLoadingMembers}
        submitLabel="追加"
      />
    </ModalShell>
  );
}

function ParticipantResult({ result }: { result: ProjectParticipantResponse }) {
  const createdMonths = result.created.map((a) => formatMonth(a.month ?? "")).sort();
  const skippedMonths = result.skipped_months.map(formatMonth);
  return (
    <div className="space-y-2 text-sm text-gray-700">
      <p>
        作成: <span className="font-semibold">{createdMonths.length}か月</span>
        {createdMonths.length > 0 && ` (${createdMonths[0]} 〜 ${createdMonths.at(-1)})`}
      </p>
      {skippedMonths.length > 0 && (
        <p>
          登録済みのためスキップ: <span className="font-semibold">{skippedMonths.length}か月</span>{" "}
          ({skippedMonths.join(", ")})
        </p>
      )}
    </div>
  );
}

function RoleField({
  value,
  onChange,
  disabled,
}: {
  value: RoleEnum | "";
  onChange: (v: RoleEnum | "") => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label
        htmlFor="add-participant-role"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        ロール
      </label>
      <select
        id="add-participant-role"
        value={value}
        onChange={(e) => onChange(e.target.value as RoleEnum | "")}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
      >
        {ROLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
