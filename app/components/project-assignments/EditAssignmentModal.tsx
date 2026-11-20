import { useEffect, useState } from "react";
import { useAssignmentEditContext } from "~/hooks/useAssignmentEditContext";
import type {
  KippoProject,
  PatchedProjectMonthlyAssignmentRequest,
  ProjectMonthlyAssignment,
} from "~/lib/api/generated/models";
import { formatMonth } from "~/lib/dates";
import {
  buildParticipantRows,
  buildUserRows,
  type ParticipantMonthRow,
  sumPercentages,
  type UserMonthRow,
} from "./edit-context";

type EditAssignmentModalProps = {
  open: boolean;
  assignment: ProjectMonthlyAssignment | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (id: number, patch: PatchedProjectMonthlyAssignmentRequest) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
  /** The assignment's project: source of the customer name and the 期間 row. When null the
   * customer row is omitted and the period shows as unset. */
  project?: KippoProject | null;
};

export function EditAssignmentModal(props: EditAssignmentModalProps) {
  const { open, assignment, isSaving, onClose, onSave, onDelete, project } = props;
  const form = useEditForm(open, assignment);
  const context = useAssignmentEditContext(open ? assignment : null);

  if (!open || !assignment) return null;

  const handleSave = async () => {
    const ok = await onSave(assignment.id, { percentage: form.percentage });
    if (ok) onClose();
  };
  const handleDelete = async () => {
    if (
      !window.confirm(
        `${assignment.user_display_name} の ${assignment.month} の割当を削除しますか?`,
      )
    )
      return;
    const ok = await onDelete(assignment.id);
    if (ok) onClose();
  };

  const month = formatMonth(assignment.month ?? "");
  const participantRows = buildParticipantRows(
    context.participants,
    context.projectMonthRows,
    assignment,
    form.percentage,
  );
  const userRows = buildUserRows(context.userMonthRows, assignment, form.percentage);
  const sectionState = { isLoading: context.isLoading, error: context.error };

  return (
    <ModalShell title="割当を編集" onClose={onClose}>
      <ReadOnlyHeader assignment={assignment} project={project} month={month} />
      <EditRow assignment={assignment}>
        <PercentageField
          value={form.percentage}
          onChange={form.setPercentage}
          disabled={isSaving}
        />
      </EditRow>
      <ParticipantsSection month={month} rows={participantRows} {...sectionState} />
      <UserAssignmentsSection
        month={month}
        userName={assignment.user_display_name || assignment.user_username}
        rows={userRows}
        {...sectionState}
      />
      <ModalActions
        onDelete={handleDelete}
        onCancel={onClose}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </ModalShell>
  );
}

function useEditForm(open: boolean, assignment: ProjectMonthlyAssignment | null) {
  const [percentage, setPercentage] = useState(0);
  useEffect(() => {
    if (open && assignment) {
      setPercentage(assignment.percentage);
    }
  }, [open, assignment]);
  return { percentage, setPercentage };
}

function ReadOnlyHeader({
  assignment,
  project,
  month,
}: {
  assignment: ProjectMonthlyAssignment;
  project?: KippoProject | null;
  month: string;
}) {
  const start = project?.start_date || "未設定";
  const end = project?.target_date || "未設定";
  return (
    <dl className="mb-4 grid grid-cols-[6rem_minmax(0,1fr)] gap-x-2 gap-y-1 text-sm text-gray-600">
      {project?.customer_name && (
        <>
          <dt className="font-medium">顧客</dt>
          <dd>{project.customer_name}</dd>
        </>
      )}
      <dt className="font-medium">プロジェクト</dt>
      <dd className="font-medium text-gray-900">{assignment.project_name}</dd>
      <dt className="font-medium">期間</dt>
      <dd>
        {start} 〜 {end} <span className="text-gray-500">（開始日 〜 目標終了日）</span>
      </dd>
      <dt className="font-medium">月</dt>
      <dd>{month}</dd>
    </dl>
  );
}

function EditRow({
  assignment,
  children,
}: {
  assignment: ProjectMonthlyAssignment;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 rounded-md border border-indigo-200 bg-indigo-50 p-4">
      <div className="min-w-0">
        <div className="text-xs text-gray-600">ユーザー</div>
        <div className="font-medium text-gray-900">
          {assignment.user_display_name}{" "}
          <span className="font-normal text-gray-500">({assignment.user_username})</span>
        </div>
      </div>
      {children}
    </div>
  );
}

