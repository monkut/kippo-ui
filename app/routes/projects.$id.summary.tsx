import { useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useAuth } from "~/lib/auth-context";
import { Layout } from "~/components/layout";
import {
  projectsRetrieve,
  requirementsTechnicalRequirementsList,
  requirementsTechnicalRequirementCategoriesList,
  requirementsBusinessRequirementsList,
  requirementsProblemDefinitionsList,
  requirementsTechnicalRequirementsPartialUpdate,
  assignmentRatesList,
  assignmentRatesCreate,
  assignmentRatesPartialUpdate,
} from "~/lib/api/generated";
import { RoleEnum } from "~/lib/api/generated/models";
import type {
  KippoProject,
  ProjectTechnicalRequirement,
  ProjectTechnicalRequirementCategory,
  ProjectBusinessRequirement,
  ProjectProblemDefinition,
} from "~/lib/api/generated";

export function meta() {
  return [{ title: "プロジェクトサマリー - Kippo要件管理" }];
}

// Chevron icon for expand/collapse
function ChevronIcon({
  isExpanded,
  className = "w-4 h-4",
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

// Category summary type
type CategorySummary = {
  id: number;
  name: string;
  requirements: ProjectTechnicalRequirement[];
  totalDays: number;
  confidenceAdjustedDays: number;
};

// Calculate completion date by adding working days (skipping weekends)
function addWorkingDays(startDate: Date, workingDays: number): Date {
  const result = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < workingDays) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }

  return result;
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default function ProjectSummary() {
  const { id: projectId } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<KippoProject | null>(null);
  const [technicalRequirements, setTechnicalRequirements] = useState<ProjectTechnicalRequirement[]>(
    [],
  );
  const [categories, setCategories] = useState<ProjectTechnicalRequirementCategory[]>([]);
  const [businessRequirements, setBusinessRequirements] = useState<ProjectBusinessRequirement[]>(
    [],
  );
  const [problemDefinitions, setProblemDefinitions] = useState<ProjectProblemDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [listExpanded, setListExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hoveredCategoryId, setHoveredCategoryId] = useState<number | null>(null);
  const [showRateModal, setShowRateModal] = useState(false);
  const [rateInputValue, setRateInputValue] = useState("");
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [rateError, setRateError] = useState("");
  const [workPercentage, setWorkPercentage] = useState(60); // Default 60% of available days
  const [showWorkPercentageModal, setShowWorkPercentageModal] = useState(false);
  const [workPercentageInputValue, setWorkPercentageInputValue] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError("");
    try {
      const [
        projectResponse,
        techReqsResponse,
        categoriesResponse,
        businessReqsResponse,
        problemsResponse,
      ] = await Promise.all([
        projectsRetrieve(projectId),
        requirementsTechnicalRequirementsList({ project: projectId }),
        requirementsTechnicalRequirementCategoriesList({ project: projectId }),
        requirementsBusinessRequirementsList({ project: projectId }),
        requirementsProblemDefinitionsList({ project: projectId }),
      ]);

      if (projectResponse.data) {
        setProject(projectResponse.data);
      }

      if (techReqsResponse.data?.results) {
        const reqs = techReqsResponse.data.results;
        setTechnicalRequirements(reqs);
        // Initialize selected based on include_in_estimate from API (default to true if undefined)
        setSelectedIds(
          new Set(reqs.filter((r) => r.include_in_estimate !== false).map((r) => r.id)),
        );
      }

      if (categoriesResponse.data?.results) {
        setCategories(categoriesResponse.data.results);
      }

      if (businessReqsResponse.data?.results) {
        setBusinessRequirements(businessReqsResponse.data.results);
      }

      if (problemsResponse.data?.results) {
        setProblemDefinitions(problemsResponse.data.results);
      }
    } catch (err) {
      console.error("Failed to load project summary:", err);
      setError("プロジェクトサマリーの読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (user && projectId) {
      loadData();
    }
  }, [user, projectId, loadData]);

  const toggleSelection = async (id: number) => {
    const newValue = !selectedIds.has(id);

    // Optimistically update UI
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newValue) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });

    // Update API
    try {
      await requirementsTechnicalRequirementsPartialUpdate(id, {
        include_in_estimate: newValue,
      });
    } catch (err) {
      // Revert on error
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        if (newValue) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
      console.error("Failed to update include_in_estimate:", err);
    }
  };

  const toggleAllSelection = async () => {
    const selectAll = selectedIds.size !== technicalRequirements.length;
    const newValue = selectAll;

    // Optimistically update UI
    const previousSelectedIds = new Set(selectedIds);
    if (selectAll) {
      setSelectedIds(new Set(technicalRequirements.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }

    // Update all requirements via API
    try {
      await Promise.all(
        technicalRequirements.map((req) =>
          requirementsTechnicalRequirementsPartialUpdate(req.id, {
            include_in_estimate: newValue,
          }),
        ),
      );
    } catch (err) {
      // Revert on error
      setSelectedIds(previousSelectedIds);
      console.error("Failed to update include_in_estimate:", err);
    }
  };

  const openRateModal = () => {
    const currentRate = project?.assignment_rates.find((r) => r.role === "developer");
    setRateInputValue(currentRate?.rate_per_day?.toString() ?? "");
    setRateError("");
    setShowRateModal(true);
  };

  const saveRate = async () => {
    if (!projectId || !project) return;

    const rateValue = Number.parseInt(rateInputValue, 10);
    if (Number.isNaN(rateValue) || rateValue < 0) {
      setRateError("有効な金額を入力してください");
      return;
    }

    setIsSavingRate(true);
    setRateError("");

    try {
      // Get existing assignment rates for this project
      const ratesResponse = await assignmentRatesList({ project: projectId });
      const existingRates = ratesResponse.data?.results || [];
      const developerRateRecord = existingRates.find((r) => r.role === RoleEnum.developer);

      if (developerRateRecord) {
        // Update existing rate
        await assignmentRatesPartialUpdate(developerRateRecord.id, {
          rate_per_day: rateValue,
        });
      } else {
        // Create new rate
        await assignmentRatesCreate({
          project: projectId,
          role: RoleEnum.developer,
          rate_per_day: rateValue,
        });
      }

      // Reload project data to get updated rates
      const projectResponse = await projectsRetrieve(projectId);
      if (projectResponse.data) {
        setProject(projectResponse.data);
      }
      setShowRateModal(false);
    } catch {
      setRateError("保存に失敗しました");
    } finally {
      setIsSavingRate(false);
    }
  };

  const openWorkPercentageModal = () => {
    setWorkPercentageInputValue(workPercentage.toString());
    setShowWorkPercentageModal(true);
  };

  const saveWorkPercentage = () => {
    const value = Number.parseInt(workPercentageInputValue, 10);
    if (!Number.isNaN(value) && value >= 10 && value <= 100) {
      setWorkPercentage(value);
      setShowWorkPercentageModal(false);
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

  // Filter to only selected requirements
  const selectedRequirements = technicalRequirements.filter((req) => selectedIds.has(req.id));

  // Aggregate technical requirements by category (only selected ones)
  const categorySummaries: CategorySummary[] = categories.map((cat) => {
    const reqs = selectedRequirements.filter((req) => req.category === cat.id);
    const totalDays = reqs.reduce((sum, req) => sum + (req.estimate?.days || 0), 0);
    const confidenceAdjustedDays = reqs.reduce(
      (sum, req) => sum + (req.estimate?.confidence_adjusted_days || 0),
      0,
    );
    return {
      id: cat.id,
      name: cat.name,
      requirements: reqs,
      totalDays,
      confidenceAdjustedDays,
    };
  });

  // Filter out categories with no selected requirements
  const nonEmptyCategories = categorySummaries.filter((cat) => cat.requirements.length > 0);

  // Calculate totals from selected requirements
  const totalDays = nonEmptyCategories.reduce((sum, cat) => sum + cat.totalDays, 0);
  const totalConfidenceAdjustedDays = nonEmptyCategories.reduce(
    (sum, cat) => sum + cat.confidenceAdjustedDays,
    0,
  );
  const totalSelectedRequirements = selectedRequirements.length;

  // Get developer daily rate from assignment_rates
  const developerRateObj = project.assignment_rates.find((r) => r.role === "developer");
  const developerRate = developerRateObj?.rate_per_day ?? 0;

  const costMin = totalDays * developerRate;
  const costMax = totalConfidenceAdjustedDays * developerRate;

  // Format cost in Japanese 万 (10,000 yen units)
  const formatCost = (cost: number): string => {
    const inMan = cost / 10000;
    const isWholeNumber = inMan % 1 === 0;
    const formatted = inMan.toLocaleString("ja-JP", {
      minimumFractionDigits: isWholeNumber ? 0 : 1,
      maximumFractionDigits: 1,
    });
    return `${formatted}万`;
  };

  const allSelected = selectedIds.size === technicalRequirements.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < technicalRequirements.length;

  // Calculate coverage - which business requirements are covered by selected technical requirements
  const coveredBusinessReqIds = new Set<number>();
  for (const techReq of selectedRequirements) {
    if (techReq.business_requirements) {
      for (const brId of techReq.business_requirements) {
        coveredBusinessReqIds.add(brId);
      }
    }
  }

  // Find uncovered business requirements
  const uncoveredBusinessReqs = businessRequirements.filter(
    (br) => !coveredBusinessReqIds.has(br.id),
  );

  // Calculate which problem definitions are covered (through their business requirements)
  const coveredProblemIds = new Set<number>();
  for (const br of businessRequirements) {
    if (coveredBusinessReqIds.has(br.id) && br.problems) {
      for (const problemId of br.problems) {
        coveredProblemIds.add(problemId);
      }
    }
  }

  // Find uncovered problem definitions
  const uncoveredProblems = problemDefinitions.filter((p) => !coveredProblemIds.has(p.id));

  // Check if there are any warnings to display
  const hasWarnings = uncoveredProblems.length > 0 || uncoveredBusinessReqs.length > 0;

  return (
    <Layout projectName={project.name} projectId={projectId}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">見積サマリー</h1>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">全体サマリー</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">開始日</p>
              <p className="text-2xl font-bold text-gray-600">{project.start_date || "未設定"}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">技術要件数</p>
              <p className="text-2xl font-bold text-blue-600">
                {totalSelectedRequirements}
                {totalSelectedRequirements !== technicalRequirements.length && (
                  <span className="text-sm font-normal text-gray-400">
                    {" "}
                    / {technicalRequirements.length}
                  </span>
                )}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">見積日数合計</p>
              <p className="text-2xl font-bold text-green-600">{totalDays.toFixed(1)} 日</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">信頼度調整後日数</p>
              <p className="text-2xl font-bold text-purple-600">
                {totalConfidenceAdjustedDays.toFixed(1)} 日
              </p>
            </div>
            <button
              type="button"
              onClick={openRateModal}
              className="p-4 bg-indigo-50 rounded-lg text-center hover:bg-indigo-100 transition-colors cursor-pointer w-full"
            >
              <p className="text-sm text-gray-500">開発者単価</p>
              <p className="text-2xl font-bold text-indigo-600">{formatCost(developerRate)}/日</p>
              <p className="text-xs text-indigo-400 mt-1">クリックして編集</p>
            </button>
            <div className="p-4 bg-orange-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">見積コスト</p>
              <p className="text-xl font-bold text-orange-600">
                {formatCost(costMin)} - {formatCost(costMax)}
              </p>
            </div>
          </div>

          {/* Estimated Completion Dates by Developer Count */}
          {project.start_date && totalConfidenceAdjustedDays > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">開発者数別 完了予定日</h3>
              <button
                type="button"
                onClick={openWorkPercentageModal}
                className="flex items-center gap-2 mb-1 text-sm text-gray-600 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                <span>稼働率:</span>
                <span className="font-medium text-indigo-600 underline underline-offset-2">
                  {workPercentage}%
                </span>
                <span className="text-xs text-gray-400">(クリックして編集)</span>
              </button>
              <p className="text-xs text-gray-500 mb-3">
                ※ 信頼度調整後日数（{totalConfidenceAdjustedDays.toFixed(1)}日）に基づく算出
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((devCount) => {
                  const daysPerDeveloper = totalConfidenceAdjustedDays / devCount;
                  const calendarDays = Math.ceil(daysPerDeveloper / (workPercentage / 100));
                  const startDate = new Date(project.start_date as string);
                  const completionDate = addWorkingDays(startDate, calendarDays);

                  return (
                    <div
                      key={devCount}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <p className="text-sm font-medium text-gray-700 mb-2">開発者 {devCount}名</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">作業日数</span>
                          <span className="font-medium text-gray-900">{calendarDays} 日</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">完了予定日</span>
                          <span className="font-medium text-gray-900">
                            {formatDate(completionDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {hasWarnings && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
              <div className="flex-1">
                <h2 className="text-lg font-medium text-yellow-800 mb-3">カバレッジ警告</h2>

                {uncoveredProblems.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-yellow-700 mb-2">
                      未カバーの課題定義 ({uncoveredProblems.length}件)
                    </h3>
                    <ul className="space-y-1">
                      {uncoveredProblems.map((problem) => (
                        <li key={problem.id} className="flex items-center gap-2 text-sm">
                          <span className="font-mono text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">
                            {problem.display_id}
                          </span>
                          <span className="text-yellow-800">{problem.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {uncoveredBusinessReqs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-yellow-700 mb-2">
                      未カバーのビジネス要件 ({uncoveredBusinessReqs.length}件)
                    </h3>
                    <ul className="space-y-1">
                      {uncoveredBusinessReqs.map((br) => (
                        <li key={br.id} className="flex items-center gap-2 text-sm">
                          <span className="font-mono text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">
                            {br.display_id}
                          </span>
                          <span className="text-yellow-800">{br.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">カテゴリ別サマリー</h2>
          {nonEmptyCategories.length === 0 ? (
            <p className="text-gray-500 text-center py-4">技術要件がありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      カテゴリ
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      要件数
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      見積日数
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      信頼度調整後
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {nonEmptyCategories.map((cat) => (
                    <tr
                      key={cat.id}
                      className={`transition-colors duration-150 ${
                        hoveredCategoryId === cat.id
                          ? "bg-indigo-100 ring-2 ring-indigo-400 ring-inset"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {cat.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {cat.requirements.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {cat.totalDays.toFixed(1)} 日
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {cat.confidenceAdjustedDays.toFixed(1)} 日
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">合計</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {totalSelectedRequirements}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {totalDays.toFixed(1)} 日
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {totalConfidenceAdjustedDays.toFixed(1)} 日
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setListExpanded(!listExpanded)}
              className="flex items-center gap-2 text-lg font-medium text-gray-900 hover:text-gray-700"
            >
              <ChevronIcon isExpanded={listExpanded} />
              <span>技術要件一覧</span>
              {!listExpanded && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({totalSelectedRequirements} / {technicalRequirements.length}件)
                </span>
              )}
            </button>
          </div>
          {technicalRequirements.length === 0 ? (
            <p className="text-gray-500 text-center py-8">技術要件がありません</p>
          ) : listExpanded ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={toggleAllSelection}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                        title={allSelected ? "全て解除" : "全て選択"}
                      />
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      ID
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      カテゴリ
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      タイトル
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      見積日数
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      信頼度
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      調整後日数
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {technicalRequirements.map((req) => {
                    const isSelected = selectedIds.has(req.id);
                    return (
                      <tr
                        key={req.id}
                        className={`hover:bg-gray-50 ${!isSelected ? "opacity-50" : ""}`}
                        onMouseEnter={() => setHoveredCategoryId(req.category)}
                        onMouseLeave={() => setHoveredCategoryId(null)}
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(req.id)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-500">
                          {req.display_id}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {req.category_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{req.title}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                          {(req.estimate?.days || 0).toFixed(1)} 日
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500">
                          {req.estimate ? `${Math.round(req.estimate.confidence * 100)}%` : "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                          {(req.estimate?.confidence_adjusted_days || 0).toFixed(1)} 日
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {/* Rate Edit Modal */}
      {showRateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">開発者単価を編集</h3>

            <div className="mb-4">
              <label htmlFor="rate-input" className="block text-sm font-medium text-gray-700 mb-1">
                日当（円）
              </label>
              <input
                id="rate-input"
                type="number"
                value={rateInputValue}
                onChange={(e) => setRateInputValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="例: 200000"
                min="0"
              />
              {rateInputValue && (
                <p className="mt-1 text-sm text-gray-500">
                  {formatCost(Number.parseInt(rateInputValue, 10) || 0)}/日
                </p>
              )}
            </div>

            {rateError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{rateError}</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRateModal(false)}
                disabled={isSavingRate}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveRate}
                disabled={isSavingRate || !rateInputValue}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSavingRate ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Work Percentage Edit Modal */}
      {showWorkPercentageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">稼働率を編集</h3>

            <div className="mb-4">
              <label
                htmlFor="work-percentage-input"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                稼働率（%）
              </label>
              <input
                id="work-percentage-input"
                type="number"
                value={workPercentageInputValue}
                onChange={(e) => setWorkPercentageInputValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="例: 60"
                min="10"
                max="100"
              />
              <p className="mt-1 text-sm text-gray-500">10% 〜 100% の範囲で入力してください</p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowWorkPercentageModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveWorkPercentage}
                disabled={
                  !workPercentageInputValue ||
                  Number.parseInt(workPercentageInputValue, 10) < 10 ||
                  Number.parseInt(workPercentageInputValue, 10) > 100
                }
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
