import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { AssignmentsTable } from "~/components/project-assignments/AssignmentsTable";
import { ForecastBar } from "~/components/project-assignments/ForecastBar";
import { Layout } from "~/components/layout";
import { useProjectAssignments } from "~/hooks/useProjectAssignments";
import { useAuth } from "~/lib/auth-context";

export function meta() {
  return [{ title: "プロジェクト割当 - Kippo" }];
}

export default function ProjectAssignments() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  const { isLoading, error, project, forecast, forecastError, assignments } = useProjectAssignments(id);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <Layout title="プロジェクト割当">
        <div className="flex justify-center items-center h-64 text-gray-500">読み込み中...</div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout title="プロジェクト割当" projectName={project?.name} projectId={id}>
      <div className="space-y-6 max-w-6xl mx-auto">
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-64 text-gray-500">読み込み中...</div>
        ) : (
          <>
            <ForecastBar forecast={forecast} forecastError={forecastError} />
            <AssignmentsTable assignments={assignments} />
          </>
        )}
      </div>
    </Layout>
  );
}
