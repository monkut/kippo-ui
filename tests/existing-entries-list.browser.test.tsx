import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ExistingEntriesList } from "../app/components/weekly-effort/ExistingEntriesList";
import type { ProjectWeeklyEffort } from "../app/lib/api/generated/models";

vi.mock("~/lib/api/generated/personal-holidays/personal-holidays", () => ({
  personalHolidaysCreate: vi.fn(() => Promise.resolve({ data: {} })),
}));

function weekEntry(project: string, projectName: string, hours: number): ProjectWeeklyEffort {
  return {
    id: project.length,
    week_start: "2026-05-25",
    project,
    project_name: projectName,
    user: "u",
    user_username: "me",
    user_display_name: "me",
    hours,
    is_closed: false,
    created_datetime: "2026-05-25T00:00:00Z",
    updated_datetime: "2026-05-25T00:00:00Z",
  };
}

const flush = () => new Promise((r) => setTimeout(r, 20));

describe("ExistingEntriesList — month-only projects + cumulative monthly %", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("rows show the cumulative monthly % (incl. '-' month-only rows) with weekly+cumulative tooltip", async () => {
    // Week total = 5h. Month totals: p1=5h, p2=15h → month total 20h → p1 25%, p2 75%.
    root.render(
      <ExistingEntriesList
        selectedWeekEntries={[weekEntry("p1", "Week Proj", 5)]}
        monthOnlyProjects={[{ project: "p2", project_name: "Month Only Proj" }]}
        monthHoursByProject={{ p1: 5, p2: 15 }}
        weekStart="2026-05-25"
        isSubmitting={false}
        onUpdateHours={() => Promise.resolve(true)}
        onDelete={() => Promise.resolve(true)}
        onAddEntry={() => {}}
        onHolidayCreated={() => {}}
      />,
    );
    await flush();

    // The week's real entry shows its hours and the CUMULATIVE monthly % (25%), not weekly (100%).
    const weekRow = container.querySelector(
      '[title="Weekly: 5h (100%) · Cumulative monthly: 5h (25%)"]',
    );
    expect(weekRow).not.toBeNull();
    expect(weekRow?.textContent).toContain("Week Proj");
    expect(weekRow?.textContent).toContain("5");
    expect(weekRow?.textContent).toContain("(25%)");

    // The month-only project renders with "-" hours, its cumulative % (75%), and no weekly value.
    const monthRow = container.querySelector('[title="Weekly: — · Cumulative monthly: 15h (75%)"]');
    expect(monthRow).not.toBeNull();
    expect(monthRow?.textContent).toContain("Month Only Proj");
    expect(monthRow?.textContent).toContain("-");
    expect(monthRow?.textContent).toContain("(75%)");

    // The "-" row contributes nothing to the weekly total.
    expect(container.textContent).toContain("合計");
    expect(container.textContent).toContain("5 時間");
  });

  test("month-only rows render above the week's entries, each group ordered by cumulative % desc", async () => {
    // Month totals: pa=10, pb=30, pc=20, pd=40 → total 100h → 10/30/20/40%.
    // Week entries: pa(10%), pb(30%) → expect pb before pa.
    // Month-only: pc(20%), pd(40%) → expect pd before pc, and both above the week rows.
    root.render(
      <ExistingEntriesList
        selectedWeekEntries={[weekEntry("pa", "Week A", 1), weekEntry("pb", "Week B", 3)]}
        monthOnlyProjects={[
          { project: "pc", project_name: "Month C" },
          { project: "pd", project_name: "Month D" },
        ]}
        monthHoursByProject={{ pa: 10, pb: 30, pc: 20, pd: 40 }}
        weekStart="2026-05-25"
        isSubmitting={false}
        onUpdateHours={() => Promise.resolve(true)}
        onDelete={() => Promise.resolve(true)}
        onAddEntry={() => {}}
        onHolidayCreated={() => {}}
      />,
    );
    await flush();

    const names = [...container.querySelectorAll(".truncate")].map((el) => el.textContent);
    // Month-only (desc): Month D (40%), Month C (20%); then week (desc): Week B (30%), Week A (10%).
    expect(names).toEqual(["Month D", "Month C", "Week B", "Week A"]);
  });
});
