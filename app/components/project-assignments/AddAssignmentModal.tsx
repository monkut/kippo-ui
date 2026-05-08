import { useEffect, useState } from "react";
import type { ProjectMonthlyAssignment, ProjectMonthlyAssignmentRequest } from "~/lib/api/generated/models";
import { extractProjectMembers, firstOfNextMonth } from "./utils";

type AddAssignmentModalProps = {
  open: boolean;
  projectId: string;
  existingAssignments: ProjectMonthlyAssignment[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: ProjectMonthlyAssignmentRequest) => Promise<boolean>;
};

const DEFAULT_PERCENTAGE = 50;

export function AddAssignmentModal(props: AddAssignmentModalProps) {
  const { open, projectId, existingAssignments, isSaving, onClose, onSubmit } = props;
  const members = extractProjectMembers(existingAssignments);
  const form = useAddAssignmentForm(open, members);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!form.userId) {
      form.setValidationError("ユーザーを選択してください");
      return;
    }
    if (!form.month) {
      form.setValidationError("月を入力してください");
      return;
    }
    const ok = await onSubmit({
      project: projectId,
      user: form.userId,
      month: normalizeToFirstOfMonth(form.month),
      percentage: form.percentage,
      is_confirmed: form.isConfirmed,
    });
    if (ok) onClose();
  };

  const hasMembers = members.length > 0;

  return (
    <ModalShell title="割当を追加" onClose={onClose}>
      {!hasMembers && <NoMembersHint />}
      {form.validationError && <ErrorBanner message={form.validationError} />}
      <div className="space-y-4">
        <UserSelectField value={form.userId} onChange={form.setUserId} members={members} disabled={isSaving} />
        <MonthField value={form.month} onChange={form.setMonth} disabled={isSaving} />
        <PercentageField value={form.percentage} onChange={form.setPercentage} disabled={isSaving} />
        <ConfirmedField value={form.isConfirmed} onChange={form.setIsConfirmed} disabled={isSaving} />
      </div>
      <ModalActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        submitDisabled={!hasMembers}
        submitLabel="追加"
      />
    </ModalShell>
  );
}

function useAddAssignmentForm(open: boolean, members: ReturnType<typeof extractProjectMembers>) {
  const [userId, setUserId] = useState("");
  const [month, setMonth] = useState(firstOfNextMonth(new Date()));
  const [percentage, setPercentage] = useState(DEFAULT_PERCENTAGE);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!open) return;
    setUserId(members[0]?.user_id ?? "");
    setMonth(firstOfNextMonth(new Date()));
    setPercentage(DEFAULT_PERCENTAGE);
    setIsConfirmed(false);
    setValidationError("");
    // members derives from props.existingAssignments — re-derived per render is fine here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return {
    userId,
    setUserId,
    month,
    setMonth,
    percentage,
    setPercentage,
    isConfirmed,
    setIsConfirmed,
    validationError,
    setValidationError,
  };
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

function NoMembersHint() {
  return (
    <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
      このプロジェクトにはまだ割当ユーザーがいません。新しいユーザーの追加は、現在kippo管理画面で行ってください。
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{message}</div>
  );
}

function UserSelectField({
  value,
  onChange,
  members,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  members: ReturnType<typeof extractProjectMembers>;
  disabled: boolean;
}) {
  return (
    <div>
      <label htmlFor="add-assignment-user" className="block text-sm font-medium text-gray-700 mb-1">
        ユーザー
      </label>
      <select
        id="add-assignment-user"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || members.length === 0}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
      >
        {members.length === 0 && <option value="">(対象ユーザーがいません)</option>}
        {members.map((member) => (
          <option key={member.user_id} value={member.user_id}>
            {member.display_name}
          </option>
        ))}
      </select>
    </div>
  );
}

function MonthField({
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
      <label htmlFor="add-assignment-month" className="block text-sm font-medium text-gray-700 mb-1">
        月 (月初日)
      </label>
      <input
        id="add-assignment-month"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <p className="mt-1 text-xs text-gray-500">月初日 (YYYY-MM-01) で保存されます。</p>
    </div>
  );
}

function PercentageField({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label htmlFor="add-assignment-pct" className="block text-sm font-medium text-gray-700 mb-1">
        割当 (%)
      </label>
      <input
        id="add-assignment-pct"
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        disabled={disabled}
        className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

function ConfirmedField({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center">
      <input
        type="checkbox"
        id="add-assignment-confirmed"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      <label htmlFor="add-assignment-confirmed" className="ml-2 block text-sm text-gray-700">
        確定済みとして登録
      </label>
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

function normalizeToFirstOfMonth(dateStr: string): string {
  if (!dateStr) return dateStr;
  return `${dateStr.slice(0, 7)}-01`;
}
