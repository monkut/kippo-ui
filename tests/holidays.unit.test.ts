import { beforeAll, describe, expect, test } from "vitest";
import type { PersonalHoliday } from "~/lib/api/generated/models";
import {
  PERSONAL_HOLIDAY_LOOKBACK_DAYS,
  expandPersonalHolidayDates,
  formatPersonalHolidaySpan,
  personalHolidayEndKey,
  personalHolidayOverlaps,
  personalHolidayQueryRange,
  personalHolidaysOverlapping,
} from "~/lib/holidays";

// Regression tests for issue #133 — multi-day personal holidays were treated as a
// single day everywhere in the UI. `duration` is INCLUSIVE of `day`: a holiday
// covers `day` … `day + duration - 1`.

function holiday(day: string, duration?: number, isHalf = false): PersonalHoliday {
  return { id: 1, day, duration, is_half: isHalf } as unknown as PersonalHoliday;
}

describe("personal-holiday span helpers", () => {
  beforeAll(() => {
    // The unit project pins TZ=Asia/Tokyo; these assertions depend on local-date
    // arithmetic staying in JST (#52).
    expect(new Date().getTimezoneOffset()).toBe(-540);
  });

  describe("personalHolidayEndKey", () => {
    test("duration is inclusive of the start day", () => {
      expect(personalHolidayEndKey(holiday("2026-08-03", 3))).toBe("2026-08-05");
    });

    test("duration 1 ends on the start day", () => {
      expect(personalHolidayEndKey(holiday("2026-08-03", 1))).toBe("2026-08-03");
    });

    test("missing duration is treated as 1", () => {
      expect(personalHolidayEndKey(holiday("2026-08-03"))).toBe("2026-08-03");
    });

    test("spans a month boundary", () => {
      expect(personalHolidayEndKey(holiday("2026-07-30", 5))).toBe("2026-08-03");
    });

    test("non-positive duration does not run backwards", () => {
      expect(personalHolidayEndKey(holiday("2026-08-03", 0))).toBe("2026-08-03");
    });
  });

  describe("expandPersonalHolidayDates", () => {
    test("emits every covered day, not just the start", () => {
      expect([...expandPersonalHolidayDates([holiday("2026-08-03", 3)])].sort()).toEqual([
        "2026-08-03",
        "2026-08-04",
        "2026-08-05",
      ]);
    });

    test("expands across a month boundary", () => {
      expect([...expandPersonalHolidayDates([holiday("2026-07-30", 4)])].sort()).toEqual([
        "2026-07-30",
        "2026-07-31",
        "2026-08-01",
        "2026-08-02",
      ]);
    });

    test("merges overlapping spans without duplicates", () => {
      const dates = expandPersonalHolidayDates([
        holiday("2026-08-03", 3),
        holiday("2026-08-05", 2),
      ]);
      expect([...dates].sort()).toEqual(["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06"]);
    });

    test("empty input yields an empty set", () => {
      expect(expandPersonalHolidayDates([]).size).toBe(0);
    });
  });

  describe("personalHolidayOverlaps", () => {
    const week = ["2026-08-03", "2026-08-09"] as const;

    test("a span starting before the week but reaching into it overlaps", () => {
      // Fri 07-31 + 4 days → 07-31..08-03, so it consumes Monday of this week.
      expect(personalHolidayOverlaps(holiday("2026-07-31", 4), ...week)).toBe(true);
    });

    test("a span ending before the week does not overlap", () => {
      expect(personalHolidayOverlaps(holiday("2026-07-28", 3), ...week)).toBe(false);
    });

    test("a span starting after the week does not overlap", () => {
      expect(personalHolidayOverlaps(holiday("2026-08-10", 2), ...week)).toBe(false);
    });

    test("boundaries are inclusive on both ends", () => {
      expect(personalHolidayOverlaps(holiday("2026-08-09", 1), ...week)).toBe(true);
      expect(personalHolidayOverlaps(holiday("2026-08-01", 3), ...week)).toBe(true);
    });
  });

  describe("personalHolidaysOverlapping", () => {
    test("keeps only intersecting holidays, in input order", () => {
      const kept = personalHolidaysOverlapping(
        [holiday("2026-07-20", 2), holiday("2026-07-31", 4), holiday("2026-08-05", 1)],
        "2026-08-03",
        "2026-08-09",
      );
      expect(kept.map((h) => h.day)).toEqual(["2026-07-31", "2026-08-05"]);
    });
  });

  describe("personalHolidayQueryRange", () => {
    test("backs the lower bound off so earlier-starting spans are returned", () => {
      const { dayGte, dayLte } = personalHolidayQueryRange("2026-08-01", "2026-08-31");
      expect(dayLte).toBe("2026-08-31");
      const backedOff = new Date("2026-08-01T00:00:00");
      backedOff.setDate(backedOff.getDate() - PERSONAL_HOLIDAY_LOOKBACK_DAYS);
      expect(dayGte).toBe(
        `${backedOff.getFullYear()}-${String(backedOff.getMonth() + 1).padStart(2, "0")}-${String(
          backedOff.getDate(),
        ).padStart(2, "0")}`,
      );
      expect(dayGte < "2026-08-01").toBe(true);
    });
  });

  describe("formatPersonalHolidaySpan", () => {
    test("single day renders one date", () => {
      expect(formatPersonalHolidaySpan(holiday("2026-08-03", 1))).toBe("08-03");
    });

    test("multi-day renders the inclusive range", () => {
      expect(formatPersonalHolidaySpan(holiday("2026-08-03", 3))).toBe("08-03 〜 08-05");
    });
  });
});
