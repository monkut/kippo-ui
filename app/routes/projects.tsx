import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "~/lib/auth-context";
import { Layout } from "~/components/layout";
import { projectsList } from "~/lib/api/generated";
import type { KippoProject } from "~/lib/api/generated";

// Categories to exclude from the project list
const EXCLUDED_CATEGORIES = ["PAO", "r&d", "講師", "maintenance", "保守運用"];

export function meta() {
  return [{ title: "プロジェクト一覧 - Kippo要件管理" }];
}

export default function Projects() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<KippoProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
        const filteredProjects = response.data.results
          .filter((project) => !project.category || !EXCLUDED_CATEGORIES.includes(project.category))
          .sort((a, b) => {
            if (!a.start_date && !b.start_date) return 0;
            if (!a.start_date) return 1;
            if (!b.start_date) return -1;
            return a.start_date.localeCompare(b.start_date);
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
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link to={`/projects/${project.id}`} className="block hover:bg-gray-50">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-indigo-600 truncate">
                          {project.name}
                        </p>
                        <div className="ml-2 flex-shrink-0 flex gap-2">
                          {project.phase && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {project.phase}
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
                          {project.category && (
                            <p className="flex items-center text-sm text-gray-500">
                              カテゴリ: {project.category}
                            </p>
                          )}
                          <p className="flex items-center text-sm text-gray-500">
                            組織: {project.organization_name}
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
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
}
