import { useMemo } from "react";
import { useApiQuery } from "~/hooks/useApiQuery";
import type { ProjectWeeklyEffort } from "~/lib/api/generated/models";
import { fetchAllWeeklyEfforts } from "~/lib/api/pagination";
import {
  buildYearlyEffortMatrix,
  yearDateRange,
  type YearlyEffortMatrix,
} from "~/lib/yearly-effort";

/** kippo's CustomPageNumberPagination max_page_size — one request covers most years. */
const MAX_PAGE_SIZE = 200;
const NO_ENTRIES: ProjectWeeklyEffort[] = [];

export type UseYearlyEffortReturn = {
  isLoading: boolean;
  error: string;
  matrix: YearlyEffortMatrix;
};

/** The logged-in user's registered weekly effort for `year`, grouped project × month. */
export function useYearlyEffort(
  year: number,
  username: string | undefined,
  enabled: boolean,
): UseYearlyEffortReturn {
  const active = enabled && !!username;
  // Last request wins: a slow response for a previous year cannot overwrite the current one.
  const query = useApiQuery(
    () => {
      const { gte, lte } = yearDateRange(year);
      return fetchAllWeeklyEfforts({
        user_username: username,
        week_start_gte: gte,
        week_start_lte: lte,
        page_size: MAX_PAGE_SIZE,
      });
    },
    [year, username, enabled],
    { enabled: active, keepPreviousData: true },
  );
  const entries = query.data ?? NO_ENTRIES;
  const isLoading = !active || query.isLoading;
  const error = query.error ? "稼働実績を取得できませんでした。再読み込みしてください。" : "";

  const matrix = useMemo(() => buildYearlyEffortMatrix(entries), [entries]);

  return { isLoading, error, matrix };
}
