import { type ReactNode, useState } from "react";
import { LabeledField } from "./LabeledField";

// Fields and section cards of the full-page project edit form (/projects/:id/edit). They share
// the label wrapper with the modal fields in LabeledField.tsx; the controls keep their own
// classes (greyed text when disabled, optional `disabled`, numeric `step`).

const PAGE_INPUT_CLASS =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-medium text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

// Collapsible section (native <details>) — starts collapsed so secondary config is tucked away
// after creation (kippo#42 / KIPPO_PROJECT_FIELDS.md). The disclosure arrow rotates with the
// open state (tracked in React so the icon reflects expand/collapse).
export function CollapsibleSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="bg-white shadow rounded-lg p-6"
    >
      <summary className="flex cursor-pointer select-none items-center gap-2 text-lg font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
        <span className={`text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        {title}
      </summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}

export function Input({
  id,
  label,
  value,
  onChange,
  type = "text",
  maxLength,
  step,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "date" | "url" | "number";
  maxLength?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <LabeledField id={id} label={label}>
      <input
        id={id}
        type={type}
        min={type === "number" ? 0 : undefined}
        step={step}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={PAGE_INPUT_CLASS}
      />
    </LabeledField>
  );
}

export function Select({
  id,
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <LabeledField id={id} label={label}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={PAGE_INPUT_CLASS}
      >
        {children}
      </select>
    </LabeledField>
  );
}

export function TextArea({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <LabeledField id={id} label={label}>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </LabeledField>
  );
}

export function Checkbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-gray-700">
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
