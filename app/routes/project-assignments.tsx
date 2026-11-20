import { useEffect, useMemo, useState } from "react";
import { Layout } from "~/components/layout";
import {
  CreateProjectModal,
  EditAssignmentModal,
  type MatrixCellClickArgs,
  MonthPicker,
  MonthlyAssignmentMatrix,
  firstOfMonth,
  MATRIX_CONFIDENCE_RULE,
  MATRIX_MIN_CONFIDENCE,
  unassignedMemberNames,
} from "~/components/project-assignments";
import { useHideUnassignedToggle } from "~/hooks/useHideUnassignedToggle";
import { useMonthSearchParam } from "~/hooks/useMonthSearchParam";
import { useMonthlyAssignments } from "~/hooks/useMonthlyAssignments";
import { useProjectAssignmentMutations } from "~/hooks/useProjectAssignmentMutations";
import type { KippoProjectRequest, ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { useAuthGate } from "~/hooks/useAuthGate";

export function meta() {
  return [{ title: "月別プロジェクト割当 - Kippo" }];
}

/** True when the displayed month is the current month or later — gates the
 * matrix's click-to-edit / click-to-add interactions (#22). Past months stay
 * read-only with a `過去月のためロック` tooltip. */
export function isEditableMonth(displayedMonth: string, today: Date): boolean {
  return displayedMonth >= firstOfMonth(today);
}

export default function ProjectAssignmentsMonthly() {
  const { user, authLoading } = useAuthGate();
  const [month, setMonth] = useMonthSearchParam();
  const [hideUnassigned, setHideUnassigned] = useHideUnassignedToggle();
  const { isLoading, error, projects, hiddenLowConfidenceCount, assignments, members, refresh } =
    useMonthlyAssignments(month);
  const [mutationError, setMutationError] = useState("");
  const mutations = useProjectAssignmentMutations(refresh, setMutationError);
  const [editTarget, setEditTarget] = useState<ProjectMonthlyAssignment | null>(null);
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

  // The edited row's project for EditAssignmentModal (customer name, start / target dates).
  const editProject = useMemo(
    () => (editTarget ? (projects.find((p) => p.id === editTarget.project) ?? null) : null),
    [editTarget, projects],
  );

  const handleCellClick = (args: MatrixCellClickArgs) => setEditTarget(args.assignment);

  const handleCreateProject = async (payload: KippoProjectRequest) => {
    const ok = await mutations.createProject(payload);
    if (ok) setCreatedProjectName(payload.name);
    return ok;
  };

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
          のアクティブプロジェクトのうち、{MATRIX_CONFIDENCE_RULE}
        </div>
        <MonthPicker month={month} onChange={setMonth} />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <HideUnassignedToggle
              checked={hideUnassigned}
              onChange={setHideUnassigned}
              hiddenMemberNames={hiddenMemberNames}
            />
            {!isLoading && (
              <span className="text-sm text-gray-600">
                プロジェクト数:{" "}
                <span className="font-semibold text-gray-900">{projects.length}</span>
                {hiddenLowConfidenceCount > 0 && (
                  <span className="ml-2 text-gray-500" title={MATRIX_CONFIDENCE_RULE}>
                    (非表示 {hiddenLowConfidenceCount}件: 確度 &lt; {MATRIX_MIN_CONFIDENCE}%)
                  </span>
                )}
              </span>
            )}
          </div>
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
            」を作成しました。開始日を設定し、確度を {MATRIX_MIN_CONFIDENCE}% 以上
            (口頭受注・契約(稼働中)) にすると当月のマトリクスに表示されます。
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
          />
        )}
      </div>
      <CreateProjectModal
        open={createOpen}
        isSaving={mutations.isSaving}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateProject}
      />
      <EditAssignmentModal
        open={editTarget !== null}
        assignment={editTarget}
        project={editProject}
        isSaving={mutations.isSaving}
        onClose={() => setEditTarget(null)}
        onSave={mutations.updateAssignment}
        onDelete={mutations.deleteAssignment}
      />
    </Layout>
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
