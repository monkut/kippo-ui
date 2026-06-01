import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createRoot } from "react-dom/client";
import { MonthlyAssignmentsPanel } from "../app/components/weekly-effort/MonthlyAssignmentsPanel";
import type { ProjectMonthlyAssignment } from "../app/lib/api/generated/models";

function makeAssignment(project: string, percentage: number): ProjectMonthlyAssignment {
  return {
    id: project.length,
    project,
    project_name: project,
    user: "u",
    user_username: "me",
    user_display_name: "me",
    user_github_login: "me",
    user_slack_username: null,
    user_slack_image_url: null,
    percentage,
    created_datetime: "2026-06-01T00:00:00Z",
    updated_datetime: "2026-06-01T00:00:00Z",
  };
}

const flush = () => new Promise((r) => setTimeout(r, 20));

describe("MonthlyAssignmentsPanel — cumulative effort tooltip", () => {
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

  test("shows 実績 vs 計画 and the cumulative-effort tooltip on the actual %", async () => {
    root.render(
      <MonthlyAssignmentsPanel
        monthlyAssignments={[makeAssignment("Proj A", 50)]}
        monthHoursByProject={{ "Proj A": 10, Other: 10 }}
        targetMonth="2026-06-01"
      />,
    );
    await flush();

    // 実績 = 10 / (10+10) = 50%, planned = 50%, month label follows targetMonth.
    expect(container.textContent).toContain("実績 50%");
    expect(container.textContent).toContain("50%");
    expect(container.textContent).toContain("2026年06月");

    const actual = container.querySelector(
      '[title="Cumulative Monthly Project Effort Percentage"]',
    );
    expect(actual).not.toBeNull();
    expect(actual?.textContent).toContain("実績 50%");
  });
});
