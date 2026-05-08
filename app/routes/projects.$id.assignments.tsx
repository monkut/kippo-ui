import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  AddAssignmentModal,
  AssignmentsTable,
  EditAssignmentModal,
  ForecastBar,
} from "~/components/project-assignments";
import { Layout } from "~/components/layout";
import { useProjectAssignments } from "~/hooks/useProjectAssignments";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { useAuth } from "~/lib/auth-context";

export function meta() {
  return [{ title: "プロジェクト割当 - Kippo" }];
}

export default function ProjectAssignments() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const state = useProjectAssignments(id);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <Layout title="プロジェクト割当">
        <LoadingPanel />
      </Layout>
    );
  }
  if (!user) return null;

  return (
    <Layout title="プロジェクト割当" projectName={state.project?.name} projectId={id}>
      <Body projectId={id} state={state} />
    </Layout>
  );
}

function Body({
  projectId,
  state,
}: {
  projectId: string | undefined;
  state: ReturnType<typeof useProjectAssignments>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectMonthlyAssignment | null>(null);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {state.error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{state.error}</div>}
      {state.isLoading ? (
        <LoadingPanel />
      ) : (
        <>
          <ForecastBar forecast={state.forecast} forecastError={state.forecastError} />
          <AssignmentsTable
            assignments={state.assignments}
            onAddClick={() => setAddOpen(true)}
            onCellClick={setEditTarget}
          />
        </>
      )}
      {projectId && (
        <AddAssignmentModal
          open={addOpen}
          projectId={projectId}
          existingAssignments={state.assignments}
          isSaving={state.isSaving}
          onClose={() => setAddOpen(false)}
          onSubmit={state.createAssignment}
        />
      )}
      <EditAssignmentModal
        open={editTarget !== null}
        assignment={editTarget}
        isSaving={state.isSaving}
        onClose={() => setEditTarget(null)}
        onSave={state.updateAssignment}
        onDelete={state.deleteAssignment}
      />
    </div>
  );
}

function LoadingPanel() {
  return <div className="flex justify-center items-center h-64 text-gray-500">読み込み中...</div>;
}
