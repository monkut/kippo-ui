import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Layout } from "~/components/layout";
import {
  AddAssignmentModal,
  AssignmentsTable,
  EditAssignmentModal,
  firstOfMonth,
  ForecastBar,
  MonthPicker,
  PatternPickerModal,
} from "~/components/project-assignments";
import { useProjectAssignments } from "~/hooks/useProjectAssignments";
import type { KippoProject, ProjectMonthlyAssignment } from "~/lib/api/generated/models";
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

function useEffortUsernames(project: KippoProject | null): ReadonlySet<string> {
  return useMemo(
    () => new Set(project?.weekly_effort_users.map((u) => u.username) ?? []),
    [project],
  );
}

function Body({ projectId, state }: { projectId: string | undefined; state: State }) {
  const [addOpen, setAddOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectMonthlyAssignment | null>(null);
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const effortUsernames = useEffortUsernames(state.project);
  const handleToggleConfirmed = (a: ProjectMonthlyAssignment) =>
    state.updateAssignment(a.id, { is_confirmed: !(a.is_confirmed ?? false) });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {state.error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{state.error}</div>
      )}
      <MonthPicker month={month} onChange={setMonth} />
      {state.isLoading ? (
        <LoadingPanel />
      ) : (
        <>
          <ForecastBar forecast={state.forecast} forecastError={state.forecastError} />
          <AssignmentsTable
            assignments={state.assignments}
            month={month}
            isSaving={state.isSaving}
            onAddClick={() => setAddOpen(true)}
            onSuggestClick={() => setSuggestOpen(true)}
            onCellClick={setEditTarget}
            onToggleConfirmed={handleToggleConfirmed}
          />
        </>
      )}
      <Modals
        projectId={projectId}
        state={state}
        month={month}
        effortUsernames={effortUsernames}
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

type ModalsProps = {
  projectId: string | undefined;
  state: State;
  month: string;
  effortUsernames: ReadonlySet<string>;
  addOpen: boolean;
  setAddOpen: (open: boolean) => void;
  suggestOpen: boolean;
  setSuggestOpen: (open: boolean) => void;
  editTarget: ProjectMonthlyAssignment | null;
  setEditTarget: (target: ProjectMonthlyAssignment | null) => void;
};

function Modals({
  projectId,
  state,
  month,
  effortUsernames,
  addOpen,
  setAddOpen,
  suggestOpen,
  setSuggestOpen,
  editTarget,
  setEditTarget,
}: ModalsProps) {
  return (
    <>
      {projectId && (
        <AddAssignmentModal
          open={addOpen}
          projectId={projectId}
          month={month}
          effortUsernames={effortUsernames}
          isSaving={state.isSaving}
          onClose={() => setAddOpen(false)}
          onSubmit={state.createAssignment}
        />
      )}
      {projectId && (
        <PatternPickerModal
          open={suggestOpen}
          projectId={projectId}
          project={state.project}
          onClose={() => setSuggestOpen(false)}
          onAcceptPattern={state.bulkCreateAssignments}
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
    </>
  );
}

function LoadingPanel() {
  return <div className="flex justify-center items-center h-64 text-gray-500">読み込み中...</div>;
}
