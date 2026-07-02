import { useState } from "react";
import { MultiSelect } from "~/components/multi-select";
import {
  requirementsBusinessRequirementsCreate,
  requirementsBusinessRequirementsPartialUpdate,
  requirementsBusinessRequirementCategoriesCreate,
} from "~/lib/api/generated/requirements/requirements";
import type {
  ProjectBusinessRequirementCategory,
  ProjectProblemDefinition,
} from "~/lib/api/generated/models";
import type { BusinessRequirementType } from "../types";

interface BusinessRequirementInlineFormProps {
  projectId: string;
  categories: ProjectBusinessRequirementCategory[];
  problems: ProjectProblemDefinition[];
  onCancel: () => void;
  onCreated: () => void;
}

type BusinessRequirementEntry = {
  id: number;
  title: string;
  details: string;
  problemIds: number[];
  categoryId: number | "new";
  newCategoryName: string;
};

export function BusinessRequirementInlineForm({
  projectId,
  categories,
  problems,
  onCancel,
  onCreated,
}: BusinessRequirementInlineFormProps) {
  const defaultCategoryId = categories.length > 0 ? categories[0].id : "new";
  const [entries, setEntries] = useState<BusinessRequirementEntry[]>([
    {
      id: 1,
      title: "",
      details: "",
      problemIds: [],
      categoryId: defaultCategoryId,
      newCategoryName: "",
    },
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
        problemIds: [],
        categoryId: defaultCategoryId,
        newCategoryName: "",
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
    field: keyof BusinessRequirementEntry,
    value: string | number | "new",
  ) => {
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const hasValidEntry = entries.some((e) => e.title.trim() && e.problemIds.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validEntries = entries.filter(
      (entry) => entry.title.trim() && entry.problemIds.length > 0,
    );
    if (validEntries.length === 0) return;

    setIsSubmitting(true);
    setError("");
    try {
      const categoryCache: Record<string, number> = {};

      for (const entry of validEntries) {
        let finalCategoryId = entry.categoryId;
        if (entry.categoryId === "new") {
          if (!entry.newCategoryName.trim()) {
            setError("カテゴリ名を入力してください");
            setIsSubmitting(false);
            return;
          }
          const cacheKey = entry.newCategoryName.trim();
          if (categoryCache[cacheKey]) {
            finalCategoryId = categoryCache[cacheKey];
          } else {
            const catResponse = await requirementsBusinessRequirementCategoriesCreate({
              project: projectId,
              name: cacheKey,
            });
            if (catResponse.data) {
              finalCategoryId = catResponse.data.id;
              categoryCache[cacheKey] = catResponse.data.id;
            }
          }
        }

        await requirementsBusinessRequirementsCreate({
          project: projectId,
          title: entry.title.trim(),
          details: entry.details.trim() || undefined,
          problems: entry.problemIds,
          category: finalCategoryId as number,
        });
      }
      onCreated();
    } catch (err) {
      console.error("Failed to create business requirement:", err);
      setError("ビジネス要件の作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-medium text-gray-900 mb-3">新規ビジネス要件</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}
        {problems.length === 0 && (
          <div className="rounded-md bg-yellow-50 p-3">
            <div className="text-sm text-yellow-800">先に課題定義を作成してください</div>
          </div>
        )}
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className="grid grid-cols-1 md:grid-cols-[1fr_1fr_8rem_1fr_auto] gap-3 items-start"
          >
            <div>
              <MultiSelect
                id={`business-req-problem-${entry.id}`}
                label="課題定義"
                options={problems.map((p) => ({
                  id: p.id,
                  displayId: p.display_id,
                  title: p.title,
                }))}
                value={entry.problemIds}
                onChange={(ids) =>
                  setEntries(
                    entries.map((ent) => (ent.id === entry.id ? { ...ent, problemIds: ids } : ent)),
                  )
                }
                disabled={isSubmitting || problems.length === 0}
                placeholder="課題を選択..."
              />
            </div>
            <div>
              <label
                htmlFor={`business-req-title-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                タイトル
              </label>
              <input
                type="text"
                id={`business-req-title-${entry.id}`}
                value={entry.title}
                onChange={(e) => updateEntry(entry.id, "title", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                placeholder="ビジネス要件のタイトル"
                disabled={isSubmitting}
                autoFocus={index === 0}
              />
            </div>
            <div>
              <label
                htmlFor={`business-req-category-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                カテゴリ
              </label>
              {entry.categoryId === "new" ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    id={`business-req-category-${entry.id}`}
                    value={entry.newCategoryName}
                    onChange={(e) => updateEntry(entry.id, "newCategoryName", e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                    placeholder="新規カテゴリ名"
                    disabled={isSubmitting}
                    autoFocus
                  />
                  {categories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        updateEntry(entry.id, "categoryId", categories[0].id);
                        updateEntry(entry.id, "newCategoryName", "");
                      }}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                      title="既存カテゴリから選択"
                    >
                      取消
                    </button>
                  )}
                </div>
              ) : (
                <select
                  id={`business-req-category-${entry.id}`}
                  value={entry.categoryId}
                  onChange={(e) =>
                    updateEntry(
                      entry.id,
                      "categoryId",
                      e.target.value === "new" ? "new" : Number.parseInt(e.target.value, 10),
                    )
                  }
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                  disabled={isSubmitting}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                  <option value="new">+ 新規カテゴリ</option>
                </select>
              )}
            </div>
            <div>
              <label
                htmlFor={`business-req-details-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                詳細（任意）
              </label>
              <textarea
                id={`business-req-details-${entry.id}`}
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
          disabled={isSubmitting || problems.length === 0}
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
            disabled={isSubmitting || !hasValidEntry || problems.length === 0}
          >
            {isSubmitting
              ? "作成中..."
              : `作成${entries.filter((e) => e.title.trim() && e.problemIds.length > 0).length > 1 ? ` (${entries.filter((e) => e.title.trim() && e.problemIds.length > 0).length}件)` : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
}

interface BusinessRequirementEditFormProps {
  requirement: BusinessRequirementType;
  categories: ProjectBusinessRequirementCategory[];
  problems: ProjectProblemDefinition[];
  onCancel: () => void;
  onUpdated: () => void;
}

export function BusinessRequirementEditForm({
  requirement,
  categories,
  problems,
  onCancel,
  onUpdated,
}: BusinessRequirementEditFormProps) {
  const [title, setTitle] = useState(requirement.title);
  const [details, setDetails] = useState(requirement.details || "");
  const [problemIds, setProblemIds] = useState<number[]>(requirement.problems || []);
  const [categoryId, setCategoryId] = useState<number>(requirement.category);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || problemIds.length === 0) return;

    setIsSubmitting(true);
    setError("");
    try {
      await requirementsBusinessRequirementsPartialUpdate(requirement.id, {
        title: title.trim(),
        details: details.trim() || undefined,
        problems: problemIds,
        category: categoryId,
      });
      onUpdated();
    } catch (err) {
      console.error("Failed to update business requirement:", err);
      setError("ビジネス要件の更新に失敗しました");
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
          {requirement.display_id}
        </span>
        <span className="text-xs text-gray-500">を編集中</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <MultiSelect
            id={`edit-br-problem-${requirement.id}`}
            label="課題定義"
            options={problems.map((p) => ({ id: p.id, displayId: p.display_id, title: p.title }))}
            value={problemIds}
            onChange={setProblemIds}
            disabled={isSubmitting}
            placeholder="課題を選択..."
          />
        </div>
        <div>
          <label
            htmlFor={`edit-br-category-${requirement.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            カテゴリ
          </label>
          <select
            id={`edit-br-category-${requirement.id}`}
            value={categoryId}
            onChange={(e) => setCategoryId(Number.parseInt(e.target.value, 10))}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
            disabled={isSubmitting}
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`edit-br-title-${requirement.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            タイトル
          </label>
          <input
            type="text"
            id={`edit-br-title-${requirement.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        <div className="md:col-span-2">
          <label
            htmlFor={`edit-br-details-${requirement.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            詳細（任意）
          </label>
          <textarea
            id={`edit-br-details-${requirement.id}`}
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
          disabled={isSubmitting || !title.trim() || problemIds.length === 0}
        >
          {isSubmitting ? "更新中..." : "更新"}
        </button>
      </div>
    </form>
  );
}
