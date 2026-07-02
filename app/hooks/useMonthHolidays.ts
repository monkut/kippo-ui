import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { personalHolidaysList } from "~/lib/api/generated/personal-holidays/personal-holidays";
import { publicHolidaysList } from "~/lib/api/generated/public-holidays/public-holidays";
import type { PersonalHoliday, PublicHoliday } from "~/lib/api/generated/models";
import { formatDateStr, monthDateRange } from "~/components/weekly-effort/utils";

export type UseMonthHolidaysReturn = {
  monthPersonalHolidays: PersonalHoliday[];
  monthPublicHolidays: PublicHoliday[];
  weekPersonalHolidays: PersonalHoliday[];
  weekPublicHolidays: PublicHoliday[];
  isLoadingMonthHolidays: boolean;
  /** Force a refetch for the given date's month (used after a holiday is created / edited). */
  refresh: (dateStr: string) => Promise<void>;
};

/**
 * Personal + public holidays for the month of the selected week. The week-scoped
 * slices are derived from the month set so navigating within a month never refetches.
 */
export function useMonthHolidays(weekStart: string, enabled: boolean): UseMonthHolidaysReturn {
  const [monthPersonalHolidays, setMonthPersonalHolidays] = useState<PersonalHoliday[]>([]);
  const [monthPublicHolidays, setMonthPublicHolidays] = useState<PublicHoliday[]>([]);
  const [isLoadingMonthHolidays, setIsLoadingMonthHolidays] = useState(false);
  const lastFetchedMonthRef = useRef<string | null>(null);

  const fetchMonthHolidays = useCallback(async (dateStr: string) => {
    setIsLoadingMonthHolidays(true);
    try {
      const { dayGte, dayLte } = monthDateRange(dateStr);

      const [personalRes, publicRes] = await Promise.all([
        personalHolidaysList({ day_gte: dayGte, day_lte: dayLte }),
        publicHolidaysList({ day_gte: dayGte, day_lte: dayLte }),
      ]);

      setMonthPersonalHolidays(personalRes.data?.results || []);
      setMonthPublicHolidays(publicRes.data?.results || []);
      lastFetchedMonthRef.current = dateStr.substring(0, 7);
    } catch {
      setMonthPersonalHolidays([]);
      setMonthPublicHolidays([]);
    } finally {
      setIsLoadingMonthHolidays(false);
    }
  }, []);

  // Fetch on mount and only when the selected week crosses into a new month; the
  // month ref makes same-month week navigation a no-op (no refetch storm, #44).
  useEffect(() => {
    if (!enabled || !weekStart) return;
    if (lastFetchedMonthRef.current === weekStart.substring(0, 7)) return;
    fetchMonthHolidays(weekStart);
  }, [enabled, weekStart, fetchMonthHolidays]);

  const { weekPersonalHolidays, weekPublicHolidays } = useMemo(() => {
    const startDate = new Date(`${weekStart}T00:00:00`);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    const endStr = formatDateStr(endDate);
    return {
      weekPersonalHolidays: monthPersonalHolidays.filter(
        (h) => h.day >= weekStart && h.day <= endStr,
      ),
      weekPublicHolidays: monthPublicHolidays.filter((h) => h.day >= weekStart && h.day <= endStr),
    };
  }, [weekStart, monthPersonalHolidays, monthPublicHolidays]);

  return {
    monthPersonalHolidays,
    monthPublicHolidays,
    weekPersonalHolidays,
    weekPublicHolidays,
    isLoadingMonthHolidays,
    refresh: fetchMonthHolidays,
  };
}
