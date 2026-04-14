import type { KippoProject, ProjectsListParams } from "./generated/models";
import { projectsList } from "./generated/projects/projects";

const FETCH_ALL_PROJECTS_CONCURRENCY = 5;

/**
 * Fetches all pages from the projects API endpoint.
 * Awaits the first page, computes the remaining page count from the server-reported
 * `count`, then fans out the remaining pages through a capped worker pool so order
 * is preserved and in-flight requests stay bounded.
 */
export async function fetchAllProjects(
  params?: Omit<ProjectsListParams, "page">,
): Promise<KippoProject[]> {
  const first = await projectsList({ ...params, page: 1 });
  if (first.status !== 200 || !first.data?.results) return [];

  const firstResults = first.data.results;
  const count = first.data.count ?? firstResults.length;
  const pageSize = firstResults.length;
  if (!pageSize || count <= pageSize) return firstResults;

  const totalPages = Math.ceil(count / pageSize);
  const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

  const results: KippoProject[][] = new Array(remainingPages.length);
  let cursor = 0;
  const workerCount = Math.min(FETCH_ALL_PROJECTS_CONCURRENCY, remainingPages.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < remainingPages.length) {
      const idx = cursor++;
      const page = remainingPages[idx];
      const res = await projectsList({ ...params, page });
      results[idx] = res.status === 200 && res.data?.results ? res.data.results : [];
    }
  });
  await Promise.all(workers);

  return [...firstResults, ...results.flat()];
}
