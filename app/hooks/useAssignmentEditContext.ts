import { useEffect, useState } from "react";
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

const EMPTY: AssignmentEditContext = {
  isLoading: false,
  error: "",
  participants: [],
  projectMonthRows: [],
  userMonthRows: [],
};

const FETCH_ERROR = "参加者・割当の取得に失敗しました";

/** Context for 割当の編集: the project's participants and the month's rows of the project and of
 * the edited user. One month-wide fetch covers both row sets. Refetched per opened assignment. */
export function useAssignmentEditContext(
  assignment: ProjectMonthlyAssignment | null,
): AssignmentEditContext {
  const [context, setContext] = useState<AssignmentEditContext>(EMPTY);
  const projectId = assignment?.project;
  const userId = assignment?.user;
  const month = assignment?.month;

  useEffect(() => {
    if (!projectId || !userId || !month) {
      setContext(EMPTY);
      return;
    }
    let alive = true;
    setContext({ ...EMPTY, isLoading: true });
    (async () => {
      try {
        const [participantsRes, monthRows] = await Promise.all([
          projectsParticipantsList(projectId),
          fetchAllMonthlyAssignments({ month }),
        ]);
        if (!alive) return;
        setContext({
          isLoading: false,
          error: "",
          participants:
            participantsRes.status === 200
              ? readList<ProjectParticipant>(participantsRes.data)
              : [],
          projectMonthRows: monthRows.filter((r) => r.project === projectId),
          userMonthRows: monthRows.filter((r) => r.user === userId),
        });
      } catch {
        if (alive) setContext({ ...EMPTY, error: FETCH_ERROR });
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId, userId, month]);

  return context;
}
