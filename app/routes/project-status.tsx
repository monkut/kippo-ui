import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "~/lib/auth-context";
import { projectsList } from "~/lib/api/generated";
import type { KippoProject, KippoProjectProjectstatusDisplay } from "~/lib/api/generated";

export function meta() {
  return [{ title: "プロジェクト状況 - Kippo" }];
}

// Phases to exclude from the project list
const EXCLUDED_PHASES = ["anon-project"];

export default function ProjectStatus() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<KippoProject[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

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
      const response = await projectsList({ is_active: true });
      if (response.data?.results) {
        // Filter projects: display_as_active=True, is_closed=False, phase not in excluded
        const filteredProjects = response.data.results
          .filter(
            (project) =>
              project.display_as_active !== false &&
              project.is_closed !== true &&
              (!project.phase || !EXCLUDED_PHASES.includes(project.phase)),
          )
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
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError("プロジェクトの読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
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
      <ProjectStatusLayout
        user={null}
        isLoading={true}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      >
        <div className="flex justify-center items-center h-full">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </ProjectStatusLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <ProjectStatusLayout
      user={user}
      isLoading={false}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
    >
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
            {currentProject && <ProjectSlide project={currentProject} />}
          </div>
        </div>
      )}
    </ProjectStatusLayout>
  );
}

interface ProjectStatusLayoutProps {
  children: React.ReactNode;
  user: { username: string } | null;
  isLoading: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

const urlPrefix = import.meta.env.VITE_URL_PREFIX || "";

function ProjectStatusLayout({
  children,
  user,
  isLoading,
  menuOpen,
  setMenuOpen,
}: ProjectStatusLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              >
                <span className="sr-only">メニュー</span>
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <title>メニュー</title>
                  {menuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                    />
                  )}
                </svg>
              </button>
            </div>

            <div className="flex-1 flex justify-center items-center">
              <span className="text-xl font-bold text-gray-900">Kippo プロジェクト状況</span>
            </div>

            <div className="flex items-center">
              {isLoading ? (
                <div className="text-sm text-gray-500">読み込み中...</div>
              ) : user ? (
                <span className="text-sm text-gray-600">{user.username}</span>
              ) : null}
            </div>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-gray-200 bg-white">
            <div className="mx-auto px-4 sm:px-6 lg:px-8 py-2">
              <div className="flex flex-col space-y-1">
                <a
                  href={`${urlPrefix}/admin/`}
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  KIPPO
                </a>
                <a
                  href="/projects"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  要件管理
                </a>
                <a
                  href="/project-status"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 rounded-md text-sm font-medium bg-indigo-100 text-indigo-700"
                >
                  プロジェクト状況
                </a>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

interface ProjectSlideProps {
  project: KippoProject;
}

function ProjectSlide({ project }: ProjectSlideProps) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("ja-JP");
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full text-center space-y-6">
        {/* Project Name */}
        <h2 className="text-3xl font-bold">
          <a
            href={`${urlPrefix}/admin/projects/activekippoproject/${project.id}/change/`}
            className="text-gray-900 hover:text-indigo-600 hover:underline transition-colors"
          >
            {project.name}
          </a>
        </h2>

        {/* Dates */}
        <div className="text-lg text-gray-600">
          {formatDate(project.start_date)} - {formatDate(project.target_date)}
        </div>

        {/* Project Status Display */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500">稼働状況</h3>
          <ProjectStatusMeter status={project.projectstatus_display} />
        </div>

        {/* Latest Comment */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500">最新コメント</h3>
          <LatestCommentDisplay comment={project.latest_comment} />
        </div>

        {/* Weekly Effort Users */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500">稼働メンバー</h3>
          {project.weekly_effort_users && project.weekly_effort_users.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {project.weekly_effort_users.map((effortUser) => (
                <span
                  key={effortUser.user_id}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                >
                  {effortUser.display_name} ({effortUser.percentage.toFixed(0)}
                  %)
                </span>
              ))}
            </div>
          ) : (
            <div className="text-gray-400">-</div>
          )}
        </div>

        {/* Confidence indicator */}
        <div className="pt-4 border-t border-gray-200">
          <span className="text-sm text-gray-500">確度: {project.confidence ?? 0}%</span>
        </div>
      </div>
    </div>
  );
}

// Threshold for "exceeding expected" status (same as backend PROJECT_STATUS_REPORT_EXCEEDING_THRESHOLD)
const EXCEEDING_THRESHOLD = 15;

interface ProjectStatusMeterProps {
  status: KippoProjectProjectstatusDisplay;
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
      <div className={`text-2xl font-semibold ${getTextColor()}`}>{current_effort_hours}h</div>

      {/* Difference percentage */}
      {formatDifferencePercentage() && (
        <div className={`text-sm ${getTextColor()}`}>{formatDifferencePercentage()}</div>
      )}

      {/* Meter element - shows timeline progress (expected vs allocated) */}
      <div className="flex justify-center">
        <meter
          min={0}
          max={allocated_effort_hours}
          value={expected_effort_hours}
          className="w-48 h-6"
        />
      </div>

      {/* Legend */}
      <div className="text-xs text-gray-500">
        予定: {Math.round(expected_effort_hours)}h / 予算: {allocated_effort_hours}h
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
