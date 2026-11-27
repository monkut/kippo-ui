import { useCallback, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Layout } from "~/components/layout";
import { PageError, PageLoading } from "~/components/page-state";
import { AssumptionsSection } from "~/components/project-detail/AssumptionsSection";
import { BusinessRequirementsSection } from "~/components/project-detail/BusinessRequirementsSection";
import { confirmAndDelete, type DeletableKind } from "~/components/project-detail/delete-actions";
import type { SectionDisplay } from "~/components/project-detail/display";
import { ProblemsSection } from "~/components/project-detail/ProblemsSection";
import { TechnicalRequirementsSection } from "~/components/project-detail/TechnicalRequirementsSection";
import type {
  AssumptionCategoryChoice,
  AssumptionType,
  BusinessRequirementType,
  ProblemType,
  TechnicalRequirementType,
} from "~/components/project-detail/types";
import { useApiQuery } from "~/hooks/useApiQuery";
import { useAuthGate } from "~/hooks/useAuthGate";
import { useRequirementComments } from "~/hooks/useRequirementComments";
import { useSectionForm } from "~/hooks/useSectionForm";
import type {
  KippoProject,
  ProjectAssumption,
  ProjectBusinessRequirement,
  ProjectBusinessRequirementCategory,
  ProjectProblemDefinition,
  ProjectTechnicalRequirement,
  ProjectTechnicalRequirementCategory,
} from "~/lib/api/generated/models";
import { ApiError, throwOnError } from "~/lib/api/api-error";
import { projectsRetrieve } from "~/lib/api/generated/projects/projects";
import {
  requirementsAssumptionsCategoriesRetrieve,
  requirementsAssumptionsList,
  requirementsBusinessRequirementCategoriesList,
  requirementsBusinessRequirementsList,
  requirementsBusinessRequirementsRetrieve,
  requirementsProblemDefinitionsList,
  requirementsTechnicalRequirementCategoriesList,
  requirementsTechnicalRequirementsList,
  requirementsTechnicalRequirementsRetrieve,
} from "~/lib/api/generated/requirements/requirements";
import { readList } from "~/lib/api/read-list";

// Display font-size levels (0=small/previous, 1=medium/default, 2=large), persisted in the URL (?fs=).
// Class literals are kept whole so Tailwind's source scanner emits them.
const TITLE_FONT_SIZES = ["text-sm", "text-xl", "text-2xl"] as const;
const BODY_FONT_SIZES = ["text-xs", "text-lg", "text-xl"] as const;
const DEFAULT_FONT_LEVEL = 1;
const FONT_LEVEL_OPTIONS = [
  { level: 0, label: "小" },
  { level: 1, label: "中" },
  { level: 2, label: "大" },
];

// Parse a comma-separated section list from a URL param into a Set.
const parseSectionSet = (value: string | null) => new Set((value ?? "").split(",").filter(Boolean));

type SectionKey = "assumptions" | "problems" | "business" | "technical";

const NO_ASSUMPTIONS: ProjectAssumption[] = [];
const NO_PROBLEMS: ProjectProblemDefinition[] = [];
const NO_BUSINESS_REQUIREMENTS: ProjectBusinessRequirement[] = [];
const NO_TECHNICAL_REQUIREMENTS: ProjectTechnicalRequirement[] = [];
const NO_ASSUMPTION_CATEGORIES: AssumptionCategoryChoice[] = [];
const NO_BUSINESS_CATEGORIES: ProjectBusinessRequirementCategory[] = [];
const NO_TECHNICAL_CATEGORIES: ProjectTechnicalRequirementCategory[] = [];

// customFetch resolves on 4xx / 5xx, so every response below goes through throwOnError: an error
// body must never be read as the project or as a list.

