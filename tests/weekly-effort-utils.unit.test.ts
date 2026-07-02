import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { formatDateKey } from "~/lib/dates";
import {
  computeMonthEffortPercents,
  getMonthStart,
  getPreviousWeekStartDate,
} from "~/components/weekly-effort/utils";

// Regression tests for issue #52 — JST/UTC date handling. The unit project in
// vitest.config.ts pins TZ=Asia/Tokyo so these assertions are reproducible.

describe("weekly-effort utils — JST date handling", () => {
  beforeAll(() => {
    // Fail loudly if the TZ pin in vitest.config.ts ever drifts; otherwise these
    // tests would silently pass against the wrong timezone.
    expect(new Date().getTimezoneOffset()).toBe(-540);
  });

  describe("formatDateKey", () => {
    test("returns local-date components, not the UTC date", () => {
      const mondayMidnightJst = new Date(2026, 3, 20, 0, 0, 0);
      expect(formatDateKey(mondayMidnightJst)).toBe("2026-04-20");
    });
  });

  describe("getMonthStart", () => {
    test.each([
      ["mid-month", "2026-06-15", "2026-06-01"],
      ["first day", "2026-06-01", "2026-06-01"],
      ["last day", "2026-06-30", "2026-06-01"],
      // A Monday week_start late in a month resolves to that month, not the next.
      ["late-month Monday", "2026-06-29", "2026-06-01"],
      ["January boundary", "2026-01-05", "2026-01-01"],
    ])("returns the first of the month for %s", (_label, input, expected) => {
      expect(getMonthStart(input)).toBe(expected);
    });
  });

  describe("computeMonthEffortPercents", () => {
    test("zero total yields empty percents", () => {
      expect(computeMonthEffortPercents({}, [])).toEqual({
        percentByProject: {},
        monthTotalHours: 0,
      });
    });

    test("saved-only hours produce each project's share of the month total", () => {
      const { percentByProject, monthTotalHours } = computeMonthEffortPercents(
        { a: 30, b: 10 },
        [],
      );
      expect(monthTotalHours).toBe(40);
      expect(percentByProject).toEqual({ a: 75, b: 25 });
    });

    test("unsaved form entries are added live to the month total", () => {
      const { percentByProject, monthTotalHours } = computeMonthEffortPercents({ a: 20 }, [
        { projectId: "b", hours: 20 },
      ]);
      expect(monthTotalHours).toBe(40);
      expect(percentByProject).toEqual({ a: 50, b: 50 });
    });

    test("a form entry for a project saved THIS week is not double-counted", () => {
      // `a` already has this week's 10h inside monthHoursByProject; re-entering it in
      // the add-entry form must not stack on top (the submit path rejects the dup).
      const { percentByProject, monthTotalHours } = computeMonthEffortPercents(
        { a: 10, b: 10 },
        [{ projectId: "a", hours: 10 }],
        ["a"],
      );
      expect(monthTotalHours).toBe(20);
      expect(percentByProject).toEqual({ a: 50, b: 50 });
    });

    test("a new project not saved this week IS added even if it exists in another week", () => {
      // `a` has 10h from a prior week (in monthHoursByProject) but is NOT in this week's
      // saved set, so the new 10h entry legitimately adds to the month total.
      const { percentByProject, monthTotalHours } = computeMonthEffortPercents(
        { a: 10 },
        [{ projectId: "a", hours: 10 }],
        ["b"],
      );
      expect(monthTotalHours).toBe(20);
      expect(percentByProject).toEqual({ a: 100 });
    });

    test("entries with no project selected are ignored", () => {
      const { monthTotalHours } = computeMonthEffortPercents({ a: 10 }, [
        { projectId: "", hours: 99 },
      ]);
      expect(monthTotalHours).toBe(10);
    });

    test("percentages are rounded to whole numbers", () => {
      const { percentByProject } = computeMonthEffortPercents({ a: 1, b: 2 }, []);
      // 1/3 = 33.33 -> 33, 2/3 = 66.66 -> 67
      expect(percentByProject).toEqual({ a: 33, b: 67 });
    });
  });

  describe("getPreviousWeekStartDate", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test.each([
      ["00:30 JST", new Date(2026, 3, 27, 0, 30, 0), "2026-04-20"],
      ["06:00 JST", new Date(2026, 3, 27, 6, 0, 0), "2026-04-20"],
      ["09:00 JST", new Date(2026, 3, 27, 9, 0, 0), "2026-04-20"],
      ["15:00 JST", new Date(2026, 3, 27, 15, 0, 0), "2026-04-20"],
      ["23:30 JST", new Date(2026, 3, 27, 23, 30, 0), "2026-04-20"],
    ])("returns the correct Monday at %s", (_label, now, expected) => {
      vi.setSystemTime(now);
      expect(getPreviousWeekStartDate()).toBe(expected);
    });

    test("on Friday 2026-04-24, returns Monday 2026-04-13 of the previous full week", () => {
      vi.setSystemTime(new Date(2026, 3, 24, 17, 0, 0));
      expect(getPreviousWeekStartDate()).toBe("2026-04-13");
    });
  });
});
