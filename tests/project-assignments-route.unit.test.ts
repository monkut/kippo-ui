import { describe, expect, test } from "vitest";
import { isEditableMonth } from "../app/routes/project-assignments";

// #22 — cells are clickable only when displayed_month >= firstOfMonth(today).
// Past months stay read-only with a `過去月のためロック` tooltip.

describe("isEditableMonth (#22)", () => {
  // Pin "today" to mid-month so the boundary cases below don't depend on the
  // wall-clock date when the test runs.
  const today = new Date(2026, 4, 15); // 2026-05-15 (local time)

  test("current month is editable", () => {
    expect(isEditableMonth("2026-05-01", today)).toBe(true);
  });

  test("future month is editable", () => {
    expect(isEditableMonth("2026-06-01", today)).toBe(true);
    expect(isEditableMonth("2027-01-01", today)).toBe(true);
  });

  test("past month (previous) is NOT editable", () => {
    expect(isEditableMonth("2026-04-01", today)).toBe(false);
  });

  test("past month (last year) is NOT editable", () => {
    expect(isEditableMonth("2025-05-01", today)).toBe(false);
    expect(isEditableMonth("2025-12-01", today)).toBe(false);
  });

  test("today's literal date (first of current month) is editable", () => {
    // Edge: today === firstOfMonth(today) → still editable.
    const firstOfMay = new Date(2026, 4, 1);
    expect(isEditableMonth("2026-05-01", firstOfMay)).toBe(true);
  });

  test("last day of the month — current month still editable", () => {
    const lastDayOfMay = new Date(2026, 4, 31);
    expect(isEditableMonth("2026-05-01", lastDayOfMay)).toBe(true);
    expect(isEditableMonth("2026-04-01", lastDayOfMay)).toBe(false);
  });
});