/** The project, or null when it does not exist or is outside the viewer's organizations (404). */
async function fetchProjectOrNull(projectId: string): Promise<KippoProject | null> {
  try {
    return throwOnError(await projectsRetrieve(projectId)).data ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** The project and its four requirement lists, fetched in parallel. */
async function fetchProjectDetail(projectId: string) {
  const [project, assumptionsRes, problemsRes, businessReqsRes, techReqsRes] = await Promise.all([
    fetchProjectOrNull(projectId),
    requirementsAssumptionsList({ project: projectId }).then(throwOnError),
    requirementsProblemDefinitionsList({ project: projectId }).then(throwOnError),
    requirementsBusinessRequirementsList({ project: projectId }).then(throwOnError),
    requirementsTechnicalRequirementsList({ project: projectId }).then(throwOnError),
  ]);
  return {
    project,
    assumptions: readList<ProjectAssumption>(assumptionsRes.data),
    problems: readList<ProjectProblemDefinition>(problemsRes.data),
    businessRequirements: readList<ProjectBusinessRequirement>(businessReqsRes.data),
    technicalRequirements: readList<ProjectTechnicalRequirement>(techReqsRes.data),
  };
}

/** Category choices (and the problem list) offered by the create / edit forms. */
async function fetchFormChoices(projectId: string) {
  const [assumptionCats, businessReqCats, techReqCats, problemsRes] = await Promise.all([
    requirementsAssumptionsCategoriesRetrieve().then(throwOnError),
    requirementsBusinessRequirementCategoriesList({ project: projectId }).then(throwOnError),
    requirementsTechnicalRequirementCategoriesList({ project: projectId }).then(throwOnError),
    requirementsProblemDefinitionsList({ project: projectId }).then(throwOnError),
  ]);
  return {
    // Assumption categories are enum-based choices returned as array
    assumptionCategories:
      (assumptionCats.data as unknown as AssumptionCategoryChoice[] | undefined) ??
      NO_ASSUMPTION_CATEGORIES,
    businessRequirementCategories: readList<ProjectBusinessRequirementCategory>(
      businessReqCats.data,
    ),
    technicalRequirementCategories: readList<ProjectTechnicalRequirementCategory>(techReqCats.data),
    problemDefinitions: readList<ProjectProblemDefinition>(problemsRes.data),
  };
}

export function meta() {
  return [{ title: "プロジェクト詳細 - Kippo要件管理" }];
}

export default function ProjectDetails() {
  const { id: projectId } = useParams();
  const { user, authLoading } = useAuthGate();
  // A failed delete, shown above the sections of the project it happened on. Scoped to that
  // project (so it does not follow the viewer to another one) and cleared when the lists reload.
  const [actionError, setActionError] = useState<{ projectId: string; message: string } | null>(
    null,
  );
  const actionErrorMessage =
    actionError && actionError.projectId === projectId ? actionError.message : "";

  const enabled = !!user && !!projectId;
  const detailQuery = useApiQuery(
    () => fetchProjectDetail(projectId ?? ""),
    [user?.username, projectId],
    { enabled },
  );
  // Non-fatal: on failure the forms just offer no categories.
  const choicesQuery = useApiQuery(
    () => fetchFormChoices(projectId ?? ""),
    [user?.username, projectId],
    { enabled, keepPreviousData: true },
  );
  const project = detailQuery.data?.project ?? null;
  const assumptions = detailQuery.data?.assumptions ?? NO_ASSUMPTIONS;
  const problems = detailQuery.data?.problems ?? NO_PROBLEMS;
  const businessRequirements = detailQuery.data?.businessRequirements ?? NO_BUSINESS_REQUIREMENTS;
  const technicalRequirements =
    detailQuery.data?.technicalRequirements ?? NO_TECHNICAL_REQUIREMENTS;
  const assumptionCategories = choicesQuery.data?.assumptionCategories ?? NO_ASSUMPTION_CATEGORIES;
  const businessRequirementCategories =
    choicesQuery.data?.businessRequirementCategories ?? NO_BUSINESS_CATEGORIES;
  const technicalRequirementCategories =
    choicesQuery.data?.technicalRequirementCategories ?? NO_TECHNICAL_CATEGORIES;
  const problemDefinitions = choicesQuery.data?.problemDefinitions ?? NO_PROBLEMS;
  // Without a project id nothing is ever fetched: stay on the loading placeholder.
  const isLoading = detailQuery.isLoading || !projectId;
  const error = detailQuery.error ? "プロジェクトの読み込みに失敗しました" : "";

  const reloadDetail = detailQuery.reload;
  const reloadChoices = choicesQuery.reload;
  const handleChanged = useCallback(() => {
    setActionError(null);
    reloadDetail();
    reloadChoices();
  }, [reloadDetail, reloadChoices]);

  const handleDelete = useCallback(
    async (kind: DeletableKind, id: number, title: string) => {
      const result = await confirmAndDelete(kind, id, title);
      if (result.status === "deleted") handleChanged();
      if (result.status === "failed" && projectId) {
        setActionError({ projectId, message: result.message });
      }
    },
    [handleChanged, projectId],
  );

  const assumptionForm = useSectionForm<AssumptionType>();
  const problemForm = useSectionForm<ProblemType>();
  const businessReqForm = useSectionForm<BusinessRequirementType>();
  const techReqForm = useSectionForm<TechnicalRequirementType>();

  const businessReqComments = useRequirementComments(requirementsBusinessRequirementsRetrieve);
  const techReqComments = useRequirementComments(requirementsTechnicalRequirementsRetrieve);

  const [hoveredBusinessReqId, setHoveredBusinessReqId] = useState<number | null>(null);
  const [hoveredTechReqId, setHoveredTechReqId] = useState<number | null>(null);

  // Display selections persisted in the URL so they can be copied and re-applied.
  const [searchParams, setSearchParams] = useSearchParams();

  // Font size level (?fs=); default to middle when absent or invalid.
  const parsedFontLevel = Number.parseInt(searchParams.get("fs") ?? "", 10);
  const fontLevel =
    parsedFontLevel === 0 || parsedFontLevel === 2 ? parsedFontLevel : DEFAULT_FONT_LEVEL;
  const titleSize = TITLE_FONT_SIZES[fontLevel];
  const bodySize = BODY_FONT_SIZES[fontLevel];
  const setFontLevel = useCallback(
    (level: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (level === DEFAULT_FONT_LEVEL) next.delete("fs");
          else next.set("fs", String(level));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Toggle a section key within a comma-separated URL param (?compact=, ?collapsed=).
  const toggleSectionFlag = useCallback(
    (param: string, section: SectionKey) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const sections = parseSectionSet(next.get(param));
          if (sections.has(section)) sections.delete(section);
          else sections.add(section);
          if (sections.size > 0) next.set(param, [...sections].join(","));
          else next.delete(param);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Per-section "compact" selections (?compact=assumptions,problems,business,technical) and
  // collapse (?collapsed=...); sections are expanded by default.
  const compactSections = useMemo(
    () => parseSectionSet(searchParams.get("compact")),
    [searchParams],
  );
  const collapsedSections = useMemo(
    () => parseSectionSet(searchParams.get("collapsed")),
    [searchParams],
  );
  const sectionDisplay = (section: SectionKey): SectionDisplay => ({
    expanded: !collapsedSections.has(section),
    compact: compactSections.has(section),
    titleSize,
    bodySize,
    onToggleExpanded: () => toggleSectionFlag("collapsed", section),
    onToggleCompact: () => toggleSectionFlag("compact", section),
  });

  if (authLoading || isLoading) {
    return (
      <Layout>
        <PageLoading />
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <Layout>
        <PageError message={error} />
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">プロジェクトが見つかりません</p>
          <Link to="/projects" className="mt-4 text-indigo-600 hover:text-indigo-500">
            プロジェクト一覧に戻る
          </Link>
        </div>
      </Layout>
    );
  }

  // Problems no business requirement refers to, and business requirements no technical
  // requirement refers to: flagged as 未対応 in the next section's header.
  const problemIdsWithBusinessReqs = new Set(businessRequirements.flatMap((req) => req.problems));
  const unaddressedProblemIds = problems
    .filter((p) => !problemIdsWithBusinessReqs.has(p.id))
    .map((p) => p.display_id);
  const businessReqIdsWithTechReqs = new Set(
    technicalRequirements.flatMap((req) => req.business_requirements),
  );
  const unaddressedBusinessReqIds = businessRequirements
    .filter((b) => !businessReqIdsWithTechReqs.has(b.id))
    .map((b) => b.display_id);

  // Hovering a business / technical requirement highlights the rows it refers to one level up.
  const highlightedProblemIds = new Set(
    businessRequirements.find((b) => b.id === hoveredBusinessReqId)?.problems ?? [],
  );
  const highlightedBusinessReqIds = new Set(
    technicalRequirements.find((t) => t.id === hoveredTechReqId)?.business_requirements ?? [],
  );

  return (
    <Layout
      projectName={project.name}
      projectCustomerName={project.customer_name}
      projectId={projectId}
    >
      <div className="space-y-6">
        {actionErrorMessage && <PageError message={actionErrorMessage} />}
        {/* Display controls (font size) */}
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-gray-500">文字サイズ</span>
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
            {FONT_LEVEL_OPTIONS.map((option) => (
              <button
                key={option.level}
                type="button"
                onClick={() => setFontLevel(option.level)}
                aria-pressed={fontLevel === option.level}
                className={`px-3 py-1 text-sm font-medium border-l border-gray-300 first:border-l-0 ${
                  fontLevel === option.level
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <AssumptionsSection
          projectId={projectId}
          assumptions={assumptions}
          categories={assumptionCategories}
          display={sectionDisplay("assumptions")}
          form={assumptionForm}
          onChanged={handleChanged}
          onDelete={(id, title) => handleDelete("assumption", id, title)}
        />
        <ProblemsSection
          projectId={projectId}
          problems={problems}
          highlightedIds={highlightedProblemIds}
          display={sectionDisplay("problems")}
          form={problemForm}
          onChanged={handleChanged}
          onDelete={(id, title) => handleDelete("problem", id, title)}
        />
        <BusinessRequirementsSection
          projectId={projectId}
          requirements={businessRequirements}
          categories={businessRequirementCategories}
          problems={problemDefinitions}
          unaddressedProblemIds={unaddressedProblemIds}
          highlightedIds={highlightedBusinessReqIds}
          onHover={setHoveredBusinessReqId}
          display={sectionDisplay("business")}
          form={businessReqForm}
          comments={businessReqComments}
          onChanged={handleChanged}
          onDelete={(id, title) => handleDelete("business", id, title)}
        />
        <TechnicalRequirementsSection
          projectId={projectId}
          requirements={technicalRequirements}
          categories={technicalRequirementCategories}
          businessRequirements={businessRequirements}
          unaddressedBusinessReqIds={unaddressedBusinessReqIds}
          onHover={setHoveredTechReqId}
          display={sectionDisplay("technical")}
          form={techReqForm}
          comments={techReqComments}
          onChanged={handleChanged}
          onDelete={(id, title) => handleDelete("technical", id, title)}
        />
      </div>
    </Layout>
  );
}
