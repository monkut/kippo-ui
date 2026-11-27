import type { FormEvent, ReactNode } from "react";

// Shared frame of the four requirement form pairs (課題定義 / 前提条件 / ビジネス要件 / 技術要件):
// the create form with its add / remove entry buttons, the edit form header, the error box
// and the キャンセル / submit row. The fields themselves stay in each form.

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="rounded-md bg-red-50 p-3">
      <div className="text-sm text-red-800">{message}</div>
    </div>
  );
}

type FormShellProps = {
  error: string;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
};

/** Multi-entry create form shown under a section's list. */
export function InlineCreateShell({
  title,
  error,
  onSubmit,
  children,
}: FormShellProps & { title: string }) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-medium text-gray-900 mb-3">{title}</h4>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormError message={error} />
        {children}
      </form>
    </div>
  );
}

/** Edit form that replaces a row in place; the header names the row being edited. */
export function EditFormShell({
  displayId,
  error,
  onSubmit,
  children,
}: FormShellProps & { displayId: string }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 bg-indigo-50 p-3 rounded-md">
      <FormError message={error} />
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{displayId}</span>
        <span className="text-xs text-gray-500">を編集中</span>
      </div>
      {children}
    </form>
  );
}

// Class literals are kept whole so Tailwind's source scanner emits them.
const REMOVE_ENTRY_CLASS = "p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md";
const REMOVE_ENTRY_CLASS_BELOW_LABEL =
  "p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md mt-6";

/** × button removing one entry row of a create form. `belowLabel` aligns it with inputs that
 * sit under a label. */
export function RemoveEntryButton({
  onClick,
  disabled,
  belowLabel = false,
}: {
  onClick: () => void;
  disabled: boolean;
  belowLabel?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={belowLabel ? REMOVE_ENTRY_CLASS_BELOW_LABEL : REMOVE_ENTRY_CLASS}
      title="削除"
      disabled={disabled}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

/** ＋ 追加 button appending an entry row to a create form. */
export function AddEntryButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
      disabled={disabled}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-4 h-4"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      追加
    </button>
  );
}

/** キャンセル + submit row. `children` is the submit button label. */
export function FormActions({
  onCancel,
  isSubmitting,
  submitDisabled,
  children,
}: {
  onCancel: () => void;
  isSubmitting: boolean;
  submitDisabled: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        disabled={isSubmitting}
      >
        キャンセル
      </button>
      <button
        type="submit"
        className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
        disabled={submitDisabled}
      >
        {children}
      </button>
    </div>
  );
}

/** Submit label of a create form: 作成, with the entry count once more than one is valid. */
export function createSubmitLabel(isSubmitting: boolean, validCount: number): string {
  if (isSubmitting) return "作成中...";
  return `作成${validCount > 1 ? ` (${validCount}件)` : ""}`;
}
