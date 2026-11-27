import type { RequirementComments } from "~/hooks/useRequirementComments";
import type {
  ProjectBusinessRequirement,
  ProjectTechnicalRequirement,
  ProjectTechnicalRequirementCategory,
} from "~/lib/api/generated/models";
import { getBusinessReqCategoryColor, type SectionDisplay, type SectionFormState } from "./display";
import {
  TechnicalRequirementEditForm,
  TechnicalRequirementInlineForm,
} from "./forms/TechnicalRequirementForms";
import { CommentToggleButton, RequirementCommentsPanel } from "./RequirementCommentsPanel";
import { EditDeleteButtons, SectionCard, UnaddressedList } from "./SectionCard";
import type { TechnicalRequirementType } from "./types";

type TechnicalRequirementsSectionProps = {
  projectId: string | undefined;
  requirements: ProjectTechnicalRequirement[];
  categories: ProjectTechnicalRequirementCategory[];
  businessRequirements: ProjectBusinessRequirement[];
  /** display_ids of business requirements no technical requirement refers to. */
  unaddressedBusinessReqIds: string[];
  onHover: (id: number | null) => void;
  display: SectionDisplay;
  form: SectionFormState<TechnicalRequirementType>;
  comments: RequirementComments;
  onChanged: () => void;
  onDelete: (id: number, title: string) => void;
};

/** 技術要件 section of the project detail page. */
export function TechnicalRequirementsSection({
  projectId,
  requirements,
  categories,
  businessRequirements,
  unaddressedBusinessReqIds,
  onHover,
  display,
  form,
  comments,
  onChanged,
  onDelete,
}: TechnicalRequirementsSectionProps) {
  const { titleSize, bodySize } = display;
  return (
    <SectionCard
      title="技術要件"
      count={requirements.length}
      display={display}
      headerExtra={<UnaddressedList displayIds={unaddressedBusinessReqIds} />}
      canAdd={!form.showForm && !form.editing}
      onAdd={form.openForm}
    >
      {requirements.length === 0 && !form.showForm ? (
        <p className="text-gray-500 text-center py-4">技術要件がありません</p>
      ) : display.compact ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
          {requirements.map((req) => (
            <div
              key={req.id}
              className="flex items-center gap-2 py-1 px-1 -mx-1 min-w-0 overflow-hidden rounded transition-colors cursor-default"
              title={req.title}
              onMouseEnter={() => onHover(req.id)}
              onMouseLeave={() => onHover(null)}
            >
              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded shrink-0">
                {req.display_id}
              </span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${getBusinessReqCategoryColor(req.category)}`}
              >
                {req.category_name}
              </span>
              <span className={`${titleSize} text-gray-900 truncate min-w-0`}>{req.title}</span>
              {req.estimate && (
                <span className="text-xs text-gray-500 ml-auto shrink-0">
                  {req.estimate.days}日
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {requirements.map((req) =>
            form.editing?.id === req.id ? (
              <li key={req.id} className="py-3">
                <TechnicalRequirementEditForm
                  requirement={form.editing}
                  categories={categories}
                  businessRequirements={businessRequirements}
                  onCancel={form.stopEditing}
                  onUpdated={() => {
                    form.stopEditing();
                    onChanged();
                  }}
                />
              </li>
            ) : (
              <li
                key={req.id}
                className="py-3 group"
                onMouseEnter={() => onHover(req.id)}
                onMouseLeave={() => onHover(null)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                        {req.display_id}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${getBusinessReqCategoryColor(req.category)}`}
                      >
                        {req.category_name}
                      </span>
                      <span className={`${titleSize} text-gray-900`}>{req.title}</span>
                      {req.estimate && (
                        <span className={`${titleSize} font-medium text-gray-600`}>
                          {req.estimate.days}日 ({Math.round(req.estimate.confidence * 100)}
                          %)
                        </span>
                      )}
                    </div>
                    <p className={`mt-1 ${bodySize} text-gray-500 ml-16`}>
                      ビジネス要件:{" "}
                      {req.business_requirements && req.business_requirements.length > 0
                        ? businessRequirements
                            .filter((b) => req.business_requirements?.includes(b.id))
                            .map((b) => b.display_id)
                            .join(", ") || "-"
                        : "-"}
                    </p>
                    {req.details && (
                      <p className={`mt-1 ${bodySize} text-gray-500 ml-16 whitespace-pre-line`}>
                        {req.details}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <CommentToggleButton requirementId={req.id} comments={comments} />
                    <EditDeleteButtons
                      onEdit={() => form.startEditing(req)}
                      onDelete={() => onDelete(req.id, req.title)}
                    />
                  </div>
                </div>
                <RequirementCommentsPanel
                  requirementId={req.id}
                  comments={comments}
                  commentType="technical"
                />
              </li>
            ),
          )}
        </ul>
      )}
      {form.showForm && projectId && (
        <TechnicalRequirementInlineForm
          projectId={projectId}
          categories={categories}
          businessRequirements={businessRequirements}
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
