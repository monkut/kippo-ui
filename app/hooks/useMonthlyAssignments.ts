import { useCallback, useEffect, useState } from "react";
import { monthlyAssignmentsList } from "~/lib/api/generated/monthly-assignments/monthly-assignments";
import type { KippoProject, ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { projectsList } from "~/lib/api/generated/projects/projects";

export type UseMonthlyAssignmentsState = {
  isLoading: boolean;
  error: string;
  projects: KippoProject[];
  assignments: ProjectMonthlyAssignment[];
  refresh: () => Promise<void>;
};

/** Org-level monthly snapshot loader: active projects + assignments for one month. */
export function useMonthlyAssignments(month: string): UseMonthlyAssignmentsState {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<KippoProject[]>([]);
  const [assignments, setAssignments] = useState<ProjectMonthlyAssignment[]>([]);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [projectsRes, assignmentsRes] = await Promise.all([
        projectsList({ is_active: true }),
        monthlyAssignmentsList({ month }),
      ]);
      setProjects(projectsRes.data?.results ?? []);
      setAssignments(assignmentsRes.data?.results ?? []);
    } catch {
      setError("データの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { isLoading, error, projects, assignments, refresh: fetchAll };
}
