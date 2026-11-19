import { beforeAll, describe, expect, test } from "vitest";
import {
  addMonths,
  firstOfMonth,
  firstOfNextMonth,
  formatDateKey,
  formatDisplayDate,
  formatMonth,
  lastOfMonth,
  remainingPeriod,
} from "~/lib/dates";

// The unit project (vitest.config.ts) pins TZ=Asia/Tokyo so the local-time
// assertions below are reproducible regardless of the developer's machine.
describe("lib/dates", () => {
  beforeAll(() => {
    expect(new Date().getTimezoneOffset()).toBe(-540);
  });

  describe("formatDateKey", () => {
    test("uses local-date components, not the UTC date (issue #52)", () => {
      // Midnight JST is 15:00 UTC the previous day; toISOString() would roll back a day.
      const midnightJst = new Date(2026, 3, 20, 0, 0, 0);
      expect(formatDateKey(midnightJst)).toBe("2026-04-20");
    });

    test("zero-pads month and day", () => {
      expect(formatDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    });
  });

  describe("formatDisplayDate", () => {
    test("returns '-' for empty values", () => {
      expect(formatDisplayDate(null)).toBe("-");
      expect(formatDisplayDate(undefined)).toBe("-");
      expect(formatDisplayDate("")).toBe("-");
    });

    test("formats a date value in ja-JP", () => {
      expect(formatDisplayDate("2026-02-01")).toBe("2026/2/1");
    });
  });

  describe("month helpers", () => {
    test("formatMonth truncates to YYYY-MM", () => {
      expect(formatMonth("2026-04-01")).toBe("2026-04");
    });

    test("firstOfMonth returns the 1st in local time", () => {
      expect(firstOfMonth(new Date(2026, 3, 20))).toBe("2026-04-01");
    });

    test("addMonths crosses the year boundary", () => {
      expect(addMonths("2026-11-01", 3)).toBe("2027-02-01");
      expect(addMonths("2026-02-01", -3)).toBe("2025-11-01");
    });

    test("firstOfNextMonth advances one month", () => {
      expect(firstOfNextMonth(new Date(2026, 11, 15))).toBe("2027-01-01");
    });

    test("lastOfMonth returns the final calendar day", () => {
      expect(lastOfMonth("2026-02-01")).toBe("2026-02-28");
      expect(lastOfMonth("2028-02-01")).toBe("2028-02-29"); // leap year
      expect(lastOfMonth("2026-04-01")).toBe("2026-04-30");
    });
  });

  describe("remainingPeriod (kiconiaworks/kippo#75 R1)", () => {
    test("starts at the current month when the project already started", () => {
      expect(remainingPeriod("2026-09-15", "2027-01-31", "2026-11-01")).toEqual({
        from: "2026-11-01",
        to: "2027-01-01",
      });
    });

    test("starts at the start_date month when the project starts later", () => {
      expect(remainingPeriod("2027-02-10", "2027-05-31", "2026-11-01")).toEqual({
        from: "2027-02-01",
        to: "2027-05-01",
      });
    });

    test("includes the current month when it is the target month", () => {
      expect(remainingPeriod("2026-01-01", "2026-11-30", "2026-11-01")).toEqual({
        from: "2026-11-01",
        to: "2026-11-01",
      });
    });

    test("returns null when the target month has passed", () => {
      expect(remainingPeriod("2026-01-01", "2026-10-31", "2026-11-01")).toBeNull();
    });

    test("returns null when a date is missing", () => {
      expect(remainingPeriod(null, "2027-01-31", "2026-11-01")).toBeNull();
      expect(remainingPeriod("2026-01-01", undefined, "2026-11-01")).toBeNull();
    });
  });
});
