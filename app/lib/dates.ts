// Shared date helpers. Two families live here:
//  - display formatting for the user (ja-JP locale strings)
//  - date-key formatting for API params / lexical comparison (LOCAL YYYY-MM-DD)
// plus the month-window helpers used by the assignments UIs.

/** Format a datetime/date value for display in ja-JP locale, or "-" when empty. */
export function formatDisplayDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString("ja-JP") : "-";
}

// Format a Date as YYYY-MM-DD using local-time components.
// `toISOString()` would return the UTC date, which is one day earlier than
// the local date for any time before 09:00 in JST (UTC+9) — see issue #52.
export function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-04-01" → "2026-04". */
export function formatMonth(month: string): string {
  return month.slice(0, 7);
}

export function firstOfMonth(reference: Date): string {
  const year = reference.getFullYear();
  const month = (reference.getMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}-01`;
}

export function addMonths(monthStart: string, delta: number): string {
  const [yearStr, monthStr] = monthStart.split("-");
  const totalMonths = Number(yearStr) * 12 + (Number(monthStr) - 1) + delta;
  const year = Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 1).toString().padStart(2, "0");
  return `${year}-${month}-01`;
}

export function firstOfNextMonth(reference: Date): string {
  return addMonths(firstOfMonth(reference), 1);
}

/** Last calendar day of the month containing `monthStart` ("YYYY-MM-01"), as
 * an ISO date string "YYYY-MM-DD". `new Date(year, month+1, 0)` gives the
 * last day of `month` (0-th day of the next month). */
export function lastOfMonth(monthStart: string): string {
  const [yearStr, monthStr] = monthStart.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-indexed
  const last = new Date(year, month, 0);
  const dayStr = last.getDate().toString().padStart(2, "0");
  return `${year}-${monthStr}-${dayStr}`;
}
