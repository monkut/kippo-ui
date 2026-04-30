import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { formatDateStr, getPreviousWeekStartDate } from "~/components/weekly-effort/utils";

// Regression tests for issue #52 — JST/UTC date handling. The unit project in
// vitest.config.ts pins TZ=Asia/Tokyo so these assertions are reproducible.

describe("weekly-effort utils — JST date handling", () => {
  beforeAll(() => {
    // Fail loudly if the TZ pin in vitest.config.ts ever drifts; otherwise these
    // tests would silently pass against the wrong timezone.
    expect(new Date().getTimezoneOffset()).toBe(-540);
  });

  describe("formatDateStr", () => {
    test("returns local-date components, not the UTC date", () => {
      const mondayMidnightJst = new Date(2026, 3, 20, 0, 0, 0);
      expect(formatDateStr(mondayMidnightJst)).toBe("2026-04-20");
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
