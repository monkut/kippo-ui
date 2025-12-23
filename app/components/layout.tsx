import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "~/lib/auth-context";

interface LayoutProps {
  children: React.ReactNode;
  projectName?: string;
  projectId?: string;
  title?: string;
}

const urlPrefix = import.meta.env.VITE_URL_PREFIX || "";

export function Layout({ children, projectName, projectId, title }: LayoutProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
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

            <div className="flex-1 flex justify-center items-center gap-2">
              <Link to="/projects" className="text-xl font-bold text-gray-900">
                {title || "Kippo要件管理"}
              </Link>
              {projectName && projectId && (
                <>
                  <span className="text-gray-400">/</span>
                  <Link
                    to={`/projects/${projectId}`}
                    className="text-lg font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    {projectName}
                  </Link>
                </>
              )}
            </div>

            <div className="flex items-center">
              {isLoading ? (
                <div className="text-sm text-gray-500">読み込み中...</div>
              ) : user ? (
                <div className="flex items-center gap-4">
                  {projectId && (
                    <Link
                      to={`/projects/${projectId}/summary`}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      見積サマリー
                    </Link>
                  )}
                  <span className="text-sm text-gray-600">{user.username}</span>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  ログイン
                </Link>
              )}
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
                <Link
                  to="/projects"
                  onClick={() => setMenuOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive("/projects")
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  要件管理
                </Link>
                <Link
                  to="/project-status"
                  onClick={() => setMenuOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive("/project-status")
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  プロジェクト状況
                </Link>
                <Link
                  to="/weekly-effort"
                  onClick={() => setMenuOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive("/weekly-effort")
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  週間稼働量
                </Link>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
