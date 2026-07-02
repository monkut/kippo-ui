import { formatDateKey } from "~/lib/dates";
import type { KippoProject } from "~/lib/api/generated/models";
import type { FormEntry } from "./types";

/** Convert full-width digits (０-９) to half-width (0-9) and strip non-numeric characters */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, "");
}

export function getPreviousWeekStartDate(): string {
  // Matches kippo's previous_week_startdate() logic from projects/functions.py
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 5);
  // Python weekday(): Monday=0, JS getDay(): Monday=1
  while (lastWeek.getDay() !== 1) {
    lastWeek.setDate(lastWeek.getDate() - 1);
  }
  return formatDateKey(lastWeek);
}

/** First day (YYYY-MM-DD) of the month containing `dateStr`. */
export function getMonthStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function monthDateRange(dateStr: string): { dayGte: string; dayLte: string } {
  const d = new Date(`${dateStr}T00:00:00`);
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { dayGte: formatDateKey(firstDay), dayLte: formatDateKey(lastDay) };
}

/**
 * Returns a date range covering the previous week and the given week.
 * Range: weekStart - 7 days ... weekStart + 6 days (inclusive).
 */
export function twoWeekWindow(weekStart: string): { gte: string; lte: string } {
  const d = new Date(`${weekStart}T00:00:00`);
  const gte = new Date(d);
  gte.setDate(gte.getDate() - 7);
  const lte = new Date(d);
  lte.setDate(lte.getDate() + 6);
  return { gte: formatDateKey(gte), lte: formatDateKey(lte) };
}

/**
 * Live per-project share of the TARGET month's cumulative effort.
 *
 * Combines the saved month hours with the current (unsaved) form entries so the
 * percentage updates as the user types. Form entries whose project is already
 * saved in the selected week are skipped: those hours are already included in
 * `monthHoursByProject`, and re-entering such a project is a duplicate the
 * submit path rejects — adding it here would double-count the week.
 */
export function computeMonthEffortPercents(
  monthHoursByProject: Record<string, number>,
  formEntries: ReadonlyArray<{ projectId: string; hours: number }>,
  savedWeekProjectIds: Iterable<string> = [],
): { percentByProject: Record<string, number>; monthTotalHours: number } {
  const savedThisWeek = new Set(savedWeekProjectIds);
  const live: Record<string, number> = { ...monthHoursByProject };
  for (const entry of formEntries) {
    if (entry.projectId && !savedThisWeek.has(entry.projectId)) {
      live[entry.projectId] = (live[entry.projectId] || 0) + entry.hours;
    }
  }
  const monthTotalHours = Object.values(live).reduce((sum, h) => sum + h, 0);
  const percentByProject: Record<string, number> = {};
  if (monthTotalHours > 0) {
    for (const [projectId, hours] of Object.entries(live)) {
      percentByProject[projectId] = Math.round((hours / monthTotalHours) * 100);
    }
  }
  return { percentByProject, monthTotalHours };
}

export function isProjectOpenForWeek(
  project: KippoProject | undefined,
  weekStart: string,
): boolean {
  if (!project?.closed_datetime) return true;
  return weekStart <= project.closed_datetime.split("T")[0];
}

export function createEmptyEntry(filterType: "project" | "anon-project" = "project"): FormEntry {
  return {
    id: Date.now(),
    projectId: "",
    projectName: "",
    hours: 0,
    filterType,
  };
}
