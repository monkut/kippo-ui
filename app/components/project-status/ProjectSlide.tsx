import { InfraCostDisplay, type ProjectMonthlyCost } from "~/components/infra-cost-display";
import type { KippoProject } from "~/lib/api/generated";
import { BILLING_TYPE_LABELS } from "~/lib/billing-report";
import { formatDisplayDate } from "~/lib/dates";
import { LatestCommentDisplay } from "./LatestCommentDisplay";
import { ProjectStatusMeter } from "./ProjectStatusMeter";
import { SurveyStatusIcon } from "./SurveyStatusIcon";

const urlPrefix = import.meta.env.VITE_URL_PREFIX || "";

/** 契約金額 as ¥1,234,567 — matches the admin's get_contract_total_amount_display. Blank at 0. */
export function formatContractAmount(amount: string | number | null | undefined): string {
  const value = Number(amount ?? 0);
  if (!Number.isFinite(value) || value === 0) return "";
  return `¥${value.toLocaleString("ja-JP")}`;
}

/** GITHUBプロジェクト link label — the final path segment, as the admin column shows. */
export function githubProjectLabel(url: string): string {
  return url.replace(/\/+$/, "").split("/").pop() ?? url;
}

interface ProjectSlideProps {
  project: KippoProject;
  monthlyCosts: ProjectMonthlyCost[] | undefined;
}

export function ProjectSlide({ project, monthlyCosts }: ProjectSlideProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full text-center space-y-6">
        {/* Project Name */}
        <div>
          <h2 className="text-3xl font-bold">
            <a
              href={`${urlPrefix}/admin/projects/activekippoproject/${project.id}/change/`}
              className="text-gray-900 hover:text-indigo-600 hover:underline transition-colors"
            >
              {project.name}
            </a>
          </h2>
          {project.customer_name && (
            <p className="mt-1 text-sm italic text-gray-500">{project.customer_name}</p>
          )}
          {/* カテゴリ — admin changelist column */}
          {project.category_label && (
            <p className="mt-2">
              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-700">
                {project.category_label}
              </span>
            </p>
          )}
        </div>

        {/* Dates */}
        <div className="text-lg text-gray-600">
          {formatDisplayDate(project.start_date)} - {formatDisplayDate(project.target_date)}
        </div>

        {/* 請求方法 / 契約金額 — admin changelist columns. Both come from the contract, so the
            row is omitted entirely for a project with no contract yet. */}
        {(project.billing_types?.length > 0 || formatContractAmount(project.contract_amount)) && (
          <div className="flex justify-center items-center gap-3 text-sm">
            {project.billing_types?.map((billingType) => (
              <span
                key={billingType}
                className="px-2 inline-flex leading-5 font-semibold rounded-full bg-purple-100 text-purple-800"
              >
                {BILLING_TYPE_LABELS[billingType] ?? billingType}
              </span>
            ))}
            {formatContractAmount(project.contract_amount) && (
              <span className="font-medium text-gray-700">
                {formatContractAmount(project.contract_amount)}
              </span>
            )}
          </div>
        )}

        {/* Project Status Display — linked to the status detail page, as the admin column is */}
        <div className="space-y-2">
          <a
            href={`${urlPrefix}/projects/project/${project.id}/status/`}
            className="block hover:opacity-80 transition-opacity"
          >
            <ProjectStatusMeter status={project.projectstatus_display} />
          </a>
        </div>

        {/* Latest Comment */}
        <div className="space-y-2">
          <LatestCommentDisplay comment={project.latest_comment} />
        </div>

        {/* Weekly Effort Users with Survey Status */}
        <div className="space-y-2">
          {project.weekly_effort_users && project.weekly_effort_users.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {project.weekly_effort_users.map((effortUser) => {
                const surveyUser = project.survey_users?.find(
                  (s) => s.user_id === effortUser.user_id,
                );
                return (
                  <span
                    key={effortUser.user_id}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                  >
                    <SurveyStatusIcon surveyUser={surveyUser} />
                    {effortUser.display_name} ({effortUser.percentage.toFixed(0)}%)
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="text-gray-400">-</div>
          )}
        </div>

        {/* Infra Cost */}
        <InfraCostDisplay costs={monthlyCosts} />

        {/* Phase status value + confidence % (no labels) */}
        <div className="pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">{project.phase_display}</div>
          <div className="text-sm text-gray-500">{project.confidence}%</div>
          {/* GITHUBプロジェクト — admin changelist column (label is the final path segment) */}
          {project.github_project_html_url && (
            <div className="mt-1 text-sm">
              <a
                href={project.github_project_html_url}
                className="text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                {githubProjectLabel(project.github_project_html_url)}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