type SectionState = { isLoading: boolean; error: string };

function SectionBody({ isLoading, error, children }: SectionState & { children: React.ReactNode }) {
  if (isLoading) return <p className="text-sm text-gray-500">読み込み中...</p>;
  if (error) return <p className="text-sm text-red-700">{error}</p>;
  return <>{children}</>;
}

const TH = "px-3 py-1.5 font-medium border-b border-gray-200";
const TD = "px-3 py-1.5 border-b border-gray-100";
const editingRowClass = (isEditing: boolean) => (isEditing ? "bg-indigo-50" : "");
const formatPercentage = (value: number | null) => (value === null ? "—" : `${value}%`);

function EditingBadge() {
  return (
    <span className="ml-2 rounded border border-indigo-300 px-1 text-xs text-indigo-700">
      編集中
    </span>
  );
}

function ParticipantsSection({
  month,
  rows,
  ...state
}: SectionState & { month: string; rows: ParticipantMonthRow[] }) {
  return (
    <section className="mb-5" aria-label="プロジェクト参加者">
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="text-sm font-medium text-gray-900">プロジェクト参加者（{month}）</h4>
        {!state.isLoading && !state.error && (
          <span className="text-xs text-gray-500">{rows.length}名</span>
        )}
      </div>
      <SectionBody {...state}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className={TH}>参加者</th>
                <th className={TH}>ロール</th>
                <th className={`${TH} text-right`}>既定</th>
                <th className={`${TH} text-right`}>当月の割当</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className={editingRowClass(row.isEditing)}>
                  <td className={`${TD} whitespace-nowrap text-gray-900`}>
                    {row.name}
                    {row.isEditing && <EditingBadge />}
                  </td>
                  <td className={`${TD} text-gray-600`}>{row.role || "(指定なし)"}</td>
                  <td className={`${TD} text-right text-gray-500`}>
                    {formatPercentage(row.defaultPercentage)}
                  </td>
                  <td className={`${TD} text-right font-medium tabular-nums`}>
                    {formatPercentage(row.monthPercentage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionBody>
    </section>
  );
}

function UserAssignmentsSection({
  month,
  userName,
  rows,
  ...state
}: SectionState & { month: string; userName: string; rows: UserMonthRow[] }) {
  const total = sumPercentages(rows);
  const over = total > 100;
  return (
    <section aria-label="ユーザーの割当">
      <h4 className="mb-2 text-sm font-medium text-gray-900">
        {userName} の割当（{month}・全プロジェクト）
      </h4>
      <SectionBody {...state}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600">
              <th className={TH}>プロジェクト</th>
              <th className={`${TH} text-right`}>割当</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.projectId} className={editingRowClass(row.isEditing)}>
                <td className={`${TD} text-gray-900`}>
                  {row.projectName}
                  {row.isEditing && <EditingBadge />}
                </td>
                <td className={`${TD} text-right font-medium tabular-nums`}>{row.percentage}%</td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2 font-medium">月合計</td>
              <td
                className={`px-3 py-2 text-right font-bold tabular-nums ${over ? "text-red-700" : "text-gray-900"}`}
              >
                {total}%{over ? " ⚠" : ""}
              </td>
            </tr>
          </tbody>
        </table>
        {over && (
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
            月合計が 100% を超えています（保存は可能）
          </p>
        )}
      </SectionBody>
    </section>
  );
}

function ModalActions({
  onDelete,
  onCancel,
  onSave,
  isSaving,
}: {
  onDelete: () => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="mt-6 flex gap-3 justify-between">
      <button
        type="button"
        onClick={onDelete}
        disabled={isSaving}
        className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
      >
        削除
      </button>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="fixed inset-0 bg-black bg-opacity-25 cursor-default"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  );
}

function PercentageField({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label htmlFor="edit-assignment-pct" className="block text-xs font-medium text-gray-700 mb-1">
        割当 (%)
      </label>
      <input
        id="edit-assignment-pct"
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        disabled={disabled}
        className="w-28 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}
