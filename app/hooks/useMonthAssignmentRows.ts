import { useEffect, useState } from "react";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { fetchAllMonthlyAssignments } from "~/lib/api/pagination";

export type MonthAssignmentRows = {
  rows: ProjectMonthlyAssignment[];
  isLoading: boolean;
  error: string;
};

const FETCH_ERROR = "割当の取得に失敗しました";

/** Every assignment row for `month` ("YYYY-MM-01") in the viewer's organizations; nothing is
 * fetched while `month` is null. */
export function useMonthAssignmentRows(month: string | null): MonthAssignmentRows {
  const [state, setState] = useState<MonthAssignmentRows>({
    rows: [],
    isLoading: false,
    error: "",
  });

  useEffect(() => {
    if (!month) {
      setState({ rows: [], isLoading: false, error: "" });
      return;
    }
    let alive = true;
    setState({ rows: [], isLoading: true, error: "" });
    fetchAllMonthlyAssignments({ month })
      .then((rows) => {
        if (alive) setState({ rows, isLoading: false, error: "" });
      })
      .catch(() => {
        if (alive) setState({ rows: [], isLoading: false, error: FETCH_ERROR });
      });
    return () => {
      alive = false;
    };
  }, [month]);

  return state;
}
