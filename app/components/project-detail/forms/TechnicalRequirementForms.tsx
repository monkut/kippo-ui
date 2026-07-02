import { useState } from "react";
import { MultiSelect } from "~/components/multi-select";
import {
  requirementsTechnicalRequirementsCreate,
  requirementsTechnicalRequirementsPartialUpdate,
  requirementsTechnicalRequirementCategoriesCreate,
  requirementsTechnicalRequirementsEstimatesCreate,
  requirementsTechnicalRequirementsEstimatesPartialUpdate,
} from "~/lib/api/generated/requirements/requirements";
import type { ProjectTechnicalRequirementCategory } from "~/lib/api/generated/models";
import type { BusinessRequirementType, TechnicalRequirementType } from "../types";

interface TechnicalRequirementInlineFormProps {
  projectId: string;
  categories: ProjectTechnicalRequirementCategory[];
  onCancel: () => void;
  onCreated: () => void;
  // Business-requirement selection mode (project detail): choose from a list.
  businessRequirements?: BusinessRequirementType[];
  // Fixed mode (requirement detail): the business requirement is fixed by the route.
  businessRequirementId?: number;
}

type TechnicalRequirementEntry = {
  id: number;
  title: string;
  details: string;
  businessReqIds: number[];
  categoryId: number | "new";
  newCategoryName: string;
  estimateDays: string;
  confidence: string;
};

