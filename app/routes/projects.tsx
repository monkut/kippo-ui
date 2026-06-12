import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "~/lib/auth-context";
import { Layout } from "~/components/layout";
import { projectsList } from "~/lib/api/generated/projects/projects";
import type { KippoProject } from "~/lib/api/generated/models";
import { useHiddenProjectCategories } from "~/hooks/useHiddenProjectCategories";

const UNCATEGORIZED_LABEL = "未分類";

// Billing-type key -> Japanese label (請求方法; kippo#39 / T15). Mirrors VALID_BILLING_TYPES.
const BILLING_TYPE_LABELS: Record<string, string> = {
  monthly: "月額",
  delivery: "納品",
};

// List sort options (kippo#39 / T15): 完了予定日 / 請求(売上) plus start date and name.
type SortKey = "start_date" | "target_date" | "total_revenue" | "name";
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "start_date", label: "開始日" },
  { key: "target_date", label: "完了予定日" },
  { key: "total_revenue", label: "売上" },
  { key: "name", label: "名前" },
];

const formatJpy = (value: string | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isNaN(n) ? "-" : `¥${n.toLocaleString("ja-JP")}`;
};

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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("start_date");

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
        setProjects(response.data.results);
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

  // Apply free-text search (社名/カテゴリ/ステータス/名前) then the selected sort (kippo#39 / T15).
  const displayedProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? visibleProjects.filter((project) =>
          [
            project.name,
            project.customer_name,
            project.category_label,
            project.category,
            project.phase_display,
            project.problem_definition,
          ]
            .filter(Boolean)
            .some((field) => (field as string).toLowerCase().includes(query)),
        )
      : visibleProjects;

    const collator = new Intl.Collator("ja");
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return collator.compare(a.name, b.name);
      if (sortKey === "total_revenue") {
        return Number(b.total_revenue ?? 0) - Number(a.total_revenue ?? 0); // largest first
      }
      // date keys: ascending, nulls last
      const av = a[sortKey];
      const bv = b[sortKey];
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return av.localeCompare(bv);
    });
  }, [visibleProjects, searchQuery, sortKey]);

  // Separate displayed projects into those with and without requirements
  const { projectsWithRequirements, projectsWithoutRequirements } = useMemo(() => {
    const withReqs: KippoProject[] = [];
    const withoutReqs: KippoProject[] = [];
    for (const project of displayedProjects) {
      if (project.has_requirements) {
        withReqs.push(project);
      } else {
        withoutReqs.push(project);
      }
    }
    return { projectsWithRequirements: withReqs, projectsWithoutRequirements: withoutReqs };
  }, [displayedProjects]);

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
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">プロジェクト一覧</h1>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="検索（社名・カテゴリ・名前）"
              aria-label="プロジェクト検索"
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <label className="flex items-center gap-1 text-sm text-gray-600">
              並び替え
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                aria-label="並び替え"
                className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {allCategories.length > 0 && (
              <HideCategoryControl
                categories={allCategories}
                hiddenCategories={hiddenCategories}
                onToggle={handleToggleCategory}
              />
            )}
          </div>
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
        ) : displayedProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">「{searchQuery}」に一致するプロジェクトがありません</p>
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
              {/* 請求方法 — distinct billing types across the project's contracts (kippo#39 / T15) */}
              {project.billing_types?.map((billingType) => (
                <span
                  key={billingType}
                  className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800"
                >
                  {BILLING_TYPE_LABELS[billingType] ?? billingType}
                </span>
              ))}
              {project.allocated_staff_days && (
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                  {project.allocated_staff_days} 日
                </span>
              )}
            </div>
          </div>
          {/* 紹介文 (kippo#29 / T07) — short project intro snippet */}
          {project.problem_definition && (
            <p className="mt-1 text-sm text-gray-600 line-clamp-2">{project.problem_definition}</p>
          )}
          <div className="mt-2 sm:flex sm:justify-between">
            <div className="sm:flex gap-4">
              <p className="flex items-center text-sm text-gray-500">
                {/* 社名 (kippo#39 / T14) */}
                {project.customer_name ? `${project.customer_name} ・ ` : ""}
                {/* カテゴリ — human-readable label (kippo#39 / T14) */}
                カテゴリ: {project.category_label || project.category || UNCATEGORIZED_LABEL}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap items-center text-sm text-gray-500 sm:mt-0 gap-4">
              {/* 売上 (kippo#32 / T13) */}
              <p>売上: {formatJpy(project.total_revenue)}</p>
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
