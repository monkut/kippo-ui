import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Layout } from "~/components/layout";
import {
  AddAssignmentModal,
  CreateProjectModal,
  EditAssignmentModal,
  type MatrixCellClickArgs,
  MonthPicker,
  MonthlyAssignmentMatrix,
  firstOfMonth,
  unassignedMemberNames,
} from "~/components/project-assignments";
import { useHideUnassignedToggle } from "~/hooks/useHideUnassignedToggle";
import { useMonthlyAssignments } from "~/hooks/useMonthlyAssignments";
import { useProjectAssignmentMutations } from "~/hooks/useProjectAssignmentMutations";
import type { KippoProjectRequest, ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { useAuth } from "~/lib/auth-context";

export function meta() {
  return [{ title: "月別プロジェクト割当 - Kippo" }];
}

type AddTarget = { projectId: string; userId: string; month: string };

/** True when the displayed month is the current month or later — gates the
 * matrix's click-to-edit / click-to-add interactions (#22). Past months stay
 * read-only with a `過去月のためロック` tooltip. */
export function isEditableMonth(displayedMonth: string, today: Date): boolean {
  return displayedMonth >= firstOfMonth(today);
}

export default function ProjectAssignmentsMonthly() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [hideUnassigned, setHideUnassigned] = useHideUnassignedToggle();
  const { isLoading, error, projects, assignments, members, refresh } =
    useMonthlyAssignments(month);
  const [mutationError, setMutationError] = useState("");
  const mutations = useProjectAssignmentMutations(refresh, setMutationError);
  const [editTarget, setEditTarget] = useState<ProjectMonthlyAssignment | null>(null);
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdProjectName, setCreatedProjectName] = useState<string | null>(null);

  // `editableMonth` recomputes on every month change — and on first render — so
  // a stale "today" can't leak through if the user leaves the tab open across
  // midnight. The dependency on `month` makes that intent explicit.
  const editableMonth = useMemo(() => isEditableMonth(month, new Date()), [month]);

  // Members the "未割当メンバーを非表示" toggle hides (monthly total 0) — shown in its tooltip.
  const hiddenMemberNames = useMemo(
    () => unassignedMemberNames(projects, assignments, members),
    [projects, assignments, members],
  );

  // Look up the project by id when the AddAssignmentModal is open so the
  // user-picker can prioritize this project's weekly-effort members.
  const addProject = useMemo(
    () => (addTarget ? (projects.find((p) => p.id === addTarget.projectId) ?? null) : null),
    [addTarget, projects],
  );
  const addEffortUsernames = useMemo(
    () => new Set(addProject?.weekly_effort_users.map((u) => u.username) ?? []),
    [addProject],
  );

  // Customer name for the EditAssignmentModal — assignment.project_name is
  // already on the row, but customer_name has to come from the projects list.
  const editProject = useMemo(
    () => (editTarget ? (projects.find((p) => p.id === editTarget.project) ?? null) : null),
    [editTarget, projects],
  );

  const handleCellClick = (args: MatrixCellClickArgs) => {
    if (args.assignment) {
      setEditTarget(args.assignment);
    } else {
      setAddTarget({ projectId: args.project.id, userId: args.user.user_id, month });
    }
  };

  const handleCreateProject = async (payload: KippoProjectRequest) => {
    const ok = await mutations.createProject(payload);
    if (ok) setCreatedProjectName(payload.name);
    return ok;
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  // Drop a stale "created" confirmation when the displayed month changes.
  useEffect(() => {
    setCreatedProjectName(null);
  }, [month]);

  if (authLoading) {
    return (
      <Layout title="月別プロジェクト割当">
        <LoadingPanel />
      </Layout>
    );
  }
  if (!user) return null;

  const combinedError = error || mutationError;

  return (
    <Layout title="月別プロジェクト割当">
      <div className="space-y-6 w-full max-w-[90vw] mx-auto">
        <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-800">
          注意: 当月の期間内 (start_date ≤ 月末 かつ target_date が空または ≥ 月初)
          のアクティブプロジェクトを表示します。
        </div>
        <MonthPicker month={month} onChange={setMonth} />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <HideUnassignedToggle
            checked={hideUnassigned}
            onChange={setHideUnassigned}
            hiddenMemberNames={hiddenMemberNames}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              disabled={mutations.isSaving}
              className="px-3 py-1.5 text-sm font-medium text-indigo-700 bg-white border border-indigo-300 rounded-md hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="必須項目のみで新しいプロジェクトを作成"
            >
              ＋ 新規プロジェクト作成
            </button>
          </div>
        </div>
        {createdProjectName && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">
            プロジェクト「{createdProjectName}
            」を作成しました。開始日や割当を設定すると当月のマトリクスに表示されます。
          </div>
        )}
        {combinedError && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{combinedError}</div>
        )}
        {isLoading ? (
          <LoadingPanel />
        ) : (
          <MonthlyAssignmentMatrix
            projects={projects}
            assignments={assignments}
            members={members}
            hideUnassigned={hideUnassigned}
            editableMonth={editableMonth}
            onCellClick={handleCellClick}
            onBulkSetConfirmed={mutations.bulkSetConfirmed}
            isSaving={mutations.isSaving}
          />
        )}
      </div>
      <CreateProjectModal
        open={createOpen}
        isSaving={mutations.isSaving}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateProject}
      />
      <Modals
        addTarget={addTarget}
        addEffortUsernames={addEffortUsernames}
        addProjectName={addProject?.name ?? null}
        addCustomerName={addProject?.customer_name ?? null}
        editTarget={editTarget}
        editCustomerName={editProject?.customer_name ?? null}
        isSaving={mutations.isSaving}
        onCloseAdd={() => setAddTarget(null)}
        onCloseEdit={() => setEditTarget(null)}
        onCreate={mutations.createAssignment}
        onUpdate={mutations.updateAssignment}
        onDelete={mutations.deleteAssignment}
      />
    </Layout>
  );
}

