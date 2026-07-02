import { useState } from "react";
import {
  requirementsAssumptionsCreate,
  requirementsAssumptionsPartialUpdate,
} from "~/lib/api/generated/requirements/requirements";
import type { ProjectAssumptionCategoryEnum } from "~/lib/api/generated/models";
import type { AssumptionCategoryChoice, AssumptionType } from "../types";

interface AssumptionInlineFormProps {
  projectId: string;
  categories: AssumptionCategoryChoice[];
  onCancel: () => void;
  onCreated: () => void;
}

type AssumptionEntry = {
  id: number;
  title: string;
  details: string;
  categoryValue: string;
  isInternal: boolean;
};

export function AssumptionInlineForm({
  projectId,
  categories,
  onCancel,
  onCreated,
}: AssumptionInlineFormProps) {
  const defaultCategoryValue = categories.length > 0 ? categories[0].value : "";
  const [entries, setEntries] = useState<AssumptionEntry[]>([
    { id: 1, title: "", details: "", categoryValue: defaultCategoryValue, isInternal: false },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addEntry = () => {
    setEntries([
      ...entries,
      {
        id: Date.now(),
        title: "",
        details: "",
        categoryValue: defaultCategoryValue,
        isInternal: false,
      },
    ]);
  };

  const removeEntry = (id: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((e) => e.id !== id));
    }
  };

  const updateEntry = (
    id: number,
    field: keyof AssumptionEntry,
    value: string | number | boolean,
  ) => {
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const hasValidEntry = entries.some((e) => e.title.trim() && e.categoryValue);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validEntries = entries.filter((entry) => entry.title.trim() && entry.categoryValue);
    if (validEntries.length === 0) return;

    setIsSubmitting(true);
    setError("");
    try {
      for (const entry of validEntries) {
        await requirementsAssumptionsCreate({
          project: projectId,
          title: entry.title.trim(),
          details: entry.details.trim() || undefined,
          category: entry.categoryValue as ProjectAssumptionCategoryEnum,
          is_internal: entry.isInternal,
        });
      }
      onCreated();
    } catch (err) {
      console.error("Failed to create assumption:", err);
      setError("前提条件の作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-medium text-gray-900 mb-3">新規前提条件</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className="grid grid-cols-1 md:grid-cols-[1fr_8rem_2fr_auto_auto] gap-3 items-start"
          >
            <div>
              <label
                htmlFor={`assumption-title-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                タイトル
              </label>
              <input
                type="text"
                id={`assumption-title-${entry.id}`}
                value={entry.title}
                onChange={(e) => updateEntry(entry.id, "title", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                placeholder="前提条件のタイトル"
                disabled={isSubmitting}
                autoFocus={index === 0}
              />
            </div>
            <div>
              <label
                htmlFor={`assumption-category-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                カテゴリ
              </label>
              <select
                id={`assumption-category-${entry.id}`}
                value={entry.categoryValue}
                onChange={(e) => updateEntry(entry.id, "categoryValue", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                disabled={isSubmitting}
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor={`assumption-details-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                詳細（任意）
              </label>
              <textarea
                id={`assumption-details-${entry.id}`}
                value={entry.details}
                onChange={(e) => updateEntry(entry.id, "details", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 resize-y"
                placeholder="詳細"
                disabled={isSubmitting}
                rows={2}
              />
            </div>
            <div className="flex items-center mt-6">
              <input
                type="checkbox"
                id={`assumption-internal-${entry.id}`}
                checked={entry.isInternal}
                onChange={(e) => updateEntry(entry.id, "isInternal", e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                disabled={isSubmitting}
              />
              <label
                htmlFor={`assumption-internal-${entry.id}`}
                className="ml-2 text-xs font-medium text-gray-700 whitespace-nowrap"
              >
                社内のみ
              </label>
            </div>
            <div className="flex items-center mt-6">
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

interface AssumptionEditFormProps {
  assumption: AssumptionType;
  categories: AssumptionCategoryChoice[];
  onCancel: () => void;
  onUpdated: () => void;
}

export function AssumptionEditForm({
  assumption,
  categories,
  onCancel,
  onUpdated,
}: AssumptionEditFormProps) {
  const [title, setTitle] = useState(assumption.title);
  const [details, setDetails] = useState(assumption.details || "");
  const [categoryValue, setCategoryValue] = useState<string>(assumption.category || "assumption");
  const [isInternal, setIsInternal] = useState(assumption.is_internal ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError("");
    try {
      await requirementsAssumptionsPartialUpdate(assumption.id, {
        title: title.trim(),
        details: details.trim() || undefined,
        category: categoryValue as ProjectAssumptionCategoryEnum,
        is_internal: isInternal,
      });
      onUpdated();
    } catch (err) {
      console.error("Failed to update assumption:", err);
      setError("前提条件の更新に失敗しました");
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
          {assumption.display_id}
        </span>
        <span className="text-xs text-gray-500">を編集中</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`edit-assumption-category-${assumption.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            カテゴリ
          </label>
          <select
            id={`edit-assumption-category-${assumption.id}`}
            value={categoryValue}
            onChange={(e) => setCategoryValue(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
            disabled={isSubmitting}
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`edit-assumption-title-${assumption.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            タイトル
          </label>
          <input
            type="text"
            id={`edit-assumption-title-${assumption.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        <div className="md:col-span-2">
          <label
            htmlFor={`edit-assumption-details-${assumption.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            詳細（任意）
          </label>
          <textarea
            id={`edit-assumption-details-${assumption.id}`}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 resize-y"
            disabled={isSubmitting}
            rows={2}
          />
        </div>
        <div className="md:col-span-2 flex items-center">
          <input
            type="checkbox"
            id={`edit-assumption-internal-${assumption.id}`}
            checked={isInternal}
            onChange={(e) => setIsInternal(e.target.checked)}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            disabled={isSubmitting}
          />
          <label
            htmlFor={`edit-assumption-internal-${assumption.id}`}
            className="ml-2 text-xs font-medium text-gray-700"
          >
            社内のみ
          </label>
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
