import { useState } from "react";
import {
  requirementsProblemDefinitionsCreate,
  requirementsProblemDefinitionsPartialUpdate,
} from "~/lib/api/generated/requirements/requirements";
import type { ProblemType } from "../types";

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
  const [entries, setEntries] = useState<ProblemEntry[]>([{ id: 1, title: "", details: "" }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addEntry = () => {
    setEntries([...entries, { id: Date.now(), title: "", details: "" }]);
  };

  const removeEntry = (id: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((e) => e.id !== id));
    }
  };

  const updateEntry = (id: number, field: "title" | "details", value: string) => {
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

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
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-medium text-gray-900 mb-3">新規課題定義</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}
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
                onChange={(e) => updateEntry(entry.id, "title", e.target.value)}
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
                onChange={(e) => updateEntry(entry.id, "details", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 resize-y"
                placeholder="詳細"
                disabled={isSubmitting}
                rows={2}
              />
            </div>
            {entries.length > 1 && (
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                title="削除"
                disabled={isSubmitting}
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
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
          disabled={isSubmitting}
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
            disabled={isSubmitting || !hasValidEntry}
          >
            {isSubmitting
              ? "作成中..."
              : `作成${entries.filter((e) => e.title.trim()).length > 1 ? ` (${entries.filter((e) => e.title.trim()).length}件)` : ""}`}
          </button>
        </div>
      </form>
    </div>
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
    <form onSubmit={handleSubmit} className="space-y-3 bg-indigo-50 p-3 rounded-md">
      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
          {problem.display_id}
        </span>
        <span className="text-xs text-gray-500">を編集中</span>
      </div>
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
          disabled={isSubmitting || !title.trim()}
        >
          {isSubmitting ? "更新中..." : "更新"}
        </button>
      </div>
    </form>
  );
}
