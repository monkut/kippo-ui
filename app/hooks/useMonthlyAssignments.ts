import { useEffect, useMemo, useState } from "react";
import type {
  KippoProject,
  OrganizationMemberDetail,
  ProjectMonthlyAssignment,
} from "~/lib/api/generated/models";
import { organizationsMembersRetrieve } from "~/lib/api/generated/organizations/organizations";
import { fetchAllMonthlyAssignments, fetchAllProjects } from "~/lib/api/pagination";
import { EXCLUDED_USERNAMES } from "~/components/project-assignments/utils";

export type UseMonthlyAssignmentsState = {
  isLoading: boolean;
  error: string;
  projects: KippoProject[];
  assignments: ProjectMonthlyAssignment[];
  members: OrganizationMemberDetail[];
};

const FETCH_ERROR = "データの取得に失敗しました";

/** Fetch members across every organization spanning the given projects, with
 * `available_work_days` populated for the displayed month so the matrix can
 * compute per-project effort in person-days (not just summed percentages).
 */
async function fetchOrgMembersForProjects(
  projects: KippoProject[],
  month: string,
): Promise<OrganizationMemberDetail[]> {
  const orgIds = Array.from(new Set(projects.map((p) => p.organization)));
  const responses = await Promise.all(
    orgIds.map((orgId) => organizationsMembersRetrieve(orgId, { month })),
  );
  const byUserId = new Map<string, OrganizationMemberDetail>();
  for (const response of responses) {
    if (response.status !== 200) continue;
    for (const member of response.data.members ?? []) {
      byUserId.set(member.user_id, member);
    }
  }
  return Array.from(byUserId.values());
}

function useProjects(): { projects: KippoProject[]; isLoading: boolean; error: string } {
  const [projects, setProjects] = useState<KippoProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    (async () => {
      try {
        const projectData = await fetchAllProjects({ is_active: true });
        if (alive) setProjects(projectData);
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

  return { projects, isLoading, error };
}

/** Re-fetches members whenever `month` changes so `available_work_days` reflects
 * the displayed month. Depends on `projects` only to discover which orgs to query. */
function useMembersForMonth(
  projects: KippoProject[],
  month: string,
): { members: OrganizationMemberDetail[]; isLoading: boolean; error: string } {
  const [members, setMembers] = useState<OrganizationMemberDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Stable key for the org set so we don't re-fetch when project metadata changes
  // but the spanned orgs don't.
  const orgKey = useMemo(
    () =>
      Array.from(new Set(projects.map((p) => p.organization)))
        .sort()
        .join(","),
    [projects],
  );

  useEffect(() => {
    if (!orgKey) {
      setIsLoading(false);
      return;
    }
    let alive = true;
    setIsLoading(true);
    (async () => {
      try {
        const orgMembers = await fetchOrgMembersForProjects(projects, month);
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
    // `projects` deliberately excluded — `orgKey` captures the only relevant slice
    // (the set of organizations), so we avoid re-fetching when project metadata
    // changes without altering org membership.
    // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  }, [orgKey, month]);

  return { members, isLoading, error };
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
  const projectsState = useProjects();
  const membersState = useMembersForMonth(projectsState.projects, month);
  const assignmentsState = useAssignmentsForMonth(month);

  // Only show projects that have at least one assignment in the displayed month.
  // (Subsumes the earlier anon-project-only carve-out — the rule now applies to
  // all phases so the matrix doesn't list rows full of "—" cells.)
  const visibleProjects = useMemo(() => {
    const projectIdsWithMonthAssignments = new Set(
      assignmentsState.assignments.map((a) => a.project),
    );
    return projectsState.projects.filter((p) => projectIdsWithMonthAssignments.has(p.id));
  }, [projectsState.projects, assignmentsState.assignments]);

  return {
    isLoading: projectsState.isLoading || membersState.isLoading || assignmentsState.isLoading,
    error: projectsState.error || membersState.error || assignmentsState.error,
    projects: visibleProjects,
    assignments: assignmentsState.assignments,
    members: membersState.members,
  };
}
