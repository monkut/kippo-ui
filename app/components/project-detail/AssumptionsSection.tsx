import type { ProjectAssumption } from "~/lib/api/generated/models";
import { getAssumptionCategoryColor, type SectionDisplay, type SectionFormState } from "./display";
import { AssumptionEditForm, AssumptionInlineForm } from "./forms/AssumptionForms";
import { EditDeleteButtons, SectionCard } from "./SectionCard";
import type { AssumptionCategoryChoice, AssumptionType } from "./types";

type AssumptionsSectionProps = {
  projectId: string | undefined;
  assumptions: ProjectAssumption[];
  categories: AssumptionCategoryChoice[];
  display: SectionDisplay;
  form: SectionFormState<AssumptionType>;
  onChanged: () => void;
  onDelete: (id: number, title: string) => void;
};

/** 前提条件と制約事項 section of the project detail page. */
export function AssumptionsSection({
  projectId,
  assumptions,
  categories,
  display,
  form,
  onChanged,
  onDelete,
}: AssumptionsSectionProps) {
  const { titleSize } = display;
  return (
    <SectionCard
      title="前提条件と制約事項"
      count={assumptions.length}
      display={display}
      canAdd={!form.showForm && !form.editing}
      onAdd={form.openForm}
    >
      {assumptions.length === 0 && !form.showForm ? (
        <p className="text-gray-500 text-center py-4">前提条件がありません</p>
      ) : display.compact ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
          {assumptions.map((assumption) => (
            <div
              key={assumption.id}
              className="flex items-center gap-2 py-1 min-w-0 overflow-hidden"
              title={assumption.title}
            >
              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded shrink-0">
                {assumption.display_id}
              </span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${getAssumptionCategoryColor(assumption.category)}`}
              >
                {assumption.category_display}
              </span>
              <span className={`${titleSize} text-gray-900 truncate min-w-0`}>
                {assumption.title}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {assumptions.map((assumption) =>
            form.editing?.id === assumption.id ? (
              <li key={assumption.id} className="py-3">
                <AssumptionEditForm
                  assumption={form.editing}
                  categories={categories}
                  onCancel={form.stopEditing}
                  onUpdated={() => {
                    form.stopEditing();
                    onChanged();
                  }}
                />
              </li>
            ) : (
              <li key={assumption.id} className="py-3 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                      {assumption.display_id}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${getAssumptionCategoryColor(assumption.category)}`}
                    >
                      {assumption.category_display}
                    </span>
                    <span className={`${titleSize} text-gray-900`}>{assumption.title}</span>
                    {assumption.is_internal && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                        社内のみ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <EditDeleteButtons
                      onEdit={() => form.startEditing(assumption)}
                      onDelete={() => onDelete(assumption.id, assumption.title)}
                    />
                  </div>
                </div>
                {assumption.details && (
                  <p className={`mt-1 ${titleSize} text-gray-500 ml-16 whitespace-pre-line`}>
                    {assumption.details}
                  </p>
                )}
              </li>
            ),
          )}
        </ul>
      )}
      {form.showForm && projectId && (
        <AssumptionInlineForm
          projectId={projectId}
          categories={categories}
          onCancel={form.closeForm}
          onCreated={() => {
            form.closeForm();
            onChanged();
          }}
        />
      )}
    </SectionCard>
  );
}
