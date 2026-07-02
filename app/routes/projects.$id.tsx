import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useAuthGate } from "~/hooks/useAuthGate";
import { Layout } from "~/components/layout";
import { ChevronIcon, CommentIcon, DeleteIcon, EditIcon } from "~/components/icons";
import { CommentInlineForm } from "~/components/project-detail/CommentInlineForm";
import { CommentList } from "~/components/project-detail/CommentList";
import {
  AssumptionEditForm,
  AssumptionInlineForm,
} from "~/components/project-detail/forms/AssumptionForms";
import {
  BusinessRequirementEditForm,
  BusinessRequirementInlineForm,
} from "~/components/project-detail/forms/BusinessRequirementForms";
import { ProblemEditForm, ProblemInlineForm } from "~/components/project-detail/forms/ProblemForms";
import {
  TechnicalRequirementEditForm,
  TechnicalRequirementInlineForm,
} from "~/components/project-detail/forms/TechnicalRequirementForms";
import type {
  AssumptionCategoryChoice,
  AssumptionType,
  BusinessRequirementType,
  CommentData,
  ProblemType,
  TechnicalRequirementType,
} from "~/components/project-detail/types";
import { projectsRetrieve } from "~/lib/api/generated/projects/projects";
import {
  requirementsAssumptionsDestroy,
  requirementsAssumptionsCategoriesRetrieve,
  requirementsAssumptionsList,
  requirementsProblemDefinitionsDestroy,
  requirementsProblemDefinitionsList,
  requirementsBusinessRequirementsDestroy,
  requirementsBusinessRequirementsRetrieve,
  requirementsBusinessRequirementsList,
  requirementsBusinessRequirementCategoriesList,
  requirementsTechnicalRequirementsDestroy,
  requirementsTechnicalRequirementsList,
  requirementsTechnicalRequirementCategoriesList,
  requirementsTechnicalRequirementsRetrieve,
} from "~/lib/api/generated/requirements/requirements";
import type {
  KippoProject,
  ProjectBusinessRequirementCategory,
  ProjectProblemDefinition,
  ProjectTechnicalRequirementCategory,
  ProjectAssumption,
  ProjectBusinessRequirement,
  ProjectTechnicalRequirement,
} from "~/lib/api/generated/models";

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

export function meta() {
  return [{ title: "プロジェクト詳細 - Kippo要件管理" }];
}

function getAssumptionCategoryColor(category: string | undefined): string {
  if (category?.toLowerCase().includes("constraint")) {
    return "bg-orange-100 text-orange-800";
  }
  return "bg-blue-100 text-blue-800";
}

const CATEGORY_COLORS = [
  "bg-green-100 text-green-800",
  "bg-purple-100 text-purple-800",
  "bg-pink-100 text-pink-800",
  "bg-cyan-100 text-cyan-800",
  "bg-yellow-100 text-yellow-800",
  "bg-rose-100 text-rose-800",
  "bg-teal-100 text-teal-800",
  "bg-indigo-100 text-indigo-800",
];

function getBusinessReqCategoryColor(categoryId: number): string {
  return CATEGORY_COLORS[categoryId % CATEGORY_COLORS.length];
}

// Helper to get business requirement category name from category ID
function getBusinessReqCategoryName(
  categoryId: number,
  categories: ProjectBusinessRequirementCategory[],
): string {
  const category = categories.find((c) => c.id === categoryId);
  return category?.name || "-";
}

// Helper to get problem display IDs from problem IDs
function getProblemDisplayIds(
  problemIds: number[] | undefined,
  problems: ProjectProblemDefinition[],
): string {
  if (!problemIds || problemIds.length === 0) return "-";
  return problemIds
    .map((id) => problems.find((p) => p.id === id)?.display_id || `#${id}`)
    .join(", ");
}

