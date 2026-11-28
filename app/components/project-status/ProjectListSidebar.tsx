import type { KippoProject } from "~/lib/api/generated";
import { formatProjectWithCustomer } from "~/lib/format-project";

interface ProjectListSidebarProps {
  projects: KippoProject[];
  currentIndex: number;
  onSelectProject: (index: number) => void;
}

export function ProjectListSidebar({
  projects,
  currentIndex,
  onSelectProject,
}: ProjectListSidebarProps) {
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
                  <span className="block truncate">
                    {formatProjectWithCustomer(project.name, project.customer_name)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
