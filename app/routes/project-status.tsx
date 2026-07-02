import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAllMonthlyCostsForProject,
  InfraCostDisplay,
  type ProjectMonthlyCost,
} from "~/components/infra-cost-display";
import { Layout } from "~/components/layout";
import type {
  KippoProject,
  ProjectProgressStatusInline,
  SurveyUserInline,
} from "~/lib/api/generated";
import { projectsList } from "~/lib/api/generated";
import { useAuthGate } from "~/hooks/useAuthGate";

const urlPrefix = import.meta.env.VITE_URL_PREFIX || "";

export function meta() {
  return [{ title: "プロジェクト状況 - Kippo" }];
}

// Non-project rows are excluded server-side via the API's exclude_category filter
// (kippo#36 moved the anon check from phase=="anon-project" to category=="non-project").
const NON_PROJECT_CATEGORY = "non-project";

export default function ProjectStatus() {
  const { user, authLoading } = useAuthGate();
  const [projects, setProjects] = useState<KippoProject[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthlyCostsByProject, setMonthlyCostsByProject] = useState<
    Record<string, ProjectMonthlyCost[]>
  >({});

  useEffect(() => {
    if (user) {
      loadProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadProjects = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await projectsList({
        is_active: true,
        exclude_category: NON_PROJECT_CATEGORY,
      });
      if (response.data?.results) {
        // Filter projects: display_as_active=True, is_closed=False (non-project excluded server-side)
        const filteredProjects = response.data.results
          .filter((project) => project.display_as_active === true && project.is_closed === false)
          // Sort by: -confidence (large to small), target_date (earliest to latest), name
          .sort((a, b) => {
            // First: confidence descending (large to small)
            const confA = a.confidence ?? 0;
            const confB = b.confidence ?? 0;
            if (confB !== confA) return confB - confA;

            // Second: target_date ascending (earliest to latest)
            if (a.target_date && b.target_date) {
              const dateCompare = a.target_date.localeCompare(b.target_date);
              if (dateCompare !== 0) return dateCompare;
            } else if (a.target_date) {
              return -1;
            } else if (b.target_date) {
              return 1;
            }

            // Third: name ascending
            return a.name.localeCompare(b.name);
          });
        setProjects(filteredProjects);
        loadMonthlyCosts(filteredProjects);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError("プロジェクトの読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMonthlyCosts = async (projectList: KippoProject[]) => {
    const results = await Promise.all(
      projectList.map(
        async (project) => [project.id, await fetchAllMonthlyCostsForProject(project.id)] as const,
      ),
    );
    setMonthlyCostsByProject(Object.fromEntries(results));
  };

  const currentProject = useMemo(() => {
    if (projects.length === 0) return null;
    return projects[currentIndex];
  }, [projects, currentIndex]);

  const previousProject = useMemo(() => {
    if (currentIndex <= 0) return null;
    return projects[currentIndex - 1];
  }, [projects, currentIndex]);

  const nextProject = useMemo(() => {
    if (currentIndex >= projects.length - 1) return null;
    return projects[currentIndex + 1];
  }, [projects, currentIndex]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < projects.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, projects.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrevious, goToNext]);

  if (authLoading) {
    return (
      <Layout title="Kippo プロジェクト状況" fullHeight>
        <div className="flex-1 flex justify-center items-center">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout title="Kippo プロジェクト状況" fullHeight>
      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-full">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex justify-center items-center h-full">
          <p className="text-gray-500">表示するプロジェクトがありません</p>
        </div>
      ) : (
        <div className="flex h-full relative">
          {/* Collapsible Project List Sidebar */}
          <ProjectListSidebar
            projects={projects}
            currentIndex={currentIndex}
            onSelectProject={setCurrentIndex}
          />

          {/* Main Content */}
          <div className="flex flex-col flex-1 h-full">
            {/* Navigation */}
            <div className="flex justify-between items-center px-4 py-2">
              {/* Previous */}
              <div className="w-1/3">
                {previousProject && (
                  <button
                    type="button"
                    onClick={goToPrevious}
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                    >
                      <title>前へ</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 19.5L8.25 12l7.5-7.5"
                      />
                    </svg>
                    <span className="text-sm truncate max-w-[200px]">{previousProject.name}</span>
                  </button>
                )}
              </div>

              {/* Current position */}
              <div className="text-sm text-gray-500">
                {currentIndex + 1} / {projects.length}
              </div>

              {/* Next */}
              <div className="w-1/3 flex justify-end">
                {nextProject && (
                  <button
                    type="button"
                    onClick={goToNext}
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    <span className="text-sm truncate max-w-[200px]">{nextProject.name}</span>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                    >
                      <title>次へ</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Project Info Slide */}
            {currentProject && (
              <ProjectSlide
                project={currentProject}
                monthlyCosts={monthlyCostsByProject[currentProject.id]}
              />
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

// Surveys are only assigned to effort users with >3% effort, so survey_users
// may not contain every effort user. Three render states keep the row from
// going blank when no survey is assigned (issue #33).
export function SurveyStatusIcon({ surveyUser }: { surveyUser: SurveyUserInline | undefined }) {
  if (surveyUser === undefined) {
    return (
      <svg
        className="w-4 h-4 text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
      >
        <title>user not considered: &lt;= 3% effort in project</title>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      </svg>
    );
  }
  if (surveyUser.survey_completed) {
    return (
      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
        <title>アンケート完了</title>
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg
      className="w-4 h-4 text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
    >
      <title>アンケート未完了</title>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

interface ProjectSlideProps {
  project: KippoProject;
  monthlyCosts: ProjectMonthlyCost[] | undefined;
}

function ProjectSlide({ project, monthlyCosts }: ProjectSlideProps) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("ja-JP");
  };

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
        </div>

        {/* Dates */}
        <div className="text-lg text-gray-600">
          {formatDate(project.start_date)} - {formatDate(project.target_date)}
        </div>

        {/* Project Status Display */}
        <div className="space-y-2">
          <ProjectStatusMeter status={project.projectstatus_display} />
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
        </div>
      </div>
    </div>
  );
}

// Threshold for "exceeding expected" status (same as backend PROJECT_STATUS_REPORT_EXCEEDING_THRESHOLD)
const EXCEEDING_THRESHOLD = 15;

interface ProjectStatusMeterProps {
  status: ProjectProgressStatusInline | null;
}

function ProjectStatusMeter({ status }: ProjectStatusMeterProps) {
  if (!status) {
    return <div className="text-gray-400">-</div>;
  }

  const {
    current_effort_hours,
    expected_effort_hours,
    allocated_effort_hours,
    difference_percentage,
  } = status;

  // If no expected hours, just show the current hours
  if (!expected_effort_hours || !allocated_effort_hours) {
    if (current_effort_hours) {
      return <div className="text-2xl font-semibold text-gray-600">{current_effort_hours}h</div>;
    }
    return <div className="text-gray-400">-</div>;
  }

  // Determine color based on difference percentage
  const getTextColor = () => {
    if (difference_percentage === null || difference_percentage === undefined) {
      return "text-gray-600";
    }
    if (difference_percentage > EXCEEDING_THRESHOLD) return "text-red-600";
    if (difference_percentage > 0) return "text-yellow-600";
    return "text-green-600";
  };

  // Get background color for meter (matches text color)
  const getMeterColor = () => {
    if (difference_percentage === null || difference_percentage === undefined) {
      return "bg-gray-400";
    }
    if (difference_percentage > EXCEEDING_THRESHOLD) return "bg-red-500";
    if (difference_percentage > 0) return "bg-yellow-500";
    return "bg-green-500";
  };

  const formatDifferencePercentage = () => {
    if (difference_percentage === null || difference_percentage === undefined) {
      return null;
    }
    const sign = difference_percentage > 0 ? "+" : "";
    return `${sign}${Math.round(difference_percentage)}%`;
  };

  return (
    <div className="space-y-2">
      {/* Hours display */}
      <div className={`text-2xl font-semibold ${getTextColor()}`}>{current_effort_hours ?? 0}h</div>

      {/* Difference percentage */}
      {formatDifferencePercentage() && (
        <div className={`text-sm ${getTextColor()}`}>{formatDifferencePercentage()}</div>
      )}

      {/* Progress bar - shows timeline progress (expected vs allocated) */}
      <div className="flex justify-center">
        <div className="w-48 h-6 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getMeterColor()} transition-all duration-300`}
            style={{
              width: `${Math.min((expected_effort_hours / allocated_effort_hours) * 100, 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="text-xs text-gray-500">
        <span title="予定: 現在日までに消化されているべき工数（線形進捗に基づく）">
          {Math.round(expected_effort_hours)}h
        </span>
        {" / "}
        <span title="予算: プロジェクト全体の予算工数（割当人日 × 1日の稼働時間）">
          {allocated_effort_hours}h
        </span>
      </div>
    </div>
  );
}

interface ProjectListSidebarProps {
  projects: KippoProject[];
  currentIndex: number;
  onSelectProject: (index: number) => void;
}

function ProjectListSidebar({ projects, currentIndex, onSelectProject }: ProjectListSidebarProps) {
  return (
    <div className="group absolute left-0 top-0 h-full z-10">
      {/* Collapsed state - thin bar with icon */}
      <div className="w-8 h-full bg-gray-100 border-r border-gray-200 flex items-center justify-center group-hover:hidden cursor-pointer">
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
        >
          <title>プロジェクト一覧</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
          />
        </svg>
      </div>

      {/* Expanded state - full project list */}
      <div className="hidden group-hover:block w-64 h-full bg-white border-r border-gray-200 shadow-lg overflow-hidden">
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700">プロジェクト一覧</h3>
        </div>
        <div className="overflow-y-auto h-[calc(100%-48px)]">
          <ul className="py-1">
            {projects.map((project, index) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => onSelectProject(index)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    index === currentIndex
                      ? "bg-indigo-100 text-indigo-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="block truncate">{project.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface LatestCommentDisplayProps {
  comment: {
    comment: string;
    created_by_display_name: string | null;
    created_by_username: string | null;
    created_datetime: string;
  } | null;
}

function LatestCommentDisplay({ comment }: LatestCommentDisplayProps) {
  if (!comment) {
    return <div className="text-gray-400">-</div>;
  }

  return (
    <div className="bg-gray-50 rounded-md p-4 text-left">
      <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
        <span className="font-medium text-gray-700">
          {comment.created_by_display_name || comment.created_by_username || "不明"}
        </span>
        <span>•</span>
        <span>{new Date(comment.created_datetime).toLocaleDateString("ja-JP")}</span>
      </div>
      <div className="text-gray-700 whitespace-pre-wrap">{comment.comment}</div>
    </div>
  );
}
