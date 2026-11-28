import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchMonthlyCostsByProject,
  type ProjectMonthlyCost,
} from "~/components/infra-cost-display";
import { Layout } from "~/components/layout";
import {
  LISTENER_CLOSE_CONFIRM,
  ListenerSyncIndicator,
  ProjectListSidebar,
  ProjectSlide,
} from "~/components/project-status";
import type { KippoProject } from "~/lib/api/generated";
import { fetchActiveProjects } from "~/lib/active-projects";
import { organizationsList } from "~/lib/api/generated/organizations/organizations";
import { formatProjectWithCustomer } from "~/lib/format-project";
import { useAuthGate } from "~/hooks/useAuthGate";
import { useListenerFocusSync } from "~/hooks/useListenerFocusSync";
import {
  closeListenerSession,
  extractListenerConfigs,
  type ListenerConfig,
  readFocusSyncEnabled,
  writeFocusSyncEnabled,
} from "~/lib/listener";

export function meta() {
  return [{ title: "プロジェクト状況 - Kippo" }];
}

export default function ProjectStatus() {
  const { user, authLoading } = useAuthGate();
  const [projects, setProjects] = useState<KippoProject[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthlyCostsByProject, setMonthlyCostsByProject] = useState<
    Record<string, ProjectMonthlyCost[]>
  >({});
  // organization id → listener config (kippo#66); empty when no organization has a listener.
  const [listenerConfigs, setListenerConfigs] = useState<Record<string, ListenerConfig>>({});
  const [focusSyncEnabled, setFocusSyncEnabled] = useState(readFocusSyncEnabled);

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
      // Rows, filters and ordering all mirror ActiveKippoProjectAdmin — see active-projects.ts.
      const filteredProjects = await fetchActiveProjects();
      setProjects(filteredProjects);
      loadMonthlyCosts();
      loadListenerConfigs();
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError("プロジェクトの読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const loadListenerConfigs = async () => {
    try {
      const response = await organizationsList();
      setListenerConfigs(extractListenerConfigs(response.data));
    } catch (err) {
      // The slideshow works without the listener; only focus sync is lost.
      console.error("Failed to load organizations for listener focus sync:", err);
    }
  };

  const loadMonthlyCosts = async () => {
    setMonthlyCostsByProject(await fetchMonthlyCostsByProject());
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

  // Listener focus sync (monkut/kippo-ui#139). Hook stays above the early returns.
  const listenerConfig = currentProject
    ? (listenerConfigs[currentProject.organization] ?? null)
    : null;
  const [listenerState, setListenerState] = useListenerFocusSync(
    listenerConfig,
    currentProject?.id ?? null,
    focusSyncEnabled,
  );
  const toggleFocusSync = useCallback(() => {
    setFocusSyncEnabled((enabled) => {
      writeFocusSyncEnabled(!enabled);
      return !enabled;
    });
  }, []);
  const handleCloseListenerSession = useCallback(async () => {
    if (!listenerConfig) return;
    if (!window.confirm(LISTENER_CLOSE_CONFIRM)) return;
    const result = await closeListenerSession(listenerConfig);
    setListenerState(result === "error" ? "error" : "no-session");
  }, [listenerConfig, setListenerState]);

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
                    <span className="text-sm truncate max-w-[200px]">
                      {formatProjectWithCustomer(
                        previousProject.name,
                        previousProject.customer_name,
                      )}
                    </span>
                  </button>
                )}
              </div>

              {/* Current position + listener focus sync indicator */}
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>
                  {currentIndex + 1} / {projects.length}
                </span>
                {listenerConfig && (
                  <ListenerSyncIndicator
                    state={listenerState}
                    enabled={focusSyncEnabled}
                    onToggle={toggleFocusSync}
                    onCloseSession={handleCloseListenerSession}
                  />
                )}
              </div>

              {/* Next */}
              <div className="w-1/3 flex justify-end">
                {nextProject && (
                  <button
                    type="button"
                    onClick={goToNext}
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    <span className="text-sm truncate max-w-[200px]">
                      {formatProjectWithCustomer(nextProject.name, nextProject.customer_name)}
                    </span>
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
