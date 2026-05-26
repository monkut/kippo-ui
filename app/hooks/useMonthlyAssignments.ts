import { useEffect, useMemo, useState } from "react";
import type {
  KippoProject,
  OrganizationMember,
  ProjectMonthlyAssignment,
} from "~/lib/api/generated/models";
import { projectsMembersRetrieve } from "~/lib/api/generated/projects/projects";
import { fetchAllMonthlyAssignments, fetchAllProjects } from "~/lib/api/pagination";
import { EXCLUDED_USERNAMES } from "~/components/project-assignments/utils";

export type UseMonthlyAssignmentsState = {
  isLoading: boolean;
  error: string;
  projects: KippoProject[];
  assignments: ProjectMonthlyAssignment[];
  members: OrganizationMember[];
};

const FETCH_ERROR = "データの取得に失敗しました";

/** Fetch members for one project per unique organization, then dedupe by user_id. */
async function fetchOrgMembersForProjects(projects: KippoProject[]): Promise<OrganizationMember[]> {
  const projectByOrg = new Map<string, string>();
  for (const project of projects) {
    if (!projectByOrg.has(project.organization)) {
      projectByOrg.set(project.organization, project.id);
    }
  }
  const responses = await Promise.all(
    Array.from(projectByOrg.values()).map((projectId) => projectsMembersRetrieve(projectId)),
  );
  const byUserId = new Map<string, OrganizationMember>();
  for (const response of responses) {
    if (response.status !== 200) continue;
    for (const member of response.data.members ?? []) {
      byUserId.set(member.user_id, member);
    }
  }
  return Array.from(byUserId.values());
}

type ProjectsAndMembersState = {
  projects: KippoProject[];
  members: OrganizationMember[];
  isLoading: boolean;
  error: string;
};

function useProjectsAndMembers(): ProjectsAndMembersState {
  const [projects, setProjects] = useState<KippoProject[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    (async () => {
      try {
        const projectData = await fetchAllProjects({ is_active: true });
        if (!alive) return;
        // Keep anon-project rows in the raw list — useMonthlyAssignments below
        // filters them per-month (showing only those with assignments in the
        // selected month). Project-list fetch is monthless and one-shot.
        setProjects(projectData);
        const orgMembers = await fetchOrgMembersForProjects(projectData);
        if (alive) setMembers(orgMembers.filter((m) => !EXCLUDED_USERNAMES.has(m.username)));
      } catch {
        if (alive) setError(FETCH_ERROR);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { projects, members, isLoading, error };
}

function useAssignmentsForMonth(month: string) {
  const [assignments, setAssignments] = useState<ProjectMonthlyAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    (async () => {
      try {
        const data = await fetchAllMonthlyAssignments({ month });
        if (alive) setAssignments(data.filter((a) => !EXCLUDED_USERNAMES.has(a.user_username)));
      } catch {
        if (alive) setError(FETCH_ERROR);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [month]);

  return { assignments, isLoading, error };
}

export function useMonthlyAssignments(month: string): UseMonthlyAssignmentsState {
  const projectsState = useProjectsAndMembers();
  const assignmentsState = useAssignmentsForMonth(month);

  // anon-project ("Non-Project") rows are hidden by default but surface in the
  // matrix when they have at least one assignment in the displayed month.
  const visibleProjects = useMemo(() => {
    const projectIdsWithMonthAssignments = new Set(
      assignmentsState.assignments.map((a) => a.project),
    );
    return projectsState.projects.filter(
      (p) => p.phase !== "anon-project" || projectIdsWithMonthAssignments.has(p.id),
    );
  }, [projectsState.projects, assignmentsState.assignments]);

  return {
    isLoading: projectsState.isLoading || assignmentsState.isLoading,
    error: projectsState.error || assignmentsState.error,
    projects: visibleProjects,
    assignments: assignmentsState.assignments,
    members: projectsState.members,
  };
}