export function TechnicalRequirementInlineForm({
  projectId,
  categories,
  onCancel,
  onCreated,
  businessRequirements,
  businessRequirementId,
}: TechnicalRequirementInlineFormProps) {
  const fixedMode = businessRequirementId != null;
  const businessReqs = businessRequirements ?? [];
  const defaultCategoryId = categories.length > 0 ? categories[0].id : "new";
  const [entries, setEntries] = useState<TechnicalRequirementEntry[]>([
    {
      id: 1,
      title: "",
      details: "",
      businessReqIds: [],
      categoryId: defaultCategoryId,
      newCategoryName: "",
      estimateDays: "",
      confidence: "80",
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
        businessReqIds: [],
        categoryId: defaultCategoryId,
        newCategoryName: "",
        estimateDays: "",
        confidence: "80",
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
    field: keyof TechnicalRequirementEntry,
    value: string | number | "new",
  ) => {
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const isEntryValid = (e: TechnicalRequirementEntry) =>
    fixedMode
      ? Boolean(e.title.trim() && e.estimateDays)
      : Boolean(e.title.trim() && e.businessReqIds.length > 0 && e.estimateDays);

  const hasValidEntry = entries.some(isEntryValid);
  const validCount = entries.filter(isEntryValid).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validEntries = entries.filter(isEntryValid);
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
            const catResponse = await requirementsTechnicalRequirementCategoriesCreate({
              project: projectId,
              name: cacheKey,
            });
            if (catResponse.data) {
              finalCategoryId = catResponse.data.id;
              categoryCache[cacheKey] = catResponse.data.id;
            }
          }
        }

        const techReqResponse = await requirementsTechnicalRequirementsCreate({
          project: projectId,
          business_requirements:
            businessRequirementId != null ? [businessRequirementId] : entry.businessReqIds,
          title: entry.title.trim(),
          details: entry.details.trim() || undefined,
          category: finalCategoryId as number,
        });

        if (techReqResponse.data) {
          await requirementsTechnicalRequirementsEstimatesCreate(String(techReqResponse.data.id), {
            days: Number.parseFloat(entry.estimateDays),
            confidence: Number.parseInt(entry.confidence, 10) / 100,
          });
        }
      }

      onCreated();
    } catch (err) {
      console.error("Failed to create technical requirement:", err);
      setError("技術要件の作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const gridClass = fixedMode
    ? "grid grid-cols-1 md:grid-cols-[1fr_8rem_5rem_5rem_1fr_auto] gap-3 items-start"
    : "grid grid-cols-1 md:grid-cols-[1fr_1fr_8rem_5rem_5rem_1fr_auto] gap-3 items-start";

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-medium text-gray-900 mb-3">新規技術要件</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}
        {!fixedMode && businessReqs.length === 0 && (
          <div className="rounded-md bg-yellow-50 p-3">
            <div className="text-sm text-yellow-800">先にビジネス要件を作成してください</div>
          </div>
        )}
        {entries.map((entry, index) => (
          <div key={entry.id} className={gridClass}>
            {!fixedMode && (
              <div>
                <MultiSelect
                  id={`tech-req-business-${entry.id}`}
                  label="ビジネス要件"
                  options={businessReqs.map((b) => ({
                    id: b.id,
                    displayId: b.display_id,
                    title: b.title,
                  }))}
                  value={entry.businessReqIds}
                  onChange={(ids) =>
                    setEntries(
                      entries.map((ent) =>
                        ent.id === entry.id ? { ...ent, businessReqIds: ids } : ent,
                      ),
                    )
                  }
                  disabled={isSubmitting || businessReqs.length === 0}
                  placeholder="ビジネス要件を選択..."
                />
              </div>
            )}
            <div>
              <label
                htmlFor={`tech-req-title-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                タイトル
              </label>
              <input
                type="text"
                id={`tech-req-title-${entry.id}`}
                value={entry.title}
                onChange={(e) => updateEntry(entry.id, "title", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                placeholder="技術要件のタイトル"
                disabled={isSubmitting}
                autoFocus={index === 0}
              />
            </div>
            <div>
              <label
                htmlFor={`tech-req-category-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                カテゴリ
              </label>
              {entry.categoryId === "new" ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    id={`tech-req-category-${entry.id}`}
                    value={entry.newCategoryName}
                    onChange={(e) => updateEntry(entry.id, "newCategoryName", e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                    placeholder="新規カテゴリ名"
                    disabled={isSubmitting}
                    autoFocus={!fixedMode}
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
                  id={`tech-req-category-${entry.id}`}
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
                htmlFor={`tech-req-estimate-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                日数
              </label>
              <input
                type="number"
                id={`tech-req-estimate-${entry.id}`}
                value={entry.estimateDays}
                onChange={(e) => updateEntry(entry.id, "estimateDays", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                placeholder="日数"
                min="0.5"
                step="0.5"
                disabled={isSubmitting}
              />
              <div className="flex gap-1 mt-1">
                {[1, 3, 5].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => updateEntry(entry.id, "estimateDays", String(days))}
                    className={`px-1.5 py-0.5 text-xs font-medium rounded border ${
                      entry.estimateDays === String(days)
                        ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                        : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                    disabled={isSubmitting}
                  >
                    {days}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                htmlFor={`tech-req-confidence-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                信頼度%
              </label>
              <input
                type="number"
                id={`tech-req-confidence-${entry.id}`}
                value={entry.confidence}
                onChange={(e) => updateEntry(entry.id, "confidence", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                placeholder="%"
                min="10"
                max="100"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label
                htmlFor={`tech-req-details-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                詳細（任意）
              </label>
              <textarea
                id={`tech-req-details-${entry.id}`}
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
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md mt-6"
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
          disabled={fixedMode ? isSubmitting : isSubmitting || businessReqs.length === 0}
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
            disabled={
              fixedMode
                ? isSubmitting || !hasValidEntry
                : isSubmitting || !hasValidEntry || businessReqs.length === 0
            }
          >
            {isSubmitting ? "作成中..." : `作成${validCount > 1 ? ` (${validCount}件)` : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
}

interface TechnicalRequirementEditFormProps {
  requirement: TechnicalRequirementType;
  categories: ProjectTechnicalRequirementCategory[];
  businessRequirements: BusinessRequirementType[];
  onCancel: () => void;
  onUpdated: () => void;
}

export function TechnicalRequirementEditForm({
  requirement,
  categories,
  businessRequirements,
  onCancel,
  onUpdated,
}: TechnicalRequirementEditFormProps) {
  const [title, setTitle] = useState(requirement.title);
  const [details, setDetails] = useState(requirement.details || "");
  const [businessReqIds, setBusinessReqIds] = useState<number[]>(
    requirement.business_requirements || [],
  );
  const [categoryId, setCategoryId] = useState<number>(requirement.category);
  const [estimateDays, setEstimateDays] = useState(requirement.estimate?.days?.toString() || "");
  const [confidence, setConfidence] = useState(
    requirement.estimate ? String(Math.round(requirement.estimate.confidence * 100)) : "80",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || businessReqIds.length === 0) return;

    setIsSubmitting(true);
    setError("");
    try {
      await requirementsTechnicalRequirementsPartialUpdate(requirement.id, {
        title: title.trim(),
        details: details.trim() || undefined,
        business_requirements: businessReqIds,
        category: categoryId,
      });

      // Update estimate if we have the estimate ID and values
      if (requirement.estimate?.id && estimateDays) {
        await requirementsTechnicalRequirementsEstimatesPartialUpdate(
          String(requirement.id),
          requirement.estimate.id,
          {
            days: Number.parseFloat(estimateDays),
            confidence: Number.parseInt(confidence, 10) / 100,
          },
        );
      }

      onUpdated();
    } catch (err) {
      console.error("Failed to update technical requirement:", err);
      setError("技術要件の更新に失敗しました");
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
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_8rem_5rem_5rem_1fr] gap-3 items-start">
        <div>
          <MultiSelect
            id={`edit-tr-business-${requirement.id}`}
            label="ビジネス要件"
            options={businessRequirements.map((b) => ({
              id: b.id,
              displayId: b.display_id,
              title: b.title,
            }))}
            value={businessReqIds}
            onChange={setBusinessReqIds}
            disabled={isSubmitting}
            placeholder="ビジネス要件を選択..."
          />
        </div>
        <div>
          <label
            htmlFor={`edit-tr-title-${requirement.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            タイトル
          </label>
          <input
            type="text"
            id={`edit-tr-title-${requirement.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        <div>
          <label
            htmlFor={`edit-tr-category-${requirement.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            カテゴリ
          </label>
          <select
            id={`edit-tr-category-${requirement.id}`}
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
            htmlFor={`edit-tr-days-${requirement.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            日数
          </label>
          <input
            type="number"
            id={`edit-tr-days-${requirement.id}`}
            value={estimateDays}
            onChange={(e) => setEstimateDays(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
            placeholder="日数"
            min="0.5"
            step="0.5"
            disabled={isSubmitting}
          />
          <div className="flex gap-1 mt-1">
            {[1, 3, 5].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setEstimateDays(String(days))}
                className={`px-1.5 py-0.5 text-xs font-medium rounded border ${
                  estimateDays === String(days)
                    ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                    : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
                disabled={isSubmitting}
              >
                {days}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label
            htmlFor={`edit-tr-confidence-${requirement.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            信頼度%
          </label>
          <input
            type="number"
            id={`edit-tr-confidence-${requirement.id}`}
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
            placeholder="%"
            min="10"
            max="100"
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label
            htmlFor={`edit-tr-details-${requirement.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            詳細（任意）
          </label>
          <textarea
            id={`edit-tr-details-${requirement.id}`}
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
          disabled={isSubmitting || !title.trim() || businessReqIds.length === 0}
        >
          {isSubmitting ? "更新中..." : "更新"}
        </button>
      </div>
    </form>
  );
}
