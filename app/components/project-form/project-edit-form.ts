import type {
  KippoProject,
  KippoProjectOrganizationCategory,
  PatchedKippoProjectRequest,
  PhaseEnum,
} from "~/lib/api/generated/models";
import { DEFAULT_PHASE } from "./fields";

/** Editable values of the project edit page (/projects/:id/edit), as the inputs hold them. */
export type ProjectEditForm = {
  name: string;
  phase: PhaseEnum;
  category: string;
  leadSource: string;
  projectManagerId: string;
  problemDefinition: string;
  startDate: string;
  targetDate: string;
  allocatedStaffDays: string;
  documentFolderUrl: string;
  docbaseTag: string;
  slackChannelName: string;
  slackNotificationChannelName: string;
  githubProjectHtmlUrl: string;
  enableCostReport: boolean;
  // parent_project (親プロジェクト) — optional continuation parent; name-searched picker. Backend
  // rejects a cross-org or self-referencing parent. parentProjectName labels the selection.
  parentProjectId: string;
  parentProjectName: string | null;
};

export const EMPTY_PROJECT_EDIT_FORM: ProjectEditForm = {
  name: "",
  phase: DEFAULT_PHASE,
  category: "",
  leadSource: "",
  projectManagerId: "",
  problemDefinition: "",
  startDate: "",
  targetDate: "",
  allocatedStaffDays: "",
  documentFolderUrl: "",
  docbaseTag: "",
  slackChannelName: "",
  slackNotificationChannelName: "",
  githubProjectHtmlUrl: "",
  enableCostReport: false,
  parentProjectId: "",
  parentProjectName: null,
};

export function projectEditFormFromProject(project: KippoProject): ProjectEditForm {
  return {
    name: project.name ?? "",
    phase: project.phase || DEFAULT_PHASE,
    category: project.category ?? "",
    leadSource: project.lead_source ?? "",
    projectManagerId: project.project_manager ?? "",
    problemDefinition: project.problem_definition ?? "",
    startDate: project.start_date ?? "",
    targetDate: project.target_date ?? "",
    allocatedStaffDays:
      project.allocated_staff_days == null ? "" : String(project.allocated_staff_days),
    documentFolderUrl: project.document_folder_url ?? "",
    docbaseTag: project.docbase_tag ?? "",
    slackChannelName: project.slack_channel_name ?? "",
    slackNotificationChannelName: project.slack_notification_channel_name ?? "",
    githubProjectHtmlUrl: project.github_project_html_url ?? "",
    enableCostReport: project.enable_cost_report ?? false,
    parentProjectId: project.parent_project ?? "",
    parentProjectName: project.parent_project_name ?? null,
  };
}

/** PATCH body for the project record.
 *
 * - `category` is sent only when it is one of the organization's selectable categories; a key
 *   that is not offered (an inactive category, or categories not loaded) is omitted so the stored
 *   value is left unchanged instead of 400-ing.
 * - With a contract the contract period is the write path for the dates, so they are omitted
 *   (not just echoed). */
export function buildProjectPatch(
  form: ProjectEditForm,
  options: { categories: KippoProjectOrganizationCategory[]; hasContract: boolean },
): PatchedKippoProjectRequest {
  const allocated = form.allocatedStaffDays.trim();
  const isSelectableCategory = options.categories.some((c) => c.key === form.category);
  return {
    name: form.name.trim(),
    phase: form.phase,
    category: isSelectableCategory ? form.category : undefined,
    lead_source: form.leadSource as PatchedKippoProjectRequest["lead_source"],
    project_manager: form.projectManagerId || null,
    problem_definition: form.problemDefinition,
    ...(options.hasContract
      ? {}
      : { start_date: form.startDate || null, target_date: form.targetDate || null }),
    allocated_staff_days: allocated === "" ? null : Number.parseInt(allocated, 10),
    document_folder_url: form.documentFolderUrl.trim(),
    docbase_tag: form.docbaseTag.trim(),
    slack_channel_name: form.slackChannelName.trim(),
    slack_notification_channel_name: form.slackNotificationChannelName.trim(),
    github_project_html_url: form.githubProjectHtmlUrl.trim(),
    enable_cost_report: form.enableCostReport,
    parent_project: form.parentProjectId || null,
  };
}