type ModalsProps = {
  addTarget: AddTarget | null;
  addEffortUsernames: ReadonlySet<string>;
  addProjectName: string | null;
  addCustomerName: string | null;
  editTarget: ProjectMonthlyAssignment | null;
  editCustomerName: string | null;
  isSaving: boolean;
  onCloseAdd: () => void;
  onCloseEdit: () => void;
  onCreate: React.ComponentProps<typeof AddAssignmentModal>["onSubmit"];
  onUpdate: React.ComponentProps<typeof EditAssignmentModal>["onSave"];
  onDelete: React.ComponentProps<typeof EditAssignmentModal>["onDelete"];
};

function Modals({
  addTarget,
  addEffortUsernames,
  addProjectName,
  addCustomerName,
  editTarget,
  editCustomerName,
  isSaving,
  onCloseAdd,
  onCloseEdit,
  onCreate,
  onUpdate,
  onDelete,
}: ModalsProps) {
  // Render AddAssignmentModal only when addTarget is set — its `useOrgMembers`
  // hook fires on `open=true`, and we don't want to issue an HTTP request with
  // a placeholder projectId just to satisfy the prop shape.
  return (
    <>
      {addTarget && (
        <AddAssignmentModal
          open={true}
          projectId={addTarget.projectId}
          month={addTarget.month}
          effortUsernames={addEffortUsernames}
          isSaving={isSaving}
          prefilledUserId={addTarget.userId}
          projectName={addProjectName}
          customerName={addCustomerName}
          onClose={onCloseAdd}
          onSubmit={onCreate}
        />
      )}
      <EditAssignmentModal
        open={editTarget !== null}
        assignment={editTarget}
        customerName={editCustomerName}
        isSaving={isSaving}
        onClose={onCloseEdit}
        onSave={onUpdate}
        onDelete={onDelete}
      />
    </>
  );
}

function HideUnassignedToggle({
  checked,
  onChange,
  hiddenMemberNames,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  hiddenMemberNames: string[];
}) {
  const count = hiddenMemberNames.length;
  const title =
    count > 0
      ? `非表示対象の未割当メンバー (${count}名):\n${hiddenMemberNames.join("\n")}`
      : "未割当メンバーはいません";
  return (
    <div className="flex items-center gap-2 text-sm text-gray-700" title={title}>
      <input
        id="hide-unassigned-members"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
      />
      <label htmlFor="hide-unassigned-members" className="cursor-pointer select-none">
        未割当メンバーを非表示{count > 0 ? ` (${count})` : ""}
      </label>
    </div>
  );
}

function LoadingPanel() {
  return <div className="flex justify-center items-center h-64 text-gray-500">読み込み中...</div>;
}
