import { useEffect, useMemo, useState } from "react";
import type { KippoProject, ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { projectsRetrieve } from "~/lib/api/generated/projects/projects";
import { fetchAllMonthlyAssignments } from "~/lib/api/pagination";
import {
  buildMyAssignmentsMatrix,
  MY_ASSIGNMENTS_WINDOW_MONTHS,
  type MyAssignmentsMatrix,
  monthRange,
} from "~/lib/my-assignments";

export type UseMyAssignmentsReturn = {
  isLoading: boolean;
  error: string;
  matrix: MyAssignmentsMatrix;
  /** Project metadata (customer, phase, 確度) by project id; missing when the fetch failed. */
  projectsById: ReadonlyMap<string, KippoProject>;
};

const FETCH_ERROR = "データの取得に失敗しました";

async function fetchProjects(ids: string[]): Promise<Map<string, KippoProject>> {
  // Per-id fetch: closed projects drop out of the active list but still appear in past months.
  const results = await Promise.allSettled(ids.map((id) => projectsRetrieve(id)));
  const byId = new Map<string, KippoProject>();
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.status === 200) {
      byId.set(result.value.data.id, result.value.data);
    }
  }
  return byId;
}

/** The signed-in user's assignments over `MY_ASSIGNMENTS_WINDOW_MONTHS` months from `startMonth`.
 * `auth/me` exposes no user id, so rows are filtered by username client-side. */
export function useMyAssignments(
  username: string | undefined,
  startMonth: string,
): UseMyAssignmentsReturn {
  const months = useMemo(() => monthRange(startMonth, MY_ASSIGNMENTS_WINDOW_MONTHS), [startMonth]);
  const [assignments, setAssignments] = useState<ProjectMonthlyAssignment[]>([]);
  const [projectsById, setProjectsById] = useState<ReadonlyMap<string, KippoProject>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!username) return;
    let alive = true;
    setIsLoading(true);
    setError("");
    (async () => {
      try {
        const all = await fetchAllMonthlyAssignments({
          month_gte: months[0],
          month_lte: months[months.length - 1],
        });
        const mine = all.filter((a) => a.user_username === username);
        const projects = await fetchProjects(Array.from(new Set(mine.map((a) => a.project))));
        if (!alive) return;
        setAssignments(mine);
        setProjectsById(projects);
      } catch {
        if (alive) setError(FETCH_ERROR);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [username, months]);

  const matrix = useMemo(
    () => buildMyAssignmentsMatrix(assignments, months),
    [assignments, months],
  );
  return { isLoading, error, matrix, projectsById };
}
