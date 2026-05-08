import { useEffect, useState } from "react";
import type { KippoProject, ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { fetchAllMonthlyAssignments, fetchAllProjects } from "~/lib/api/pagination";

export type UseMonthlyAssignmentsState = {
  isLoading: boolean;
  error: string;
  projects: KippoProject[];
  assignments: ProjectMonthlyAssignment[];
};

const FETCH_ERROR = "データの取得に失敗しました";

export function useMonthlyAssignments(month: string): UseMonthlyAssignmentsState {
  const [projects, setProjects] = useState<KippoProject[]>([]);
  const [assignments, setAssignments] = useState<ProjectMonthlyAssignment[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setProjectsLoading(true);
    (async () => {
      try {
        const data = await fetchAllProjects({ is_active: true });
        if (alive) setProjects(data);
      } catch {
        if (alive) setError(FETCH_ERROR);
      } finally {
        if (alive) setProjectsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setAssignmentsLoading(true);
    (async () => {
      try {
        const data = await fetchAllMonthlyAssignments({ month });
        if (alive) setAssignments(data);
      } catch {
        if (alive) setError(FETCH_ERROR);
      } finally {
        if (alive) setAssignmentsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [month]);

  return {
    isLoading: projectsLoading || assignmentsLoading,
    error,
    projects,
    assignments,
  };
}
