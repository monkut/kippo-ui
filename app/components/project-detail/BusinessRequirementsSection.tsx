import { Link } from "react-router";
import type { RequirementComments } from "~/hooks/useRequirementComments";
import type {
  ProjectBusinessRequirement,
  ProjectBusinessRequirementCategory,
  ProjectProblemDefinition,
} from "~/lib/api/generated/models";
import {
  getBusinessReqCategoryColor,
  getBusinessReqCategoryName,
  getProblemDisplayIds,
  type SectionDisplay,
  type SectionFormState,
} from "./display";
import {
  BusinessRequirementEditForm,
  BusinessRequirementInlineForm,
} from "./forms/BusinessRequirementForms";
import { CommentToggleButton, RequirementCommentsPanel } from "./RequirementCommentsPanel";
import { EditDeleteButtons, SectionCard, UnaddressedList } from "./SectionCard";
import type { BusinessRequirementType } from "./types";

type BusinessRequirementsSectionProps = {
  projectId: string | undefined;
  requirements: ProjectBusinessRequirement[];
  categories: ProjectBusinessRequirementCategory[];
  problems: ProjectProblemDefinition[];
  /** display_ids of problems no business requirement refers to. */
  unaddressedProblemIds: string[];
  /** Business requirements referenced by the hovered technical requirement. */
  highlightedIds: ReadonlySet<number>;
  onHover: (id: number | null) => void;
  display: SectionDisplay;
  form: SectionFormState<BusinessRequirementType>;
  comments: RequirementComments;
  onChanged: () => void;
  onDelete: (id: number, title: string) => void;
};

/** ビジネス要件 section of the project detail page. */
export function BusinessRequirementsSection({
  projectId,
  requirements,
  categories,
  problems,
  unaddressedProblemIds,
  highlightedIds,
  onHover,
  display,
  form,
  comments,
  onChanged,
  onDelete,
}: BusinessRequirementsSectionProps) {
  const { titleSize, bodySize } = display;
  return (
    <SectionCard
      title="ビジネス要件"
      count={requirements.length}
      display={display}
      headerExtra={<UnaddressedList displayIds={unaddressedProblemIds} />}
      canAdd={!form.showForm && !form.editing}
      onAdd={form.openForm}
    >
      {requirements.length === 0 && !form.showForm ? (
        <p className="text-gray-500 text-center py-4">ビジネス要件がありません</p>
      ) : display.compact ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
          {requirements.map((req) => (
            <Link
              key={req.id}
              to={`/projects/${projectId}/requirements/${req.id}`}
              className={`flex items-center gap-2 py-1 rounded px-1 -mx-1 transition-colors min-w-0 overflow-hidden ${
                highlightedIds.has(req.id)
                  ? "bg-indigo-100 ring-2 ring-indigo-400"
                  : "hover:bg-gray-50"
              }`}
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
                {getBusinessReqCategoryName(req.category, categories)}
              </span>
              <span className={`${titleSize} text-gray-900 truncate min-w-0`}>{req.title}</span>
              {req.problems && req.problems.length > 0 && (
                <span className="text-xs text-gray-500 shrink-0">
                  ({getProblemDisplayIds(req.problems, problems)})
                </span>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {requirements.map((req) =>
            form.editing?.id === req.id ? (
              <li key={req.id} className="py-3">
                <BusinessRequirementEditForm
                  requirement={form.editing}
                  categories={categories}
                  problems={problems}
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
                className={`py-3 rounded transition-colors ${
                  highlightedIds.has(req.id)
                    ? "bg-indigo-100 ring-2 ring-indigo-400 px-2 -mx-2"
                    : ""
                }`}
                onMouseEnter={() => onHover(req.id)}
                onMouseLeave={() => onHover(null)}
              >
                <div className="group">
                  <div className="flex items-center justify-between">
                    <Link
                      to={`/projects/${projectId}/requirements/${req.id}`}
                      className="flex-1 block hover:bg-gray-50 -mx-2 px-2 py-2 rounded"
                      title="開発要件を定義"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                          {req.display_id}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${getBusinessReqCategoryColor(req.category)}`}
                        >
                          {getBusinessReqCategoryName(req.category, categories)}
                        </span>
                        <span className={`${titleSize} text-gray-900`}>{req.title}</span>
                      </div>
                      <p className={`mt-1 ${bodySize} text-gray-500 ml-16`}>
                        課題: {getProblemDisplayIds(req.problems, problems)}
                      </p>
                      {req.details && (
                        <p className={`mt-1 ${bodySize} text-gray-500 ml-16 whitespace-pre-line`}>
                          {req.details}
                        </p>
                      )}
                    </Link>
                    <div className="flex items-center gap-1 ml-2">
                      <CommentToggleButton requirementId={req.id} comments={comments} />
                      <EditDeleteButtons
                        onEdit={() => form.startEditing(req)}
                        onDelete={() => onDelete(req.id, req.title)}
                      />
                    </div>
                  </div>
                </div>
                <RequirementCommentsPanel
                  requirementId={req.id}
                  comments={comments}
                  commentType="business"
                />
              </li>
            ),
          )}
        </ul>
      )}
      {form.showForm && projectId && (
        <BusinessRequirementInlineForm
          projectId={projectId}
          categories={categories}
          problems={problems}
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
