import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "~/lib/auth-context";
import { Layout } from "~/components/layout";
import { projectsList } from "~/lib/api/generated/projects/projects";
import type { KippoProject } from "~/lib/api/generated/models";
import { useHiddenProjectCategories } from "~/hooks/useHiddenProjectCategories";

const UNCATEGORIZED_LABEL = "未分類";

export function meta() {
  return [{ title: "プロジェクト一覧 - Kippo要件管理" }];
}

export default function Projects() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<KippoProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [hiddenCategories, setHiddenCategories] = useHiddenProjectCategories();

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
        const sortedProjects = [...response.data.results].sort((a, b) => {
          if (!a.start_date && !b.start_date) return 0;
          if (!a.start_date) return 1;
          if (!b.start_date) return -1;
          return a.start_date.localeCompare(b.start_date);
        });
        setProjects(sortedProjects);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError("プロジェクトの読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  // All distinct categories present across the loaded projects (sorted), used to
  // populate the "hide category" control.
  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    for (const project of projects) {
      if (project.category) categories.add(project.category);
    }
    return [...categories].sort();
  }, [projects]);

  // Projects visible after applying the user's hidden-category selection.
  const visibleProjects = useMemo(
    () =>
      projects.filter((project) => !project.category || !hiddenCategories.has(project.category)),
    [projects, hiddenCategories],
  );

  const handleToggleCategory = (category: string) => {
    const next = new Set(hiddenCategories);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    setHiddenCategories(next);
  };

  // Separate visible projects into those with and without requirements
  const { projectsWithRequirements, projectsWithoutRequirements } = useMemo(() => {
    const withReqs: KippoProject[] = [];
    const withoutReqs: KippoProject[] = [];
    for (const project of visibleProjects) {
      if (project.has_requirements) {
        withReqs.push(project);
      } else {
        withoutReqs.push(project);
      }
    }
    return { projectsWithRequirements: withReqs, projectsWithoutRequirements: withoutReqs };
  }, [visibleProjects]);

  if (authLoading) {
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">プロジェクト一覧</h1>
          {allCategories.length > 0 && (
            <HideCategoryControl
              categories={allCategories}
              hiddenCategories={hiddenCategories}
              onToggle={handleToggleCategory}
            />
          )}
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">読み込み中...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">プロジェクトがありません</p>
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              表示するプロジェクトがありません（すべてのカテゴリが非表示です）
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Projects WITH requirements defined */}
            {projectsWithRequirements.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">要件定義あり</h2>
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {projectsWithRequirements.map((project) => (
                      <ProjectListItem key={project.id} project={project} />
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Projects WITHOUT requirements defined */}
            {projectsWithoutRequirements.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">要件未定義</h2>
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {projectsWithoutRequirements.map((project) => (
                      <ProjectListItem key={project.id} project={project} />
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

// Dropdown letting the user hide projects by category. Lists every category
// present across the loaded projects; a checked box hides that category's
// projects. Uses a native <details> element so it closes on outside interaction
// without extra state.
function HideCategoryControl({
  categories,
  hiddenCategories,
  onToggle,
}: {
  categories: string[];
  hiddenCategories: Set<string>;
  onToggle: (category: string) => void;
}) {
  const hiddenCount = categories.filter((category) => hiddenCategories.has(category)).length;
  return (
    <details className="relative">
      <summary className="cursor-pointer select-none list-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
        カテゴリを非表示{hiddenCount > 0 ? ` (${hiddenCount})` : ""}
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
        {categories.map((category) => (
          <label
            key={category}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
          >
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={hiddenCategories.has(category)}
              onChange={() => onToggle(category)}
            />
            {category}
          </label>
        ))}
      </div>
    </details>
  );
}

// Reusable component for rendering a project list item
function ProjectListItem({ project }: { project: KippoProject }) {
  return (
    <li>
      <Link to={`/projects/${project.id}`} className="block hover:bg-gray-50">
        <div className="px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-indigo-600 truncate">{project.name}</p>
            <div className="ml-2 flex-shrink-0 flex gap-2">
              {project.phase_display && (
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                  {project.phase_display}
                </span>
              )}
              {project.allocated_staff_days && (
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                  {project.allocated_staff_days} 日
                </span>
              )}
            </div>
          </div>
          <div className="mt-2 sm:flex sm:justify-between">
            <div className="sm:flex gap-4">
              <p className="flex items-center text-sm text-gray-500">
                カテゴリ: {project.category || UNCATEGORIZED_LABEL}
              </p>
            </div>
            <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 gap-4">
              <p>
                開始日:{" "}
                {project.start_date
                  ? new Date(project.start_date).toLocaleDateString("ja-JP")
                  : "-"}
              </p>
              <p>
                完了予定日:{" "}
                {project.target_date
                  ? new Date(project.target_date).toLocaleDateString("ja-JP")
                  : "-"}
              </p>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
