import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { Layout } from "~/components/layout";
import {
  AddParticipantModal,
  AssignmentsTable,
  EditAssignmentModal,
  firstOfMonth,
  ForecastBar,
  MonthPicker,
  ParticipantsList,
} from "~/components/project-assignments";
import { useMonthSearchParam } from "~/hooks/useMonthSearchParam";
import { useProjectAssignments } from "~/hooks/useProjectAssignments";
import type { KippoProject, ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { useAuthGate } from "~/hooks/useAuthGate";
import { remainingPeriod } from "~/lib/dates";

export function meta() {
  return [{ title: "プロジェクト割当 - Kippo" }];
}

export default function ProjectAssignments() {
  const { user, authLoading } = useAuthGate();
  const { id } = useParams();
  const [month, setMonth] = useMonthSearchParam();
  const state = useProjectAssignments(id, month);

  if (authLoading) {
    return (
      <Layout title="プロジェクト割当">
        <LoadingPanel />
      </Layout>
    );
  }
  if (!user) return null;

  return (
    <Layout
      title="プロジェクト割当"
      projectName={state.project?.name}
      projectCustomerName={state.project?.customer_name}
      projectId={id}
    >
      <Body state={state} month={month} onMonthChange={setMonth} />
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

type BodyProps = {
  state: State;
  month: string;
  onMonthChange: (month: string) => void;
};

function Body({ state, month, onMonthChange }: BodyProps) {
  const [editTarget, setEditTarget] = useState<ProjectMonthlyAssignment | null>(null);
  const [participantOpen, setParticipantOpen] = useState(false);
  const effortUsernames = useEffortUsernames(state.project);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {state.error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{state.error}</div>
      )}
      <MonthPicker month={month} onChange={onMonthChange} />
      {state.isLoading ? (
        <LoadingPanel />
      ) : (
        <>
          <ForecastBar forecast={state.forecast} forecastError={state.forecastError} />
          <AddParticipantButton
            project={state.project}
            disabled={state.isSaving}
            onClick={() => setParticipantOpen(true)}
          />
          <ParticipantsList participants={state.participants} />
          <AssignmentsTable
            assignments={state.assignments}
            month={month}
            onCellClick={setEditTarget}
          />
        </>
      )}
      <EditAssignmentModal
        open={editTarget !== null}
        assignment={editTarget}
        project={state.project}
        isSaving={state.isSaving}
        onClose={() => setEditTarget(null)}
        onSave={state.updateAssignment}
        onDelete={state.deleteAssignment}
      />
      {state.project && (
        <AddParticipantModal
          open={participantOpen}
          project={state.project}
          effortUsernames={effortUsernames}
          isSaving={state.isSaving}
          onClose={() => setParticipantOpen(false)}
          onSubmit={(payload) =>
            state.project ? state.addParticipant(state.project.id, payload) : Promise.resolve(null)
          }
        />
      )}
    </div>
  );
}

/** The participant endpoint needs both dates to know the project period (kippo#72 D6), and rows
 * are created only for the remaining period (kippo#75 R1), which is empty once the project ended. */
function missingPeriodReason(project: KippoProject | null): string | null {
  if (!project) return "プロジェクトを読み込めませんでした";
  const missing = [!project.start_date && "開始日", !project.target_date && "目標終了日"].filter(
    Boolean,
  );
  if (missing.length > 0) return `${missing.join("と")}を設定すると参加者を追加できます`;
  const remaining = remainingPeriod(
    project.start_date,
    project.target_date,
    firstOfMonth(new Date()),
  );
  return remaining ? null : "プロジェクト期間が終了しています";
}

function AddParticipantButton({
  project,
  disabled,
  onClick,
}: {
  project: KippoProject | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const reason = missingPeriodReason(project);
  return (
    <div className="flex items-center justify-end gap-3">
      {reason && <span className="text-xs text-gray-500">{reason}</span>}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || reason !== null}
        title="残りの期間の各月に割当を登録します"
        className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ＋ 参加者を追加
      </button>
    </div>
  );
}

function LoadingPanel() {
  return <div className="flex justify-center items-center h-64 text-gray-500">読み込み中...</div>;
}
