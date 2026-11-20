import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { firstOfMonth, formatMonth, monthFromParam } from "~/lib/dates";

export const MONTH_SEARCH_PARAM = "month";

/** The displayed month, kept in the URL as `?month=YYYY-MM` so the page link can be copied and
 * shared (same format as the billing page's deep link). Without a valid param the current month is
 * shown. Changing the month replaces the history entry, so ◀ / ▶ do not pile up back-button steps.
 *
 * Returns the first-of-month ISO date ("YYYY-MM-01") and its setter. */
export function useMonthSearchParam(): [string, (month: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const month = monthFromParam(searchParams.get(MONTH_SEARCH_PARAM)) ?? firstOfMonth(new Date());
  const setMonth = useCallback(
    (next: string) =>
      setSearchParams(
        (previous) => {
          const params = new URLSearchParams(previous);
          params.set(MONTH_SEARCH_PARAM, formatMonth(next));
          return params;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  return [month, setMonth];
}
