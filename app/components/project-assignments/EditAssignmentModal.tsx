import { useEffect, useState } from "react";
import type { ProjectMonthlyAssignment, PatchedProjectMonthlyAssignmentRequest } from "~/lib/api/generated/models";

type EditAssignmentModalProps = {
  open: boolean;
  assignment: ProjectMonthlyAssignment | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (id: number, patch: PatchedProjectMonthlyAssignmentRequest) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
};

export function EditAssignmentModal(props: EditAssignmentModalProps) {
  const { open, assignment, isSaving, onClose, onSave, onDelete } = props;
  const form = useEditForm(open, assignment);

  if (!open || !assignment) return null;

  const handleSave = async () => {
    const ok = await onSave(assignment.id, { percentage: form.percentage, is_confirmed: form.isConfirmed });
    if (ok) onClose();
  };
  const handleDelete = async () => {
    if (!window.confirm(`${assignment.user_display_name} の ${assignment.month} の割当を削除しますか?`)) return;
    const ok = await onDelete(assignment.id);
    if (ok) onClose();
  };

  return (
    <ModalShell title="割当を編集" onClose={onClose}>
      <ReadOnlyHeader assignment={assignment} />
      <div className="space-y-4">
        <PercentageField value={form.percentage} onChange={form.setPercentage} disabled={isSaving} />
        <ConfirmedField value={form.isConfirmed} onChange={form.setIsConfirmed} disabled={isSaving} />
      </div>
      <ModalActions onDelete={handleDelete} onCancel={onClose} onSave={handleSave} isSaving={isSaving} />
    </ModalShell>
  );
}

function useEditForm(open: boolean, assignment: ProjectMonthlyAssignment | null) {
  const [percentage, setPercentage] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  useEffect(() => {
    if (open && assignment) {
      setPercentage(assignment.percentage);
      setIsConfirmed(assignment.is_confirmed ?? false);
    }
  }, [open, assignment]);
  return { percentage, setPercentage, isConfirmed, setIsConfirmed };
}

function ReadOnlyHeader({ assignment }: { assignment: ProjectMonthlyAssignment }) {
  return (
    <div className="mb-4 space-y-1 text-sm text-gray-600">
      <div>
        <span className="font-medium">ユーザー:</span> {assignment.user_display_name}
      </div>
      <div>
        <span className="font-medium">月:</span> {assignment.month}
      </div>
    </div>
  );
}

function ModalActions({
  onDelete,
  onCancel,
  onSave,
  isSaving,
}: {
  onDelete: () => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="mt-6 flex gap-3 justify-between">
      <button
        type="button"
        onClick={onDelete}
        disabled={isSaving}
        className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
      >
        削除
      </button>
      <div className="flex gap-3">
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
          onClick={onSave}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
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
      <label htmlFor="edit-assignment-pct" className="block text-sm font-medium text-gray-700 mb-1">
        割当 (%)
      </label>
      <input
        id="edit-assignment-pct"
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
        id="edit-assignment-confirmed"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      <label htmlFor="edit-assignment-confirmed" className="ml-2 block text-sm text-gray-700">
        確定済み
      </label>
    </div>
  );
}
