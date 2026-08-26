import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { PersonalHoliday } from "~/lib/api/generated/models";

// Regression for issue #133 — a PersonalHoliday with duration > 1 was rendered as a
// single day: both calendars keyed off `h.day` alone, the week slice used start-date
// containment, and the month query filtered on the start date (so a span opening in a
// prior month was never fetched). Each test below fails on the pre-fix code.

const api = vi.hoisted(() => ({
  personalCalls: [] as { day_gte?: string; day_lte?: string }[],
  personalResults: [] as PersonalHoliday[],
}));

vi.mock("~/lib/api/generated/personal-holidays/personal-holidays", () => ({
  personalHolidaysList: vi.fn((params: { day_gte?: string; day_lte?: string }) => {
    api.personalCalls.push(params);
    return Promise.resolve({ data: { results: api.personalResults } });
  }),
  personalHolidaysCreate: vi.fn(() => Promise.resolve({ data: {} })),
}));
vi.mock("~/lib/api/generated/public-holidays/public-holidays", () => ({
  publicHolidaysList: vi.fn(() => Promise.resolve({ data: { results: [] } })),
}));

import { WeekCalendar } from "~/components/weekly-effort/WeekCalendar";
import { HolidayCalendar } from "~/components/weekly-effort/HolidayCalendar";
import { useMonthHolidays } from "~/hooks/useMonthHolidays";

const flush = () => new Promise((r) => setTimeout(r, 30));

function holiday(day: string, duration: number): PersonalHoliday {
  return { id: 1, day, duration, is_half: false } as unknown as PersonalHoliday;
}

/** Day-number cells rendered with the personal-holiday purple treatment. */
function purpleDayNumbers(container: HTMLElement): number[] {
  return Array.from(container.querySelectorAll<HTMLElement>("*"))
    .filter((el) => el.className.includes?.("purple") && /^\d+$/.test(el.textContent ?? ""))
    .map((el) => Number(el.textContent));
}

describe("multi-day personal holidays (#133)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    api.personalCalls = [];
    api.personalResults = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("WeekCalendar highlights every day of the span, not just the first", async () => {
    // Mon 2026-08-03 + 3 days → 08-03, 08-04, 08-05.
    root.render(
      <WeekCalendar
        weekStart="2026-08-03"
        onWeekSelect={() => {}}
        personalHolidays={[holiday("2026-08-03", 3)]}
        publicHolidays={[]}
      />,
    );
    await flush();
    expect(purpleDayNumbers(container)).toEqual([3, 4, 5]);
  });

  test("HolidayCalendar marks the whole span as already taken", async () => {
    root.render(
      <HolidayCalendar
        selectedDate="2026-08-10"
        onDateSelect={() => {}}
        personalHolidays={[holiday("2026-08-03", 3)]}
        publicHolidays={[]}
      />,
    );
    await flush();
    expect(purpleDayNumbers(container)).toEqual([3, 4, 5]);
  });

  test("a span opening in the previous month is fetched and highlighted", async () => {
    // Fri 2026-07-31 + 4 days → 07-31 … 08-03. `day_gte` of 2026-08-01 would miss it.
    api.personalResults = [holiday("2026-07-31", 4)];

    function Probe() {
      const { monthPersonalHolidays } = useMonthHolidays("2026-08-03", true);
      return (
        <WeekCalendar
          weekStart="2026-08-03"
          onWeekSelect={() => {}}
          personalHolidays={monthPersonalHolidays}
          publicHolidays={[]}
        />
      );
    }
    root.render(<Probe />);
    await flush();

    // The query reached back before the month start...
    expect(api.personalCalls.length).toBe(1);
    expect(api.personalCalls[0].day_gte ?? "").not.toBe("");
    expect((api.personalCalls[0].day_gte as string) < "2026-08-01").toBe(true);
    expect(api.personalCalls[0].day_lte).toBe("2026-08-31");

    // ...and the August days it covers are highlighted. 07-31 and 08-01/08-02 fall
    // outside the August grid's current-month cells, leaving 08-01..08-03 — of which
    // only in-month days render, so 1, 2 and 3.
    expect(purpleDayNumbers(container)).toEqual([1, 2, 3]);
  });

  test("the week slice includes a holiday that starts before the week", async () => {
    api.personalResults = [holiday("2026-07-31", 4)];
    const seen: PersonalHoliday[][] = [];

    function Probe() {
      const { weekPersonalHolidays } = useMonthHolidays("2026-08-03", true);
      seen.push(weekPersonalHolidays);
      return null;
    }
    root.render(<Probe />);
    await flush();

    expect(seen[seen.length - 1].map((h) => h.day)).toEqual(["2026-07-31"]);
  });

  test("a holiday that ends before the month is filtered out", async () => {
    api.personalResults = [holiday("2026-06-01", 2)];
    const seen: PersonalHoliday[][] = [];

    function Probe() {
      const { monthPersonalHolidays } = useMonthHolidays("2026-08-03", true);
      seen.push(monthPersonalHolidays);
      return null;
    }
    root.render(<Probe />);
    await flush();

    expect(seen[seen.length - 1]).toEqual([]);
  });
});
