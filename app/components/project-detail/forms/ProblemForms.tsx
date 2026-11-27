import { useState } from "react";
import {
  requirementsProblemDefinitionsCreate,
  requirementsProblemDefinitionsPartialUpdate,
} from "~/lib/api/generated/requirements/requirements";
import { useEntryList } from "~/hooks/useEntryList";
import type { ProblemType } from "../types";
import {
  AddEntryButton,
  createSubmitLabel,
  EditFormShell,
  FormActions,
  InlineCreateShell,
  RemoveEntryButton,
} from "./scaffolding";

interface ProblemInlineFormProps {
  projectId: string;
  onCancel: () => void;
  onCreated: () => void;
}

type ProblemEntry = {
  id: number;
  title: string;
  details: string;
};

export function ProblemInlineForm({ projectId, onCancel, onCreated }: ProblemInlineFormProps) {
  const { entries, add, remove, update } = useEntryList<ProblemEntry>([
    { id: 1, title: "", details: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addEntry = () => add({ id: Date.now(), title: "", details: "" });

  const hasValidEntry = entries.some((e) => e.title.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validEntries = entries.filter((entry) => entry.title.trim());
    if (validEntries.length === 0) return;

    setIsSubmitting(true);
    setError("");
    try {
      for (const entry of validEntries) {
        await requirementsProblemDefinitionsCreate({
          project: projectId,
          title: entry.title.trim(),
          details: entry.details.trim() || undefined,
        });
      }
      onCreated();
    } catch (err) {
      console.error("Failed to create problem:", err);
      setError("課題定義の作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <InlineCreateShell title="新規課題定義" error={error} onSubmit={handleSubmit}>
      {entries.map((entry, index) => (
        <div
          key={entry.id}
          className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-start"
        >
          <div>
            <label
              htmlFor={`problem-title-${entry.id}`}
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              タイトル
            </label>
            <input
              type="text"
              id={`problem-title-${entry.id}`}
              value={entry.title}
              onChange={(e) => update(entry.id, { title: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
              placeholder="課題のタイトル"
              disabled={isSubmitting}
              autoFocus={index === 0}
            />
          </div>
          <div>
            <label
              htmlFor={`problem-details-${entry.id}`}
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              詳細（任意）
            </label>
            <textarea
              id={`problem-details-${entry.id}`}
              value={entry.details}
              onChange={(e) => update(entry.id, { details: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 resize-y"
              placeholder="詳細"
              disabled={isSubmitting}
              rows={2}
            />
          </div>
          {entries.length > 1 && (
            <RemoveEntryButton onClick={() => remove(entry.id)} disabled={isSubmitting} />
          )}
        </div>
      ))}
      <AddEntryButton onClick={addEntry} disabled={isSubmitting} />
      <FormActions
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitDisabled={isSubmitting || !hasValidEntry}
      >
        {createSubmitLabel(isSubmitting, entries.filter((e) => e.title.trim()).length)}
      </FormActions>
    </InlineCreateShell>
  );
}

interface ProblemEditFormProps {
  problem: ProblemType;
  onCancel: () => void;
  onUpdated: () => void;
}

export function ProblemEditForm({ problem, onCancel, onUpdated }: ProblemEditFormProps) {
  const [title, setTitle] = useState(problem.title);
  const [details, setDetails] = useState(problem.details || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError("");
    try {
      await requirementsProblemDefinitionsPartialUpdate(problem.id, {
        title: title.trim(),
        details: details.trim() || undefined,
      });
      onUpdated();
    } catch (err) {
      console.error("Failed to update problem:", err);
      setError("課題定義の更新に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <EditFormShell displayId={problem.display_id} error={error} onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`edit-problem-title-${problem.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            タイトル
          </label>
          <input
            type="text"
            id={`edit-problem-title-${problem.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        <div className="md:col-span-2">
          <label
            htmlFor={`edit-problem-details-${problem.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            詳細（任意）
          </label>
          <textarea
            id={`edit-problem-details-${problem.id}`}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 resize-y"
            disabled={isSubmitting}
            rows={2}
          />
        </div>
      </div>
      <FormActions
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitDisabled={isSubmitting || !title.trim()}
      >
        {isSubmitting ? "更新中..." : "更新"}
      </FormActions>
    </EditFormShell>
  );
}
