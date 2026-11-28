import { useApiQuery } from "~/hooks/useApiQuery";
import type { ProjectMonthlyAssignment, ProjectParticipant } from "~/lib/api/generated/models";
import { projectsParticipantsList } from "~/lib/api/generated/projects/projects";
import { fetchAllMonthlyAssignments } from "~/lib/api/pagination";
import { readList } from "~/lib/api/read-list";

export type AssignmentEditContext = {
  isLoading: boolean;
  error: string;
  participants: ProjectParticipant[];
  /** The edited project's rows for the edited month. */
  projectMonthRows: ProjectMonthlyAssignment[];
  /** The edited user's rows for the edited month, on every project in the viewer's organizations. */
  userMonthRows: ProjectMonthlyAssignment[];
};

const NO_PARTICIPANTS: ProjectParticipant[] = [];
const NO_ROWS: ProjectMonthlyAssignment[] = [];

const FETCH_ERROR = "参加者・割当の取得に失敗しました";

/** Context for 割当の編集: the project's participants and the month's rows of the project and of
 * the edited user. One month-wide fetch covers both row sets. Refetched per opened assignment. */
export function useAssignmentEditContext(
  assignment: ProjectMonthlyAssignment | null,
): AssignmentEditContext {
  const projectId = assignment?.project;
  const userId = assignment?.user;
  const month = assignment?.month;

  const query = useApiQuery(
    async () => {
      const [participantsRes, monthRows] = await Promise.all([
        projectsParticipantsList(projectId ?? ""),
        fetchAllMonthlyAssignments({ month: month ?? undefined }),
      ]);
      return {
        participants:
          participantsRes.status === 200 ? readList<ProjectParticipant>(participantsRes.data) : [],
        projectMonthRows: monthRows.filter((r) => r.project === projectId),
        userMonthRows: monthRows.filter((r) => r.user === userId),
      };
    },
    [projectId, userId, month],
    { enabled: !!projectId && !!userId && !!month },
  );

  return {
    isLoading: query.isLoading,
    error: query.error ? FETCH_ERROR : "",
    participants: query.data?.participants ?? NO_PARTICIPANTS,
    projectMonthRows: query.data?.projectMonthRows ?? NO_ROWS,
    userMonthRows: query.data?.userMonthRows ?? NO_ROWS,
  };
}
