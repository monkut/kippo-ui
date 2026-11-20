import type { ProjectMonthlyAssignment, ProjectParticipant } from "~/lib/api/generated/models";

/** One row of the 割当の編集 participants table: the participant's default and their row for the
 * edited month. `monthPercentage` is null when the participant has no row that month. */
export type ParticipantMonthRow = {
  userId: string;
  name: string;
  role: string;
  defaultPercentage: number | null;
  monthPercentage: number | null;
  isEditing: boolean;
};

/** One of the edited user's assignments in the edited month, across every project they are on. */
export type UserMonthRow = {
  projectId: string;
  projectName: string;
  percentage: number;
  isEditing: boolean;
};

const displayName = (row: { user_display_name: string; user_username: string }) =>
  row.user_display_name || row.user_username;

/** Participants joined with the project's rows for the month. Rows without a participant (created
 * before kippo#75) are kept so the month total stays complete. The edited user's percentage is the
 * unsaved form value. Sorted by name, the edited user first. */
export function buildParticipantRows(
  participants: ProjectParticipant[],
  projectMonthRows: ProjectMonthlyAssignment[],
  editing: ProjectMonthlyAssignment,
  editingPercentage: number,
): ParticipantMonthRow[] {
  const rowByUser = new Map(projectMonthRows.map((r) => [r.user, r]));
  const fromParticipants = participants.map((p) => ({
    userId: p.user,
    name: displayName(p),
    role: p.role,
    defaultPercentage: p.percentage,
    monthPercentage: rowByUser.get(p.user)?.percentage ?? null,
  }));
  const participantUsers = new Set(participants.map((p) => p.user));
  const withoutParticipant = projectMonthRows
    .filter((r) => !participantUsers.has(r.user))
    .map((r) => ({
      userId: r.user,
      name: displayName(r),
      role: r.role ?? "",
      defaultPercentage: null,
      monthPercentage: r.percentage,
    }));
  return [...fromParticipants, ...withoutParticipant]
    .map((row) => {
      const isEditing = row.userId === editing.user;
      return {
        ...row,
        monthPercentage: isEditing ? editingPercentage : row.monthPercentage,
        isEditing,
      };
    })
    .sort(
      (a, b) => Number(b.isEditing) - Number(a.isEditing) || a.name.localeCompare(b.name, "ja"),
    );
}

/** The edited user's rows for the month on every project, the edited project first with the
 * unsaved form value. */
export function buildUserRows(
  userMonthRows: ProjectMonthlyAssignment[],
  editing: ProjectMonthlyAssignment,
  editingPercentage: number,
): UserMonthRow[] {
  const others = userMonthRows
    .filter((r) => r.id !== editing.id)
    .map((r) => ({
      projectId: r.project,
      projectName: r.project_name,
      percentage: r.percentage,
      isEditing: false,
    }))
    .sort(
      (a, b) => b.percentage - a.percentage || a.projectName.localeCompare(b.projectName, "ja"),
    );
  const edited = {
    projectId: editing.project,
    projectName: editing.project_name,
    percentage: editingPercentage,
    isEditing: true,
  };
  return [edited, ...others];
}

export const sumPercentages = (rows: ReadonlyArray<{ percentage: number }>) =>
  rows.reduce((total, r) => total + r.percentage, 0);
