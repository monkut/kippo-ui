import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectWeeklyEffort } from "~/lib/api/generated/models";
import { fetchAllWeeklyEfforts } from "~/lib/api/pagination";
import {
  buildYearlyEffortMatrix,
  yearDateRange,
  type YearlyEffortMatrix,
} from "~/lib/yearly-effort";

/** kippo's CustomPageNumberPagination max_page_size — one request covers most years. */
const MAX_PAGE_SIZE = 200;

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
  const [entries, setEntries] = useState<ProjectWeeklyEffort[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  // Last request wins: a slow response for a previous year cannot overwrite the current one.
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!enabled || !username) return;
    const requestId = ++requestSeqRef.current;
    const { gte, lte } = yearDateRange(year);
    setIsLoading(true);
    setError("");
    fetchAllWeeklyEfforts({
      user_username: username,
      week_start_gte: gte,
      week_start_lte: lte,
      page_size: MAX_PAGE_SIZE,
    })
      .then((rows) => {
        if (requestId === requestSeqRef.current) setEntries(rows);
      })
      .catch(() => {
        if (requestId === requestSeqRef.current) {
          setEntries([]);
          setError("稼働実績を取得できませんでした。再読み込みしてください。");
        }
      })
      .finally(() => {
        if (requestId === requestSeqRef.current) setIsLoading(false);
      });
  }, [year, username, enabled]);

  const matrix = useMemo(() => buildYearlyEffortMatrix(entries), [entries]);

  return { isLoading, error, matrix };
}
