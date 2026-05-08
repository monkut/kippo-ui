import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  AddAssignmentModal,
  AssignmentsTable,
  EditAssignmentModal,
  ForecastBar,
  PatternPickerModal,
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

type State = ReturnType<typeof useProjectAssignments>;

function Body({ projectId, state }: { projectId: string | undefined; state: State }) {
  const [addOpen, setAddOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
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
            onSuggestClick={() => setSuggestOpen(true)}
            onCellClick={setEditTarget}
          />
        </>
      )}
      <Modals
        projectId={projectId}
        state={state}
        addOpen={addOpen}
        setAddOpen={setAddOpen}
        suggestOpen={suggestOpen}
        setSuggestOpen={setSuggestOpen}
        editTarget={editTarget}
        setEditTarget={setEditTarget}
      />
    </div>
  );
}

function Modals({
  projectId,
  state,
  addOpen,
  setAddOpen,
  suggestOpen,
  setSuggestOpen,
  editTarget,
  setEditTarget,
}: {
  projectId: string | undefined;
  state: State;
  addOpen: boolean;
  setAddOpen: (open: boolean) => void;
  suggestOpen: boolean;
  setSuggestOpen: (open: boolean) => void;
  editTarget: ProjectMonthlyAssignment | null;
  setEditTarget: (target: ProjectMonthlyAssignment | null) => void;
}) {
  return (
    <>
      {projectId && (
        <>
          <AddAssignmentModal
            open={addOpen}
            projectId={projectId}
            existingAssignments={state.assignments}
            isSaving={state.isSaving}
            onClose={() => setAddOpen(false)}
            onSubmit={state.createAssignment}
          />
          <PatternPickerModal
            open={suggestOpen}
            projectId={projectId}
            onClose={() => setSuggestOpen(false)}
            onAcceptPattern={state.bulkCreateAssignments}
          />
        </>
      )}
      <EditAssignmentModal
        open={editTarget !== null}
        assignment={editTarget}
        isSaving={state.isSaving}
        onClose={() => setEditTarget(null)}
        onSave={state.updateAssignment}
        onDelete={state.deleteAssignment}
      />
    </>
  );
}

function LoadingPanel() {
  return <div className="flex justify-center items-center h-64 text-gray-500">読み込み中...</div>;
}
