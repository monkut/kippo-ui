import { useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useAuth } from "~/lib/auth-context";
import { Layout } from "~/components/layout";
import { MultiSelect } from "~/components/multi-select";
import {
  projectsRetrieve,
  requirementsAssumptionsCreate,
  requirementsAssumptionsPartialUpdate,
  requirementsAssumptionsDestroy,
  requirementsAssumptionsCategoriesRetrieve,
  requirementsAssumptionsList,
  requirementsProblemDefinitionsCreate,
  requirementsProblemDefinitionsPartialUpdate,
  requirementsProblemDefinitionsDestroy,
  requirementsProblemDefinitionsList,
  requirementsBusinessRequirementsCreate,
  requirementsBusinessRequirementsPartialUpdate,
  requirementsBusinessRequirementsDestroy,
  requirementsBusinessRequirementsRetrieve,
  requirementsBusinessRequirementsList,
  requirementsBusinessRequirementCategoriesList,
  requirementsBusinessRequirementCategoriesCreate,
  requirementsBusinessRequirementCommentsList,
  requirementsBusinessRequirementCommentsCreate,
  requirementsTechnicalRequirementsCreate,
  requirementsTechnicalRequirementsDestroy,
  requirementsTechnicalRequirementsPartialUpdate,
  requirementsTechnicalRequirementsList,
  requirementsTechnicalRequirementCategoriesList,
  requirementsTechnicalRequirementCategoriesCreate,
  requirementsEstimatesCreate,
  requirementsEstimatesPartialUpdate,
} from "~/lib/api/generated";
import type {
  KippoProject,
  ProjectBusinessRequirementCategory,
  ProjectProblemDefinition,
  ProjectTechnicalRequirementCategory,
  ProjectAssumption,
  ProjectBusinessRequirement,
  ProjectTechnicalRequirement,
  CategoryEnum,
} from "~/lib/api/generated";

// Assumption category type for enum-based categories from API
type AssumptionCategoryChoice = {
  value: string;
  label: string;
};

export function meta() {
  return [{ title: "プロジェクト詳細 - Kippo要件管理" }];
}

function EditIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

function DeleteIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronIcon({
  isExpanded,
  className = "w-5 h-5",
}: {
  isExpanded: boolean;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={`${className} transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function CommentIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
      />
    </svg>
  );
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

type ProblemType = {
  id: number;
  display_id: string;
  title: string;
  details?: string;
};

// Local types matching API models - using API types directly where possible
type AssumptionType = ProjectAssumption;

type BusinessRequirementType = ProjectBusinessRequirement & {
  category_name?: string;
  problems_data?: Array<{ id: number; display_id: string; title: string }>;
};

type TechnicalRequirementType = ProjectTechnicalRequirement;

type CommentData = {
  id: number;
  comment: string;
  created_by_name: string;
  created_datetime: string;
  replies?: CommentData[];
};

export default function ProjectDetails() {
  const { id: projectId } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
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

  const [problemsExpanded, setProblemsExpanded] = useState(true);
  const [problemsCompact, setProblemsCompact] = useState(false);
  const [assumptionsExpanded, setAssumptionsExpanded] = useState(true);
  const [assumptionsCompact, setAssumptionsCompact] = useState(false);
  const [businessReqsExpanded, setBusinessReqsExpanded] = useState(true);
  const [businessReqsCompact, setBusinessReqsCompact] = useState(false);
  const [techReqsExpanded, setTechReqsExpanded] = useState(true);
  const [techReqsCompact, setTechReqsCompact] = useState(false);

  const [expandedComments, setExpandedComments] = useState<number | null>(null);
  const [businessReqComments, setBusinessReqComments] = useState<CommentData[]>([]);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [replyToComment, setReplyToComment] = useState<number | null>(null);

  const [hoveredBusinessReqId, setHoveredBusinessReqId] = useState<number | null>(null);
  const [hoveredTechReqId, setHoveredTechReqId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

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
        {/* Assumptions Section */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <button
              type="button"
              onClick={() => setAssumptionsExpanded(!assumptionsExpanded)}
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
                  onClick={() => setAssumptionsCompact(!assumptionsCompact)}
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
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 justify-items-start">
                  {assumptions?.map((assumption) => (
                    <div key={assumption.id} className="flex items-center gap-2 py-1">
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                        {assumption.display_id}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${getAssumptionCategoryColor(assumption.category)}`}
                      >
                        {assumption.category_display}
                      </span>
                      <span className="text-sm text-gray-900 truncate">{assumption.title}</span>
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
                            <span className="text-sm text-gray-900">{assumption.title}</span>
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
                          <p className="mt-1 text-sm text-gray-500 ml-16">{assumption.details}</p>
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
              onClick={() => setProblemsExpanded(!problemsExpanded)}
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
                  onClick={() => setProblemsCompact(!problemsCompact)}
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
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 justify-items-start">
                  {problems?.map((problem) => (
                    <div
                      key={problem.id}
                      className={`flex items-center gap-2 py-1 px-1 -mx-1 rounded transition-colors ${
                        highlightedProblemIds.has(problem.id)
                          ? "bg-indigo-100 ring-2 ring-indigo-400"
                          : ""
                      }`}
                    >
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                        {problem.display_id}
                      </span>
                      <span className="text-sm text-gray-900 truncate">{problem.title}</span>
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
                            <span className="text-sm text-gray-900">{problem.title}</span>
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
                          <p className="mt-1 text-sm text-gray-500 ml-16">{problem.details}</p>
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
                onClick={() => setBusinessReqsExpanded(!businessReqsExpanded)}
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
                  onClick={() => setBusinessReqsCompact(!businessReqsCompact)}
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1 justify-items-start">
                  {businessRequirements?.map((req) => (
                    <Link
                      key={req.id}
                      to={`/projects/${projectId}/requirements/${req.id}`}
                      className={`flex items-center gap-2 py-1 rounded px-1 -mx-1 transition-colors ${
                        highlightedBusinessReqIds.has(req.id)
                          ? "bg-indigo-100 ring-2 ring-indigo-400"
                          : "hover:bg-gray-50"
                      }`}
                      title="開発要件を定義"
                      onMouseEnter={() => setHoveredBusinessReqId(req.id)}
                      onMouseLeave={() => setHoveredBusinessReqId(null)}
                    >
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                        {req.display_id}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${getBusinessReqCategoryColor(req.category)}`}
                      >
                        {getBusinessReqCategoryName(req.category, businessRequirementCategories)}
                      </span>
                      <span className="text-sm text-gray-900 truncate">{req.title}</span>
                      {req.problems && req.problems.length > 0 && (
                        <span className="text-xs text-gray-500">
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
                                <span className="text-sm text-gray-900">{req.title}</span>
                              </div>
                              <p className="mt-1 text-xs text-gray-500 ml-16">
                                課題: {getProblemDisplayIds(req.problems, problemDefinitions)}
                              </p>
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
                onClick={() => setTechReqsExpanded(!techReqsExpanded)}
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
                  onClick={() => setTechReqsCompact(!techReqsCompact)}
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1 justify-items-start">
                  {technicalRequirements?.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center gap-2 py-1 px-1 -mx-1 w-full rounded transition-colors cursor-default"
                      onMouseEnter={() => setHoveredTechReqId(req.id)}
                      onMouseLeave={() => setHoveredTechReqId(null)}
                    >
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                        {req.display_id}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${getBusinessReqCategoryColor(req.category)}`}
                      >
                        {req.category_name}
                      </span>
                      <span className="text-sm text-gray-900 truncate">{req.title}</span>
                      {req.estimate && (
                        <span className="text-xs text-gray-500 ml-auto">{req.estimate.days}日</span>
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
                              <span className="text-sm text-gray-900">{req.title}</span>
                              {req.estimate && (
                                <span className="text-sm font-medium text-gray-600">
                                  {req.estimate.days}日 ({Math.round(req.estimate.confidence * 100)}
                                  %)
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-gray-500 ml-16">
                              ビジネス要件:{" "}
                              {req.business_requirements && req.business_requirements.length > 0
                                ? businessRequirements
                                    ?.filter((b) => req.business_requirements?.includes(b.id))
                                    .map((b) => b.display_id)
                                    .join(", ") || "-"
                                : "-"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
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

// ============ Create Forms ============

interface ProblemInlineFormProps {
  projectId: string;
  onCancel: () => void;
  onCreated: () => void;
}

type ProblemEntry = {
  id: number;
  title: string;
  details: string;
};

function ProblemInlineForm({ projectId, onCancel, onCreated }: ProblemInlineFormProps) {
  const [entries, setEntries] = useState<ProblemEntry[]>([{ id: 1, title: "", details: "" }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addEntry = () => {
    setEntries([...entries, { id: Date.now(), title: "", details: "" }]);
  };

  const removeEntry = (id: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((e) => e.id !== id));
    }
  };

  const updateEntry = (id: number, field: "title" | "details", value: string) => {
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const hasValidEntry = entries.some((e) => e.title.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validEntries = entries.filter((entry) => entry.title.trim());
    if (validEntries.length === 0) return;

    setIsSubmitting(true);
    setError("");
    try {
      for (const entry of validEntries) {
        await requirementsProblemDefinitionsCreate({
          project: projectId,
          title: entry.title.trim(),
          details: entry.details.trim() || undefined,
        });
      }
      onCreated();
    } catch (err) {
      console.error("Failed to create problem:", err);
      setError("課題定義の作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-medium text-gray-900 mb-3">新規課題定義</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-start"
          >
            <div>
              <label
                htmlFor={`problem-title-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                タイトル
              </label>
              <input
                type="text"
                id={`problem-title-${entry.id}`}
                value={entry.title}
                onChange={(e) => updateEntry(entry.id, "title", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                placeholder="課題のタイトル"
                disabled={isSubmitting}
                autoFocus={index === 0}
              />
            </div>
            <div>
              <label
                htmlFor={`problem-details-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                詳細（任意）
              </label>
              <textarea
                id={`problem-details-${entry.id}`}
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
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
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
          disabled={isSubmitting}
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
            disabled={isSubmitting || !hasValidEntry}
          >
            {isSubmitting
              ? "作成中..."
              : `作成${entries.filter((e) => e.title.trim()).length > 1 ? ` (${entries.filter((e) => e.title.trim()).length}件)` : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
}

interface AssumptionInlineFormProps {
  projectId: string;
  categories: AssumptionCategoryChoice[];
  onCancel: () => void;
  onCreated: () => void;
}

type AssumptionEntry = {
  id: number;
  title: string;
  details: string;
  categoryValue: string;
  isInternal: boolean;
};

function AssumptionInlineForm({
  projectId,
  categories,
  onCancel,
  onCreated,
}: AssumptionInlineFormProps) {
  const defaultCategoryValue = categories.length > 0 ? categories[0].value : "";
  const [entries, setEntries] = useState<AssumptionEntry[]>([
    { id: 1, title: "", details: "", categoryValue: defaultCategoryValue, isInternal: false },
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
        categoryValue: defaultCategoryValue,
        isInternal: false,
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
    field: keyof AssumptionEntry,
    value: string | number | boolean,
  ) => {
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const hasValidEntry = entries.some((e) => e.title.trim() && e.categoryValue);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validEntries = entries.filter((entry) => entry.title.trim() && entry.categoryValue);
    if (validEntries.length === 0) return;

    setIsSubmitting(true);
    setError("");
    try {
      for (const entry of validEntries) {
        await requirementsAssumptionsCreate({
          project: projectId,
          title: entry.title.trim(),
          details: entry.details.trim() || undefined,
          category: entry.categoryValue as CategoryEnum,
          is_internal: entry.isInternal,
        });
      }
      onCreated();
    } catch (err) {
      console.error("Failed to create assumption:", err);
      setError("前提条件の作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-medium text-gray-900 mb-3">新規前提条件</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className="grid grid-cols-1 md:grid-cols-[1fr_8rem_2fr_auto_auto] gap-3 items-start"
          >
            <div>
              <label
                htmlFor={`assumption-title-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                タイトル
              </label>
              <input
                type="text"
                id={`assumption-title-${entry.id}`}
                value={entry.title}
                onChange={(e) => updateEntry(entry.id, "title", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                placeholder="前提条件のタイトル"
                disabled={isSubmitting}
                autoFocus={index === 0}
              />
            </div>
            <div>
              <label
                htmlFor={`assumption-category-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                カテゴリ
              </label>
              <select
                id={`assumption-category-${entry.id}`}
                value={entry.categoryValue}
                onChange={(e) => updateEntry(entry.id, "categoryValue", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                disabled={isSubmitting}
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor={`assumption-details-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                詳細（任意）
              </label>
              <textarea
                id={`assumption-details-${entry.id}`}
                value={entry.details}
                onChange={(e) => updateEntry(entry.id, "details", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 resize-y"
                placeholder="詳細"
                disabled={isSubmitting}
                rows={2}
              />
            </div>
            <div className="flex items-center mt-6">
              <input
                type="checkbox"
                id={`assumption-internal-${entry.id}`}
                checked={entry.isInternal}
                onChange={(e) => updateEntry(entry.id, "isInternal", e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                disabled={isSubmitting}
              />
              <label
                htmlFor={`assumption-internal-${entry.id}`}
                className="ml-2 text-xs font-medium text-gray-700 whitespace-nowrap"
              >
                社内のみ
              </label>
            </div>
            <div className="flex items-center mt-6">
              {entries.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
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
          </div>
        ))}
        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
          disabled={isSubmitting}
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
            disabled={isSubmitting || !hasValidEntry}
          >
            {isSubmitting
              ? "作成中..."
              : `作成${entries.filter((e) => e.title.trim()).length > 1 ? ` (${entries.filter((e) => e.title.trim()).length}件)` : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
}

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

function BusinessRequirementInlineForm({
  projectId,
  categories,
  problems,
  onCancel,
  onCreated,
}: BusinessRequirementInlineFormProps) {
  const defaultCategoryId = categories.length > 0 ? categories[0].id : "new";
  const [entries, setEntries] = useState<BusinessRequirementEntry[]>([
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

  const addEntry = () => {
    setEntries([
      ...entries,
      {
        id: Date.now(),
        title: "",
        details: "",
        problemIds: [],
        categoryId: defaultCategoryId,
        newCategoryName: "",
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
    field: keyof BusinessRequirementEntry,
    value: string | number | "new",
  ) => {
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

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
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-medium text-gray-900 mb-3">新規ビジネス要件</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}
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
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
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
          disabled={isSubmitting || problems.length === 0}
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
            disabled={isSubmitting || !hasValidEntry || problems.length === 0}
          >
            {isSubmitting
              ? "作成中..."
              : `作成${entries.filter((e) => e.title.trim() && e.problemIds.length > 0).length > 1 ? ` (${entries.filter((e) => e.title.trim() && e.problemIds.length > 0).length}件)` : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
}

interface TechnicalRequirementInlineFormProps {
  projectId: string;
  categories: ProjectTechnicalRequirementCategory[];
  businessRequirements: BusinessRequirementType[];
  onCancel: () => void;
  onCreated: () => void;
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

function TechnicalRequirementInlineForm({
  projectId,
  categories,
  businessRequirements,
  onCancel,
  onCreated,
}: TechnicalRequirementInlineFormProps) {
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

  const hasValidEntry = entries.some(
    (e) => e.title.trim() && e.businessReqIds.length > 0 && e.estimateDays,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validEntries = entries.filter(
      (entry) => entry.title.trim() && entry.businessReqIds.length > 0 && entry.estimateDays,
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
          business_requirements: entry.businessReqIds,
          title: entry.title.trim(),
          details: entry.details.trim() || undefined,
          category: finalCategoryId as number,
        });

        if (techReqResponse.data) {
          await requirementsEstimatesCreate({
            requirement: techReqResponse.data.id,
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

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-medium text-gray-900 mb-3">新規技術要件</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}
        {businessRequirements.length === 0 && (
          <div className="rounded-md bg-yellow-50 p-3">
            <div className="text-sm text-yellow-800">先にビジネス要件を作成してください</div>
          </div>
        )}
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className="grid grid-cols-1 md:grid-cols-[1fr_1fr_8rem_5rem_5rem_1fr_auto] gap-3 items-start"
          >
            <div>
              <MultiSelect
                id={`tech-req-business-${entry.id}`}
                label="ビジネス要件"
                options={businessRequirements.map((b) => ({
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
                disabled={isSubmitting || businessRequirements.length === 0}
                placeholder="ビジネス要件を選択..."
              />
            </div>
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
          disabled={isSubmitting || businessRequirements.length === 0}
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
            disabled={isSubmitting || !hasValidEntry || businessRequirements.length === 0}
          >
            {isSubmitting
              ? "作成中..."
              : `作成${entries.filter((e) => e.title.trim() && e.businessReqIds.length > 0 && e.estimateDays).length > 1 ? ` (${entries.filter((e) => e.title.trim() && e.businessReqIds.length > 0 && e.estimateDays).length}件)` : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============ Edit Forms ============

interface ProblemEditFormProps {
  problem: ProblemType;
  onCancel: () => void;
  onUpdated: () => void;
}

function ProblemEditForm({ problem, onCancel, onUpdated }: ProblemEditFormProps) {
  const [title, setTitle] = useState(problem.title);
  const [details, setDetails] = useState(problem.details || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError("");
    try {
      await requirementsProblemDefinitionsPartialUpdate(problem.id, {
        title: title.trim(),
        details: details.trim() || undefined,
      });
      onUpdated();
    } catch (err) {
      console.error("Failed to update problem:", err);
      setError("課題定義の更新に失敗しました");
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
          {problem.display_id}
        </span>
        <span className="text-xs text-gray-500">を編集中</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`edit-problem-title-${problem.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            タイトル
          </label>
          <input
            type="text"
            id={`edit-problem-title-${problem.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        <div className="md:col-span-2">
          <label
            htmlFor={`edit-problem-details-${problem.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            詳細（任意）
          </label>
          <textarea
            id={`edit-problem-details-${problem.id}`}
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
          disabled={isSubmitting || !title.trim()}
        >
          {isSubmitting ? "更新中..." : "更新"}
        </button>
      </div>
    </form>
  );
}

interface AssumptionEditFormProps {
  assumption: AssumptionType;
  categories: AssumptionCategoryChoice[];
  onCancel: () => void;
  onUpdated: () => void;
}

function AssumptionEditForm({
  assumption,
  categories,
  onCancel,
  onUpdated,
}: AssumptionEditFormProps) {
  const [title, setTitle] = useState(assumption.title);
  const [details, setDetails] = useState(assumption.details || "");
  const [categoryValue, setCategoryValue] = useState<string>(assumption.category || "assumption");
  const [isInternal, setIsInternal] = useState(assumption.is_internal ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError("");
    try {
      await requirementsAssumptionsPartialUpdate(assumption.id, {
        title: title.trim(),
        details: details.trim() || undefined,
        category: categoryValue as CategoryEnum,
        is_internal: isInternal,
      });
      onUpdated();
    } catch (err) {
      console.error("Failed to update assumption:", err);
      setError("前提条件の更新に失敗しました");
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
          {assumption.display_id}
        </span>
        <span className="text-xs text-gray-500">を編集中</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`edit-assumption-category-${assumption.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            カテゴリ
          </label>
          <select
            id={`edit-assumption-category-${assumption.id}`}
            value={categoryValue}
            onChange={(e) => setCategoryValue(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
            disabled={isSubmitting}
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`edit-assumption-title-${assumption.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            タイトル
          </label>
          <input
            type="text"
            id={`edit-assumption-title-${assumption.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        <div className="md:col-span-2">
          <label
            htmlFor={`edit-assumption-details-${assumption.id}`}
            className="block text-xs font-medium text-gray-700 mb-1"
          >
            詳細（任意）
          </label>
          <textarea
            id={`edit-assumption-details-${assumption.id}`}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 resize-y"
            disabled={isSubmitting}
            rows={2}
          />
        </div>
        <div className="md:col-span-2 flex items-center">
          <input
            type="checkbox"
            id={`edit-assumption-internal-${assumption.id}`}
            checked={isInternal}
            onChange={(e) => setIsInternal(e.target.checked)}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            disabled={isSubmitting}
          />
          <label
            htmlFor={`edit-assumption-internal-${assumption.id}`}
            className="ml-2 text-xs font-medium text-gray-700"
          >
            社内のみ
          </label>
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
          disabled={isSubmitting || !title.trim()}
        >
          {isSubmitting ? "更新中..." : "更新"}
        </button>
      </div>
    </form>
  );
}

interface BusinessRequirementEditFormProps {
  requirement: BusinessRequirementType;
  categories: ProjectBusinessRequirementCategory[];
  problems: ProjectProblemDefinition[];
  onCancel: () => void;
  onUpdated: () => void;
}

function BusinessRequirementEditForm({
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
          disabled={isSubmitting || !title.trim() || problemIds.length === 0}
        >
          {isSubmitting ? "更新中..." : "更新"}
        </button>
      </div>
    </form>
  );
}

interface TechnicalRequirementEditFormProps {
  requirement: TechnicalRequirementType;
  categories: ProjectTechnicalRequirementCategory[];
  businessRequirements: BusinessRequirementType[];
  onCancel: () => void;
  onUpdated: () => void;
}

function TechnicalRequirementEditForm({
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
        await requirementsEstimatesPartialUpdate(requirement.estimate.id, {
          days: Number.parseFloat(estimateDays),
          confidence: Number.parseInt(confidence, 10) / 100,
        });
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

// ============ Comment Components ============

interface CommentListProps {
  comments: CommentData[];
  onReply: (commentId: number) => void;
  depth?: number;
}

function CommentList({ comments, onReply, depth = 0 }: CommentListProps) {
  return (
    <ul className={`space-y-3 ${depth > 0 ? "ml-4 border-l border-gray-100 pl-3" : ""}`}>
      {comments.map((comment) => (
        <li key={comment.id}>
          <div className="text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{comment.created_by_name}</span>
              <span className="text-gray-400">
                {new Date(comment.created_datetime).toLocaleString("ja-JP")}
              </span>
            </div>
            <p className="mt-1 text-gray-700">{comment.comment}</p>
            <button
              type="button"
              onClick={() => onReply(comment.id)}
              className="mt-1 text-indigo-600 hover:text-indigo-500"
            >
              返信
            </button>
          </div>
          {comment.replies && comment.replies.length > 0 && (
            <CommentList comments={comment.replies} onReply={onReply} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

interface CommentInlineFormProps {
  requirementId: number;
  parentCommentId: number | null;
  onCancel: () => void;
  onCreated: () => void;
}

function CommentInlineForm({
  requirementId,
  parentCommentId,
  onCancel,
  onCreated,
}: CommentInlineFormProps) {
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setIsSubmitting(true);
    setError("");
    try {
      await requirementsBusinessRequirementCommentsCreate({
        requirement: requirementId,
        comment: comment.trim(),
        parent_comment: parentCommentId,
      });
      onCreated();
    } catch (err) {
      console.error("Failed to create comment:", err);
      setError("コメントの作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-2">
      <form onSubmit={handleSubmit} className="space-y-2">
        {error && (
          <div className="rounded-md bg-red-50 p-2">
            <div className="text-xs text-red-800">{error}</div>
          </div>
        )}
        <div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs border px-2 py-1"
            placeholder={parentCommentId ? "返信を入力..." : "コメントを入力..."}
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            disabled={isSubmitting}
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="px-2 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
            disabled={isSubmitting || !comment.trim()}
          >
            {isSubmitting ? "送信中..." : "送信"}
          </button>
        </div>
      </form>
    </div>
  );
}
