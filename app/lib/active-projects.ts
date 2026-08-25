import type { KippoProject } from "~/lib/api/generated";
import { PhaseEnum } from "~/lib/api/generated";
import { projectsList } from "~/lib/api/generated";
import { readList } from "~/lib/api/read-list";

/** Category dropped from the active list, matching the admin's CategoryExcludeListFilter default. */
export const NON_PROJECT_CATEGORY = "non-project";

/**
 * Phases the ActiveKippoProjectAdmin changelist shows when its フェーズ filter has no query
 * param — kippo's `DEFAULT_ACTIVE_PROJECT_PHASES` (projects/models.py).
 *
 * 完了 is included deliberately: the active queryset already drops closed projects, so the only
 * 完了 rows this surfaces are ones stamped 完了 without being closed.
 *
 * TODO: kippo gained a repeatable `phase` query param (kiconiaworks/kippo#56); once that release
 * is picked up by `pnpm update:api`, pass these to projectsList and drop the client-side filter.
 */
export const ACTIVE_PROJECT_PHASES: readonly string[] = [
  PhaseEnum["verbal-order"],
  PhaseEnum["under-contract"],
  PhaseEnum.completed,
];

/** Page size for the active-project fetch — kippo's CustomPageNumberPagination max_page_size. */
const MAX_PAGE_SIZE = 200;

/**
 * Ordering used by ActiveKippoProjectAdmin.get_ordering(): confidence descending, then
 * 完了予定日 ascending (nulls last), then name.
 *
 * The admin's leading `non-project`-first Case is intentionally omitted — 非案件 rows are
 * excluded from this list entirely, so the key can never apply.
 */
export function compareActiveProjects(a: KippoProject, b: KippoProject): number {
  const confidenceA = a.confidence ?? 0;
  const confidenceB = b.confidence ?? 0;
  if (confidenceB !== confidenceA) return confidenceB - confidenceA;

  // target_date ascending, nulls last (Postgres ASC default, which the admin relies on)
  if (a.target_date && b.target_date) {
    const dateCompare = a.target_date.localeCompare(b.target_date);
    if (dateCompare !== 0) return dateCompare;
  } else if (a.target_date) {
    return -1;
  } else if (b.target_date) {
    return 1;
  }

  return a.name.localeCompare(b.name);
}

/** Rows the ActiveKippoProjectAdmin changelist shows, in its default order. */
export function selectActiveProjects(projects: KippoProject[]): KippoProject[] {
  return projects
    .filter(
      (project) =>
        project.display_as_active === true &&
        project.is_closed === false &&
        ACTIVE_PROJECT_PHASES.includes(project.phase ?? ""),
    )
    .sort(compareActiveProjects);
}

/**
 * Fetch every active project, then apply the admin's default filters and ordering.
 *
 * The list endpoint is paginated (50 by default, 200 max), so a single request silently
 * truncated the list — and because the API orders by -created_datetime, the surviving rows
 * bore no relation to the admin's ordering. Pages are followed to exhaustion so the sort
 * below runs over the complete set (kiconiaworks/kippo#56).
 */
export async function fetchActiveProjects(): Promise<KippoProject[]> {
  const rows: KippoProject[] = [];
  let page = 1;
  while (true) {
    const response = await projectsList({
      is_active: true,
      exclude_category: NON_PROJECT_CATEGORY,
      page,
      page_size: MAX_PAGE_SIZE,
    });
    rows.push(...readList<KippoProject>(response.data));
    if (!response.data?.next) break;
    page += 1;
  }
  return selectActiveProjects(rows);
}
