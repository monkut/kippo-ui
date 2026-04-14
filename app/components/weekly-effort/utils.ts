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
  return lastWeek.toISOString().split("T")[0];
}

export function getCurrentMonthStart(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
}

export function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
