import { beforeAll, describe, expect, test } from "vitest";
import {
  addMonths,
  firstOfMonth,
  firstOfNextMonth,
  formatDateKey,
  formatDisplayDate,
  formatMonth,
  lastOfMonth,
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
});
