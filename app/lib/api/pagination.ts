import type { KippoProject, ProjectsListParams } from "./generated/models";
import { projectsList } from "./generated/projects/projects";

/**
 * Fetches all pages from the projects API endpoint.
 * The API returns paginated results, so this function iterates through all pages
 * and combines the results into a single array.
 */
export async function fetchAllProjects(
  params?: Omit<ProjectsListParams, "page">,
): Promise<KippoProject[]> {
  const allProjects: KippoProject[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await projectsList({ ...params, page });

    if (response.status === 200 && response.data?.results) {
      allProjects.push(...response.data.results);
      hasMore = response.data.next !== null && response.data.next !== undefined;
      page += 1;
    } else {
      hasMore = false;
    }
  }

  return allProjects;
}
