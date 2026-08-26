// Personal-holiday span helpers.
//
// `PersonalHoliday.duration` is INCLUSIVE of `day`: a holiday covers
// `day` … `day + duration - 1` (kippo `accounts/models.py`). Every consumer
// that renders or slices holidays must expand that span — keying off `day`
// alone hides days 2..N (monkut/kippo-ui#133).
//
// All arithmetic goes through local-time `Date` + `formatDateKey`; `toISOString()`
// would shift the date a day earlier for any JST time before 09:00 (#52).

import type { PersonalHoliday } from "~/lib/api/generated/models";
import { formatDateKey } from "~/lib/dates";

/**
 * How far before the requested window to widen a personal-holiday query.
 *
 * The API filters `day_gte` / `day_lte` on the holiday's START date, so a span
 * beginning before the window is not returned at all and its covered days
 * cannot be rendered. Backing the lower bound off by this many days recovers
 * any holiday whose span reaches into the window. Holidays are per-user and
 * few, so the extra rows are negligible; results are re-filtered client-side
 * by actual overlap.
 */
export const PERSONAL_HOLIDAY_LOOKBACK_DAYS = 60;

/** Duration normalized to at least 1 day — `duration` is optional in the API type. */
function holidayDuration(holiday: PersonalHoliday): number {
  return Math.max(1, holiday.duration ?? 1);
}

/** Date key (YYYY-MM-DD) of a holiday's LAST covered day, inclusive. */
export function personalHolidayEndKey(holiday: PersonalHoliday): string {
  const end = new Date(`${holiday.day}T00:00:00`);
  end.setDate(end.getDate() + holidayDuration(holiday) - 1);
  return formatDateKey(end);
}

/** Every date key covered by the given holidays, spans expanded. */
export function expandPersonalHolidayDates(holidays: PersonalHoliday[]): Set<string> {
  const dates = new Set<string>();
  for (const holiday of holidays) {
    const current = new Date(`${holiday.day}T00:00:00`);
    for (let offset = 0; offset < holidayDuration(holiday); offset += 1) {
      dates.add(formatDateKey(current));
      current.setDate(current.getDate() + 1);
    }
  }
  return dates;
}

/** True when the holiday's span intersects `[rangeStart, rangeEnd]` (inclusive date keys). */
export function personalHolidayOverlaps(
  holiday: PersonalHoliday,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  return holiday.day <= rangeEnd && personalHolidayEndKey(holiday) >= rangeStart;
}

/** Holidays whose span intersects `[rangeStart, rangeEnd]`, start-date order preserved. */
export function personalHolidaysOverlapping(
  holidays: PersonalHoliday[],
  rangeStart: string,
  rangeEnd: string,
): PersonalHoliday[] {
  return holidays.filter((h) => personalHolidayOverlaps(h, rangeStart, rangeEnd));
}

/**
 * Widened query bounds for a personal-holiday list call, so spans starting
 * before `dayGte` are still returned. See {@link PERSONAL_HOLIDAY_LOOKBACK_DAYS}.
 */
export function personalHolidayQueryRange(
  dayGte: string,
  dayLte: string,
): { dayGte: string; dayLte: string } {
  const start = new Date(`${dayGte}T00:00:00`);
  start.setDate(start.getDate() - PERSONAL_HOLIDAY_LOOKBACK_DAYS);
  return { dayGte: formatDateKey(start), dayLte };
}

/**
 * Short label for a holiday span, e.g. "08-03" or "08-03 〜 08-05".
 * Month-day only — the calendar alongside it already establishes the year.
 */
export function formatPersonalHolidaySpan(holiday: PersonalHoliday): string {
  const start = holiday.day.substring(5);
  if (holidayDuration(holiday) <= 1) return start;
  return `${start} 〜 ${personalHolidayEndKey(holiday).substring(5)}`;
}
