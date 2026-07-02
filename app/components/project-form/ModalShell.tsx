import type { ReactNode } from "react";

/** Centered overlay dialog used by the project/customer create modals. */
export function ModalShell({
  title,
  onClose,
  children,
  contentClassName,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Extra classes for the inner panel (e.g. `my-8` for the taller customer form). */
  contentClassName?: string;
}) {
  const panelClass = [
    "relative bg-white rounded-lg shadow-xl max-w-md w-full p-6",
    contentClassName,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="fixed inset-0 bg-black bg-opacity-25 cursor-default"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={panelClass}>
          <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{message}</div>;
}

export function ModalActions({
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
