import type {
  KippoProject,
  MonthlyAssignmentsListParams,
  ProjectMonthlyAssignment,
  ProjectsListParams,
} from "./generated/models";
import { monthlyAssignmentsList } from "./generated/monthly-assignments/monthly-assignments";
import { projectsList } from "./generated/projects/projects";

const FETCH_ALL_CONCURRENCY = 5;

type PageResponse<T> = {
  status: number;
  data?: { count?: number; results?: T[] };
};

async function fetchAllPaginated<T, P extends { page?: number }>(
  fetchPage: (params: P) => Promise<PageResponse<T>>,
  params: P,
): Promise<T[]> {
  const first = await fetchPage({ ...params, page: 1 });
  if (first.status !== 200 || !first.data?.results) return [];

  const firstResults = first.data.results;
  const count = first.data.count ?? firstResults.length;
  const pageSize = firstResults.length;
  if (!pageSize || count <= pageSize) return firstResults;

  const totalPages = Math.ceil(count / pageSize);
  const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

  const results: T[][] = new Array(remainingPages.length);
  let cursor = 0;
  const workerCount = Math.min(FETCH_ALL_CONCURRENCY, remainingPages.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < remainingPages.length) {
      const idx = cursor++;
      const page = remainingPages[idx];
      const res = await fetchPage({ ...params, page });
      results[idx] = res.status === 200 && res.data?.results ? res.data.results : [];
    }
  });
  await Promise.all(workers);

  return [...firstResults, ...results.flat()];
}

export function fetchAllProjects(
  params?: Omit<ProjectsListParams, "page">,
): Promise<KippoProject[]> {
  return fetchAllPaginated(projectsList, { ...params } as ProjectsListParams);
}

export function fetchAllMonthlyAssignments(
  params: Omit<MonthlyAssignmentsListParams, "page">,
): Promise<ProjectMonthlyAssignment[]> {
  return fetchAllPaginated(monthlyAssignmentsList, { ...params } as MonthlyAssignmentsListParams);
}