export default function ProjectDetails() {
  const { id: projectId } = useParams();
  const { user, authLoading } = useAuthGate();
  const [project, setProject] = useState<KippoProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Requirements data (fetched separately from project)
  const [assumptions, setAssumptions] = useState<ProjectAssumption[]>([]);
  const [problems, setProblems] = useState<ProjectProblemDefinition[]>([]);
  const [businessRequirements, setBusinessRequirements] = useState<ProjectBusinessRequirement[]>(
    [],
  );
  const [technicalRequirements, setTechnicalRequirements] = useState<ProjectTechnicalRequirement[]>(
    [],
  );

  const [assumptionCategories, setAssumptionCategories] = useState<AssumptionCategoryChoice[]>([]);
  const [businessRequirementCategories, setBusinessRequirementCategories] = useState<
    ProjectBusinessRequirementCategory[]
  >([]);
  const [technicalRequirementCategories, setTechnicalRequirementCategories] = useState<
    ProjectTechnicalRequirementCategory[]
  >([]);
  const [problemDefinitions, setProblemDefinitions] = useState<ProjectProblemDefinition[]>([]);

  const [showProblemForm, setShowProblemForm] = useState(false);
  const [showAssumptionForm, setShowAssumptionForm] = useState(false);
  const [showBusinessReqForm, setShowBusinessReqForm] = useState(false);
  const [showTechReqForm, setShowTechReqForm] = useState(false);

  const [editingProblem, setEditingProblem] = useState<ProblemType | null>(null);
  const [editingAssumption, setEditingAssumption] = useState<AssumptionType | null>(null);
  const [editingBusinessReq, setEditingBusinessReq] = useState<BusinessRequirementType | null>(
    null,
  );
  const [editingTechReq, setEditingTechReq] = useState<TechnicalRequirementType | null>(null);

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
    (param: string, section: string) => {
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

  // Per-section "compact" selections (?compact=assumptions,problems,business,technical).
  const compactSections = useMemo(
    () => parseSectionSet(searchParams.get("compact")),
    [searchParams],
  );
  const assumptionsCompact = compactSections.has("assumptions");
  const problemsCompact = compactSections.has("problems");
  const businessReqsCompact = compactSections.has("business");
  const techReqsCompact = compactSections.has("technical");

  // Per-section collapse (?collapsed=...); sections are expanded by default.
  const collapsedSections = useMemo(
    () => parseSectionSet(searchParams.get("collapsed")),
    [searchParams],
  );
  const assumptionsExpanded = !collapsedSections.has("assumptions");
  const problemsExpanded = !collapsedSections.has("problems");
  const businessReqsExpanded = !collapsedSections.has("business");
  const techReqsExpanded = !collapsedSections.has("technical");

  const [expandedComments, setExpandedComments] = useState<number | null>(null);
  const [businessReqComments, setBusinessReqComments] = useState<CommentData[]>([]);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [replyToComment, setReplyToComment] = useState<number | null>(null);

  const [expandedTechComments, setExpandedTechComments] = useState<number | null>(null);
  const [techReqComments, setTechReqComments] = useState<CommentData[]>([]);
  const [showTechCommentForm, setShowTechCommentForm] = useState(false);
  const [replyToTechComment, setReplyToTechComment] = useState<number | null>(null);

  const [hoveredBusinessReqId, setHoveredBusinessReqId] = useState<number | null>(null);
  const [hoveredTechReqId, setHoveredTechReqId] = useState<number | null>(null);

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError("");
    try {
      // Fetch project and requirements data in parallel
      const [projectRes, assumptionsRes, problemsRes, businessReqsRes, techReqsRes] =
        await Promise.all([
          projectsRetrieve(projectId),
          requirementsAssumptionsList({ project: projectId }),
          requirementsProblemDefinitionsList({ project: projectId }),
          requirementsBusinessRequirementsList({ project: projectId }),
          requirementsTechnicalRequirementsList({ project: projectId }),
        ]);
      if (projectRes.data) {
        setProject(projectRes.data);
      }
      if (assumptionsRes.data?.results) {
        setAssumptions(assumptionsRes.data.results);
      }
      if (problemsRes.data?.results) {
        setProblems(problemsRes.data.results);
      }
      if (businessReqsRes.data?.results) {
        setBusinessRequirements(businessReqsRes.data.results);
      }
      if (techReqsRes.data?.results) {
        setTechnicalRequirements(techReqsRes.data.results);
      }
    } catch (err) {
      console.error("Failed to load project:", err);
      setError("プロジェクトの読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const loadCategories = useCallback(async () => {
    if (!projectId) return;
    try {
      const [assumptionCats, businessReqCats, techReqCats, problemsRes] = await Promise.all([
        requirementsAssumptionsCategoriesRetrieve(),
        requirementsBusinessRequirementCategoriesList({ project: projectId }),
        requirementsTechnicalRequirementCategoriesList({ project: projectId }),
        requirementsProblemDefinitionsList({ project: projectId }),
      ]);
      // Assumption categories are enum-based choices returned as array
      if (assumptionCats.data) {
        setAssumptionCategories(assumptionCats.data as unknown as AssumptionCategoryChoice[]);
      }
      if (businessReqCats.data?.results) {
        setBusinessRequirementCategories(businessReqCats.data.results);
      }
      if (techReqCats.data?.results) {
        setTechnicalRequirementCategories(techReqCats.data.results);
      }
      if (problemsRes.data?.results) {
        setProblemDefinitions(problemsRes.data.results);
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, [projectId]);

  useEffect(() => {
    if (user && projectId) {
      loadProject();
      loadCategories();
    }
  }, [user, projectId, loadProject, loadCategories]);

  const handleCreated = () => {
    loadProject();
    loadCategories();
  };

  const loadCommentsForRequirement = useCallback(async (reqId: number) => {
    try {
      const response = await requirementsBusinessRequirementsRetrieve(reqId);
      if (response.data?.comments) {
        setBusinessReqComments(response.data.comments as unknown as CommentData[]);
      } else {
        setBusinessReqComments([]);
      }
    } catch (err) {
      console.error("Failed to load comments:", err);
      setBusinessReqComments([]);
    }
  }, []);

  const handleToggleComments = async (reqId: number) => {
    if (expandedComments === reqId) {
      setExpandedComments(null);
      setBusinessReqComments([]);
      setShowCommentForm(false);
      setReplyToComment(null);
    } else {
      setExpandedComments(reqId);
      setShowCommentForm(false);
      setReplyToComment(null);
      await loadCommentsForRequirement(reqId);
    }
  };

  const loadCommentsForTechRequirement = useCallback(async (reqId: number) => {
    try {
      const response = await requirementsTechnicalRequirementsRetrieve(reqId);
      if (response.data?.comments) {
        setTechReqComments(response.data.comments as unknown as CommentData[]);
      } else {
        setTechReqComments([]);
      }
    } catch (err) {
      console.error("Failed to load tech comments:", err);
      setTechReqComments([]);
    }
  }, []);

  const handleToggleTechComments = async (reqId: number) => {
    if (expandedTechComments === reqId) {
      setExpandedTechComments(null);
      setTechReqComments([]);
      setShowTechCommentForm(false);
      setReplyToTechComment(null);
    } else {
      setExpandedTechComments(reqId);
      setShowTechCommentForm(false);
      setReplyToTechComment(null);
      await loadCommentsForTechRequirement(reqId);
    }
  };

  const handleDeleteAssumption = async (id: number, title: string) => {
    if (!window.confirm(`前提条件「${title}」を削除しますか？`)) return;
    try {
      await requirementsAssumptionsDestroy(id);
      handleCreated();
    } catch (err) {
      console.error("Failed to delete assumption:", err);
      setError("前提条件の削除に失敗しました");
    }
  };

  const handleDeleteProblem = async (id: number, title: string) => {
    if (
      !window.confirm(`課題定義「${title}」を削除しますか？\n関連するビジネス要件も削除されます。`)
    )
      return;
    try {
      await requirementsProblemDefinitionsDestroy(id);
      handleCreated();
    } catch (err) {
      console.error("Failed to delete problem:", err);
      setError("課題定義の削除に失敗しました");
    }
  };

  const handleDeleteBusinessReq = async (id: number, title: string) => {
    if (
      !window.confirm(`ビジネス要件「${title}」を削除しますか？\n関連する技術要件も削除されます。`)
    )
      return;
    try {
      await requirementsBusinessRequirementsDestroy(id);
      handleCreated();
    } catch (err) {
      console.error("Failed to delete business requirement:", err);
      setError("ビジネス要件の削除に失敗しました");
    }
  };

  const handleDeleteTechReq = async (id: number, title: string) => {
    if (!window.confirm(`技術要件「${title}」を削除しますか？`)) return;
    try {
      await requirementsTechnicalRequirementsDestroy(id);
      handleCreated();
    } catch (err) {
      console.error("Failed to delete technical requirement:", err);
      setError("技術要件の削除に失敗しました");
    }
  };

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <Layout>
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
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

  // Cast state data to component types for rendering
  const problemsList = problems as unknown as ProblemType[];
  const assumptionsList = assumptions as unknown as AssumptionType[];
  const businessReqsList = businessRequirements as unknown as BusinessRequirementType[];
  const techReqsList = technicalRequirements as unknown as TechnicalRequirementType[];

  const problemIdsWithBusinessReqs = new Set(
    businessReqsList?.flatMap((req) => req.problems) || [],
  );
  const orphanedProblems = problemsList?.filter((p) => !problemIdsWithBusinessReqs.has(p.id)) || [];

  const businessReqIdsWithTechReqs = new Set(
    techReqsList?.flatMap((req) => req.business_requirements) || [],
  );
  const orphanedBusinessReqs =
    businessReqsList?.filter((b) => !businessReqIdsWithTechReqs.has(b.id)) || [];

  // Get problem IDs highlighted based on hovered business requirement
  const highlightedProblemIds = new Set(
    hoveredBusinessReqId
      ? businessReqsList?.find((b) => b.id === hoveredBusinessReqId)?.problems || []
      : [],
  );

  // Alias for template compatibility
  const problemsData = problemsList;
  const assumptionsData = assumptionsList;
  const businessRequirementsData = businessReqsList;
  const technicalRequirementsData = techReqsList;

  // Get business requirement IDs highlighted based on hovered technical requirement
  const highlightedBusinessReqIds = new Set(
    hoveredTechReqId
      ? techReqsList?.find((t) => t.id === hoveredTechReqId)?.business_requirements || []
      : [],
  );

  return (
    <Layout projectName={project.name} projectId={projectId}>
      <div className="space-y-6">
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

        {/* Assumptions Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <button
              type="button"
              onClick={() => toggleSectionFlag("collapsed", "assumptions")}
              className="flex items-center gap-2 text-lg font-medium text-gray-900 hover:text-gray-700"
            >
              <ChevronIcon isExpanded={assumptionsExpanded} />
              <span>前提条件と制約事項</span>
              {!assumptionsExpanded && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({assumptions?.length || 0}件)
                </span>
              )}
            </button>
            {assumptionsExpanded && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleSectionFlag("compact", "assumptions")}
                  className={`px-2 py-1 text-xs font-medium rounded-md ${
                    assumptionsCompact
                      ? "bg-gray-200 text-gray-700"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  コンパクト
                </button>
                {!showAssumptionForm && !editingAssumption && (
                  <button
                    type="button"
                    onClick={() => setShowAssumptionForm(true)}
                    className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100"
                  >
                    追加
                  </button>
                )}
              </div>
            )}
          </div>
          {assumptionsExpanded && (
            <div className="p-6">
              {assumptions?.length === 0 && !showAssumptionForm ? (
                <p className="text-gray-500 text-center py-4">前提条件がありません</p>
              ) : assumptionsCompact ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
                  {assumptions?.map((assumption) => (
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
                  {assumptions?.map((assumption) =>
                    editingAssumption?.id === assumption.id ? (
                      <li key={assumption.id} className="py-3">
                        <AssumptionEditForm
                          assumption={editingAssumption}
                          categories={assumptionCategories}
                          onCancel={() => setEditingAssumption(null)}
                          onUpdated={() => {
                            setEditingAssumption(null);
                            handleCreated();
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
                            <button
                              type="button"
                              onClick={() => setEditingAssumption(assumption)}
                              className="p-1 text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="編集"
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteAssumption(assumption.id, assumption.title)
                              }
                              className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="削除"
                            >
                              <DeleteIcon />
                            </button>
                          </div>
                        </div>
                        {assumption.details && (
                          <p
                            className={`mt-1 ${titleSize} text-gray-500 ml-16 whitespace-pre-line`}
                          >
                            {assumption.details}
                          </p>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              )}
              {showAssumptionForm && projectId && (
                <AssumptionInlineForm
                  projectId={projectId}
                  categories={assumptionCategories}
                  onCancel={() => setShowAssumptionForm(false)}
                  onCreated={() => {
                    setShowAssumptionForm(false);
                    handleCreated();
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Problem Definitions Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <button
              type="button"
              onClick={() => toggleSectionFlag("collapsed", "problems")}
              className="flex items-center gap-2 text-lg font-medium text-gray-900 hover:text-gray-700"
            >
              <ChevronIcon isExpanded={problemsExpanded} />
              <span>課題定義</span>
              {!problemsExpanded && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({problems?.length || 0}件)
                </span>
              )}
            </button>
            {problemsExpanded && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleSectionFlag("compact", "problems")}
                  className={`px-2 py-1 text-xs font-medium rounded-md ${
                    problemsCompact
                      ? "bg-gray-200 text-gray-700"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  コンパクト
                </button>
                {!showProblemForm && !editingProblem && (
                  <button
                    type="button"
                    onClick={() => setShowProblemForm(true)}
                    className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100"
                  >
                    追加
                  </button>
                )}
              </div>
            )}
          </div>
          {problemsExpanded && (
            <div className="p-6">
              {problems?.length === 0 && !showProblemForm ? (
                <p className="text-gray-500 text-center py-4">課題定義がありません</p>
              ) : problemsCompact ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
                  {problems?.map((problem) => (
                    <div
                      key={problem.id}
                      className={`flex items-center gap-2 py-1 px-1 -mx-1 rounded transition-colors min-w-0 overflow-hidden ${
                        highlightedProblemIds.has(problem.id)
                          ? "bg-indigo-100 ring-2 ring-indigo-400"
                          : ""
                      }`}
                      title={problem.title}
                    >
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded shrink-0">
                        {problem.display_id}
                      </span>
                      <span className={`${titleSize} text-gray-900 truncate min-w-0`}>
                        {problem.title}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {problems?.map((problem) =>
                    editingProblem?.id === problem.id ? (
                      <li key={problem.id} className="py-3">
                        <ProblemEditForm
                          problem={editingProblem}
                          onCancel={() => setEditingProblem(null)}
                          onUpdated={() => {
                            setEditingProblem(null);
                            handleCreated();
                          }}
                        />
                      </li>
                    ) : (
                      <li
                        key={problem.id}
                        className={`py-3 group rounded transition-colors ${
                          highlightedProblemIds.has(problem.id)
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
                            <button
                              type="button"
                              onClick={() => setEditingProblem(problem)}
                              className="p-1 text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="編集"
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProblem(problem.id, problem.title)}
                              className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="削除"
                            >
                              <DeleteIcon />
                            </button>
                          </div>
                        </div>
                        {problem.details && (
                          <p
                            className={`mt-1 ${titleSize} text-gray-500 ml-16 whitespace-pre-line`}
                          >
                            {problem.details}
                          </p>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              )}
              {showProblemForm && projectId && (
                <ProblemInlineForm
                  projectId={projectId}
                  onCancel={() => setShowProblemForm(false)}
                  onCreated={() => {
                    setShowProblemForm(false);
                    handleCreated();
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Business Requirements Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleSectionFlag("collapsed", "business")}
                className="flex items-center gap-2 text-lg font-medium text-gray-900 hover:text-gray-700"
              >
                <ChevronIcon isExpanded={businessReqsExpanded} />
                <span>ビジネス要件</span>
                {!businessReqsExpanded && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({businessRequirements?.length || 0}件)
                  </span>
                )}
              </button>
              {orphanedProblems.length > 0 && (
                <span className="text-xs text-red-600">
                  未対応: {orphanedProblems.map((p) => p.display_id).join(", ")}
                </span>
              )}
            </div>
            {businessReqsExpanded && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleSectionFlag("compact", "business")}
                  className={`px-2 py-1 text-xs font-medium rounded-md ${
                    businessReqsCompact
                      ? "bg-gray-200 text-gray-700"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  コンパクト
                </button>
                {!showBusinessReqForm && !editingBusinessReq && (
                  <button
                    type="button"
                    onClick={() => setShowBusinessReqForm(true)}
                    className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100"
                  >
                    追加
                  </button>
                )}
              </div>
            )}
          </div>
          {businessReqsExpanded && (
            <div className="p-6">
              {businessRequirements?.length === 0 && !showBusinessReqForm ? (
                <p className="text-gray-500 text-center py-4">ビジネス要件がありません</p>
              ) : businessReqsCompact ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
                  {businessRequirements?.map((req) => (
                    <Link
                      key={req.id}
                      to={`/projects/${projectId}/requirements/${req.id}`}
                      className={`flex items-center gap-2 py-1 rounded px-1 -mx-1 transition-colors min-w-0 overflow-hidden ${
                        highlightedBusinessReqIds.has(req.id)
                          ? "bg-indigo-100 ring-2 ring-indigo-400"
                          : "hover:bg-gray-50"
                      }`}
                      title={req.title}
                      onMouseEnter={() => setHoveredBusinessReqId(req.id)}
                      onMouseLeave={() => setHoveredBusinessReqId(null)}
                    >
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded shrink-0">
                        {req.display_id}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${getBusinessReqCategoryColor(req.category)}`}
                      >
                        {getBusinessReqCategoryName(req.category, businessRequirementCategories)}
                      </span>
                      <span className={`${titleSize} text-gray-900 truncate min-w-0`}>
                        {req.title}
                      </span>
                      {req.problems && req.problems.length > 0 && (
                        <span className="text-xs text-gray-500 shrink-0">
                          ({getProblemDisplayIds(req.problems, problemDefinitions)})
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {businessRequirements?.map((req) =>
                    editingBusinessReq?.id === req.id ? (
                      <li key={req.id} className="py-3">
                        <BusinessRequirementEditForm
                          requirement={editingBusinessReq}
                          categories={businessRequirementCategories}
                          problems={problemDefinitions}
                          onCancel={() => setEditingBusinessReq(null)}
                          onUpdated={() => {
                            setEditingBusinessReq(null);
                            handleCreated();
                          }}
                        />
                      </li>
                    ) : (
                      <li
                        key={req.id}
                        className={`py-3 rounded transition-colors ${
                          highlightedBusinessReqIds.has(req.id)
                            ? "bg-indigo-100 ring-2 ring-indigo-400 px-2 -mx-2"
                            : ""
                        }`}
                        onMouseEnter={() => setHoveredBusinessReqId(req.id)}
                        onMouseLeave={() => setHoveredBusinessReqId(null)}
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
                                  {getBusinessReqCategoryName(
                                    req.category,
                                    businessRequirementCategories,
                                  )}
                                </span>
                                <span className={`${titleSize} text-gray-900`}>{req.title}</span>
                              </div>
                              <p className={`mt-1 ${bodySize} text-gray-500 ml-16`}>
                                課題: {getProblemDisplayIds(req.problems, problemDefinitions)}
                              </p>
                              {req.details && (
                                <p
                                  className={`mt-1 ${bodySize} text-gray-500 ml-16 whitespace-pre-line`}
                                >
                                  {req.details}
                                </p>
                              )}
                            </Link>
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleToggleComments(req.id);
                                }}
                                className={`p-1 transition-opacity ${
                                  expandedComments === req.id
                                    ? "text-indigo-600"
                                    : "text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100"
                                }`}
                                title="コメント"
                              >
                                <CommentIcon />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingBusinessReq(req);
                                }}
                                className="p-1 text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="編集"
                              >
                                <EditIcon />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDeleteBusinessReq(req.id, req.title);
                                }}
                                className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="削除"
                              >
                                <DeleteIcon />
                              </button>
                            </div>
                          </div>
                        </div>
                        {expandedComments === req.id && (
                          <div className="mt-3 ml-4 pl-4 border-l-2 border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="text-sm font-medium text-gray-700">コメント</h4>
                              {!showCommentForm && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyToComment(null);
                                    setShowCommentForm(true);
                                  }}
                                  className="text-xs text-indigo-600 hover:text-indigo-500"
                                >
                                  追加
                                </button>
                              )}
                            </div>
                            {businessReqComments.length === 0 && !showCommentForm ? (
                              <p className="text-xs text-gray-500">コメントがありません</p>
                            ) : (
                              <CommentList
                                comments={businessReqComments}
                                onReply={(commentId) => {
                                  setReplyToComment(commentId);
                                  setShowCommentForm(true);
                                }}
                              />
                            )}
                            {showCommentForm && (
                              <CommentInlineForm
                                requirementId={req.id}
                                parentCommentId={replyToComment}
                                onCancel={() => {
                                  setShowCommentForm(false);
                                  setReplyToComment(null);
                                }}
                                onCreated={() => {
                                  setShowCommentForm(false);
                                  setReplyToComment(null);
                                  loadCommentsForRequirement(req.id);
                                }}
                              />
                            )}
                          </div>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              )}
              {showBusinessReqForm && projectId && (
                <BusinessRequirementInlineForm
                  projectId={projectId}
                  categories={businessRequirementCategories}
                  problems={problemDefinitions}
                  onCancel={() => setShowBusinessReqForm(false)}
                  onCreated={() => {
                    setShowBusinessReqForm(false);
                    handleCreated();
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Technical Requirements Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleSectionFlag("collapsed", "technical")}
                className="flex items-center gap-2 text-lg font-medium text-gray-900 hover:text-gray-700"
              >
                <ChevronIcon isExpanded={techReqsExpanded} />
                <span>技術要件</span>
                {!techReqsExpanded && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({technicalRequirements?.length || 0}件)
                  </span>
                )}
              </button>
              {orphanedBusinessReqs.length > 0 && (
                <span className="text-xs text-red-600">
                  未対応: {orphanedBusinessReqs.map((b) => b.display_id).join(", ")}
                </span>
              )}
            </div>
            {techReqsExpanded && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleSectionFlag("compact", "technical")}
                  className={`px-2 py-1 text-xs font-medium rounded-md ${
                    techReqsCompact
                      ? "bg-gray-200 text-gray-700"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  コンパクト
                </button>
                {!showTechReqForm && !editingTechReq && (
                  <button
                    type="button"
                    onClick={() => setShowTechReqForm(true)}
                    className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100"
                  >
                    追加
                  </button>
                )}
              </div>
            )}
          </div>
          {techReqsExpanded && (
            <div className="p-6">
              {technicalRequirements?.length === 0 && !showTechReqForm ? (
                <p className="text-gray-500 text-center py-4">技術要件がありません</p>
              ) : techReqsCompact ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
                  {technicalRequirements?.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center gap-2 py-1 px-1 -mx-1 min-w-0 overflow-hidden rounded transition-colors cursor-default"
                      title={req.title}
                      onMouseEnter={() => setHoveredTechReqId(req.id)}
                      onMouseLeave={() => setHoveredTechReqId(null)}
                    >
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded shrink-0">
                        {req.display_id}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${getBusinessReqCategoryColor(req.category)}`}
                      >
                        {req.category_name}
                      </span>
                      <span className={`${titleSize} text-gray-900 truncate min-w-0`}>
                        {req.title}
                      </span>
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
                  {technicalRequirements?.map((req) =>
                    editingTechReq?.id === req.id ? (
                      <li key={req.id} className="py-3">
                        <TechnicalRequirementEditForm
                          requirement={editingTechReq}
                          categories={technicalRequirementCategories}
                          businessRequirements={businessRequirements}
                          onCancel={() => setEditingTechReq(null)}
                          onUpdated={() => {
                            setEditingTechReq(null);
                            handleCreated();
                          }}
                        />
                      </li>
                    ) : (
                      <li
                        key={req.id}
                        className="py-3 group"
                        onMouseEnter={() => setHoveredTechReqId(req.id)}
                        onMouseLeave={() => setHoveredTechReqId(null)}
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
                                    ?.filter((b) => req.business_requirements?.includes(b.id))
                                    .map((b) => b.display_id)
                                    .join(", ") || "-"
                                : "-"}
                            </p>
                            {req.details && (
                              <p
                                className={`mt-1 ${bodySize} text-gray-500 ml-16 whitespace-pre-line`}
                              >
                                {req.details}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleToggleTechComments(req.id);
                              }}
                              className={`p-1 transition-opacity ${
                                expandedTechComments === req.id
                                  ? "text-indigo-600"
                                  : "text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100"
                              }`}
                              title="コメント"
                            >
                              <CommentIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTechReq(req)}
                              className="p-1 text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="編集"
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTechReq(req.id, req.title)}
                              className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="削除"
                            >
                              <DeleteIcon />
                            </button>
                          </div>
                        </div>
                        {expandedTechComments === req.id && (
                          <div className="mt-3 ml-4 pl-4 border-l-2 border-gray-100">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="text-sm font-medium text-gray-700">コメント</h4>
                              {!showTechCommentForm && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyToTechComment(null);
                                    setShowTechCommentForm(true);
                                  }}
                                  className="text-xs text-indigo-600 hover:text-indigo-500"
                                >
                                  追加
                                </button>
                              )}
                            </div>
                            {techReqComments.length === 0 && !showTechCommentForm ? (
                              <p className="text-xs text-gray-500">コメントがありません</p>
                            ) : (
                              <CommentList
                                comments={techReqComments}
                                onReply={(commentId) => {
                                  setReplyToTechComment(commentId);
                                  setShowTechCommentForm(true);
                                }}
                              />
                            )}
                            {showTechCommentForm && (
                              <CommentInlineForm
                                requirementId={req.id}
                                parentCommentId={replyToTechComment}
                                commentType="technical"
                                onCancel={() => {
                                  setShowTechCommentForm(false);
                                  setReplyToTechComment(null);
                                }}
                                onCreated={() => {
                                  setShowTechCommentForm(false);
                                  setReplyToTechComment(null);
                                  loadCommentsForTechRequirement(req.id);
                                }}
                              />
                            )}
                          </div>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              )}
              {showTechReqForm && projectId && (
                <TechnicalRequirementInlineForm
                  projectId={projectId}
                  categories={technicalRequirementCategories}
                  businessRequirements={businessRequirements}
                  onCancel={() => setShowTechReqForm(false)}
                  onCreated={() => {
                    setShowTechReqForm(false);
                    handleCreated();
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
