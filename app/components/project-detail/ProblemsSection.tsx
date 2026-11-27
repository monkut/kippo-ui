import type { ProjectProblemDefinition } from "~/lib/api/generated/models";
import type { SectionDisplay, SectionFormState } from "./display";
import { ProblemEditForm, ProblemInlineForm } from "./forms/ProblemForms";
import { EditDeleteButtons, SectionCard } from "./SectionCard";
import type { ProblemType } from "./types";

type ProblemsSectionProps = {
  projectId: string | undefined;
  problems: ProjectProblemDefinition[];
  /** Problems referenced by the hovered business requirement. */
  highlightedIds: ReadonlySet<number>;
  display: SectionDisplay;
  form: SectionFormState<ProblemType>;
  onChanged: () => void;
  onDelete: (id: number, title: string) => void;
};

/** 課題定義 section of the project detail page. */
export function ProblemsSection({
  projectId,
  problems,
  highlightedIds,
  display,
  form,
  onChanged,
  onDelete,
}: ProblemsSectionProps) {
  const { titleSize } = display;
  return (
    <SectionCard
      title="課題定義"
      count={problems.length}
      display={display}
      canAdd={!form.showForm && !form.editing}
      onAdd={form.openForm}
    >
      {problems.length === 0 && !form.showForm ? (
        <p className="text-gray-500 text-center py-4">課題定義がありません</p>
      ) : display.compact ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
          {problems.map((problem) => (
            <div
              key={problem.id}
              className={`flex items-center gap-2 py-1 px-1 -mx-1 rounded transition-colors min-w-0 overflow-hidden ${
                highlightedIds.has(problem.id) ? "bg-indigo-100 ring-2 ring-indigo-400" : ""
              }`}
              title={problem.title}
            >
              <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded shrink-0">
                {problem.display_id}
              </span>
              <span className={`${titleSize} text-gray-900 truncate min-w-0`}>{problem.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {problems.map((problem) =>
            form.editing?.id === problem.id ? (
              <li key={problem.id} className="py-3">
                <ProblemEditForm
                  problem={form.editing}
                  onCancel={form.stopEditing}
                  onUpdated={() => {
                    form.stopEditing();
                    onChanged();
                  }}
                />
              </li>
            ) : (
              <li
                key={problem.id}
                className={`py-3 group rounded transition-colors ${
                  highlightedIds.has(problem.id)
                    ? "bg-indigo-100 ring-2 ring-indigo-400 px-2 -mx-2"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                      {problem.display_id}
                    </span>
                    <span className={`${titleSize} text-gray-900`}>{problem.title}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <EditDeleteButtons
                      onEdit={() => form.startEditing(problem)}
                      onDelete={() => onDelete(problem.id, problem.title)}
                    />
                  </div>
                </div>
                {problem.details && (
                  <p className={`mt-1 ${titleSize} text-gray-500 ml-16 whitespace-pre-line`}>
                    {problem.details}
                  </p>
                )}
              </li>
            ),
          )}
        </ul>
      )}
      {form.showForm && projectId && (
        <ProblemInlineForm
          projectId={projectId}
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
