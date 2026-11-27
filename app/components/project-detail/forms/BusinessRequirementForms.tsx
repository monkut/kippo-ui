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
import { useEntryList } from "~/hooks/useEntryList";
import type { BusinessRequirementType } from "../types";
import {
  AddEntryButton,
  createSubmitLabel,
  EditFormShell,
  FormActions,
  InlineCreateShell,
  RemoveEntryButton,
} from "./scaffolding";

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
  const { entries, setEntries, add, remove, update } = useEntryList<BusinessRequirementEntry>([
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

  const addEntry = () =>
    add({
      id: Date.now(),
      title: "",
      details: "",
      problemIds: [],
      categoryId: defaultCategoryId,
      newCategoryName: "",
    });

  const removeEntry = remove;

  const updateEntry = (
    id: number,
    field: keyof BusinessRequirementEntry,
    value: string | number | "new",
  ) => update(id, { [field]: value } as Partial<BusinessRequirementEntry>);

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
    <InlineCreateShell title="新規ビジネス要件" error={error} onSubmit={handleSubmit}>
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
            <RemoveEntryButton onClick={() => removeEntry(entry.id)} disabled={isSubmitting} />
          )}
        </div>
      ))}
      <AddEntryButton onClick={addEntry} disabled={isSubmitting || problems.length === 0} />
      <FormActions
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitDisabled={isSubmitting || !hasValidEntry || problems.length === 0}
      >
        {createSubmitLabel(
          isSubmitting,
          entries.filter((e) => e.title.trim() && e.problemIds.length > 0).length,
        )}
      </FormActions>
    </InlineCreateShell>
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
    <EditFormShell displayId={requirement.display_id} error={error} onSubmit={handleSubmit}>
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
      <FormActions
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitDisabled={isSubmitting || !title.trim() || problemIds.length === 0}
      >
        {isSubmitting ? "更新中..." : "更新"}
      </FormActions>
    </EditFormShell>
  );
}
