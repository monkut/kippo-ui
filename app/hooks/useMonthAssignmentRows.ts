import { useApiQuery } from "~/hooks/useApiQuery";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { fetchAllMonthlyAssignments } from "~/lib/api/pagination";

export type MonthAssignmentRows = {
  rows: ProjectMonthlyAssignment[];
  isLoading: boolean;
  error: string;
};

const FETCH_ERROR = "割当の取得に失敗しました";
const NO_ROWS: ProjectMonthlyAssignment[] = [];

/** Every assignment row for `month` ("YYYY-MM-01") in the viewer's organizations; nothing is
 * fetched while `month` is null. */
export function useMonthAssignmentRows(month: string | null): MonthAssignmentRows {
  const query = useApiQuery(
    () => fetchAllMonthlyAssignments({ month: month ?? undefined }),
    [month],
    { enabled: !!month },
  );
  return {
    rows: query.data ?? NO_ROWS,
    isLoading: query.isLoading,
    error: query.error ? FETCH_ERROR : "",
  };
}
