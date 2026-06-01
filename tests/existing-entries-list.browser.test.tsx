import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { ExistingEntriesList } from "../app/components/weekly-effort/ExistingEntriesList";
import type { ProjectWeeklyEffort } from "../app/lib/api/generated/models";

vi.mock("~/lib/api/generated/personal-holidays/personal-holidays", () => ({
  personalHolidaysCreate: vi.fn(() => Promise.resolve({ data: {} })),
}));

function weekEntry(project: string, hours: number): ProjectWeeklyEffort {
  return {
    id: project.length,
    week_start: "2026-05-25",
    project,
    project_name: project,
    user: "u",
    user_username: "me",
    user_display_name: "me",
    hours,
    created_datetime: "2026-05-25T00:00:00Z",
    updated_datetime: "2026-05-25T00:00:00Z",
  };
}

const flush = () => new Promise((r) => setTimeout(r, 20));

describe("ExistingEntriesList — month-only projects shown with '-'", () => {
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

  test("lists projects with month effort but no entry this week, effort shown as '-'", async () => {
    root.render(
      <ExistingEntriesList
        selectedWeekEntries={[weekEntry("Week Proj", 5)]}
        monthOnlyProjects={[{ project: "p2", project_name: "Month Only Proj" }]}
        weekStart="2026-05-25"
        isSubmitting={false}
        onUpdateHours={() => Promise.resolve(true)}
        onDelete={() => Promise.resolve(true)}
        onAddEntry={() => {}}
        onHolidayCreated={() => {}}
      />,
    );
    await flush();

    // The week's real entry renders with its hours.
    expect(container.textContent).toContain("Week Proj");
    expect(container.textContent).toContain("5");

    // The month-only project renders as a read-only "-" row.
    const placeholder = container.querySelector(
      '[title="今月の累計には含まれますが、この週の入力はありません"]',
    );
    expect(placeholder).not.toBeNull();
    expect(placeholder?.textContent).toContain("Month Only Proj");
    expect(placeholder?.textContent).toContain("-");

    // The "-" row contributes nothing to the weekly total.
    expect(container.textContent).toContain("合計");
    expect(container.textContent).toContain("5 時間");
  });
});
