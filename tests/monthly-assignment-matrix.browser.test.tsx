import { afterEach, beforeEach, describe, expect, test } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { MonthlyAssignmentMatrix } from "../app/components/project-assignments/MonthlyAssignmentMatrix";
import type {
  KippoProject,
  OrganizationMemberDetail,
  ProjectMonthlyAssignment,
} from "../app/lib/api/generated/models";

// Regression / behaviour tests for kiconiaworks/kippo#21 (F4 + F5):
// - F4: unconfirmed cells render with the new gray palette.
// - F5: `hideUnassigned` prop hides member columns with zero monthly total.

function makeProject(over: Partial<KippoProject> = {}): KippoProject {
  return {
    id: "p-1",
    name: "Project 1",
    start_date: "2026-01-01",
    target_date: "2026-12-31",
    ...over,
  } as unknown as KippoProject;
}

function makeMember(over: Partial<OrganizationMemberDetail>): OrganizationMemberDetail {
  return {
    user_id: "u-1",
    username: "alice",
    display_name: "Alice",
    first_name: "alice",
    last_name: "doe",
    email: "alice@example.com",
    github_login: "alice-gh",
    is_developer: true,
    is_project_manager: false,
    slack_username: "",
    slack_user_id: "",
    slack_image_url: "",
    available_work_days: 20,
    ...over,
  };
}

function makeAssignment(over: Partial<ProjectMonthlyAssignment>): ProjectMonthlyAssignment {
  return {
    id: 1,
    project: "p-1",
    project_name: "Project 1",
    user: "u-1",
    user_username: "alice",
    user_display_name: "Alice",
    user_github_login: "alice-gh",
    user_slack_username: null,
    user_slack_image_url: null,
    month: "2026-05-01",
    percentage: 50,
    is_confirmed: true,
    created_datetime: "2026-05-08T00:00:00Z",
    updated_datetime: "2026-05-08T00:00:00Z",
    ...over,
  };
}

async function waitFor<T>(probe: () => T | null | undefined, timeout = 2000): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = probe();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

function renderMatrix(
  root: ReturnType<typeof createRoot>,
  props: React.ComponentProps<typeof MonthlyAssignmentMatrix>,
) {
  root.render(
    <MemoryRouter>
      <MonthlyAssignmentMatrix {...props} />
    </MemoryRouter>,
  );
}

describe("MonthlyAssignmentMatrix — #21 F4: unconfirmed cell styling", () => {
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

  test("unconfirmed cell renders gray (bg-gray-50 + dashed gray border)", async () => {
    renderMatrix(root, {
      projects: [makeProject()],
      assignments: [makeAssignment({ percentage: 25, is_confirmed: false })],
      members: [makeMember({ user_id: "u-1", display_name: "Alice" })],
    });

    const cell = await waitFor(() => container.querySelector<HTMLSpanElement>("td span"));
    expect(cell?.textContent).toContain("25%");
    expect(cell?.className).toContain("bg-gray-50");
    expect(cell?.className).toContain("text-gray-600");
    expect(cell?.className).toContain("border-dashed");
    expect(cell?.className).toContain("border-gray-300");
    // Negative: must not carry the old indigo unconfirmed palette.
    expect(cell?.className).not.toContain("bg-indigo-50");
  });

  test("confirmed cell still uses indigo palette", async () => {
    renderMatrix(root, {
      projects: [makeProject()],
      assignments: [makeAssignment({ percentage: 50, is_confirmed: true })],
      members: [makeMember({ user_id: "u-1", display_name: "Alice" })],
    });

    const cell = await waitFor(() => container.querySelector<HTMLSpanElement>("td span"));
    expect(cell?.className).toContain("bg-indigo-100");
    expect(cell?.className).toContain("text-indigo-800");
  });
});

describe("MonthlyAssignmentMatrix — #21 F5: hideUnassigned filter", () => {
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

  const baseProps = {
    projects: [makeProject()],
    assignments: [makeAssignment({ user: "u-1", percentage: 50 })],
    members: [
      makeMember({ user_id: "u-1", display_name: "Alice", available_work_days: 20 }),
      makeMember({ user_id: "u-2", display_name: "Bob", available_work_days: 20 }),
      makeMember({ user_id: "u-3", display_name: "Carol", available_work_days: 20 }),
    ],
  };

  function memberHeaderNames(): string[] {
    return Array.from(container.querySelectorAll<HTMLElement>("thead th span"))
      .map((s) => s.textContent?.trim() ?? "")
      .filter((n) => ["Alice", "Bob", "Carol"].includes(n));
  }

  test("hideUnassigned=false (default) shows every member column", async () => {
    renderMatrix(root, { ...baseProps, hideUnassigned: false });
    await waitFor(() => container.querySelector("table"));
    expect(memberHeaderNames()).toEqual(["Alice", "Bob", "Carol"]);
  });

  test("hideUnassigned=true drops columns whose monthly userTotal is 0", async () => {
    renderMatrix(root, { ...baseProps, hideUnassigned: true });
    await waitFor(() => container.querySelector("table"));
    // Only Alice has an assignment this month.
    expect(memberHeaderNames()).toEqual(["Alice"]);
  });

  test("toggling hideUnassigned on then off restores hidden columns", async () => {
    renderMatrix(root, { ...baseProps, hideUnassigned: true });
    await waitFor(() => container.querySelector("table"));
    expect(memberHeaderNames()).toEqual(["Alice"]);

    renderMatrix(root, { ...baseProps, hideUnassigned: false });
    // Wait for the column count to grow back to 3 (Alice + Bob + Carol).
    const restored = await waitFor(() => (memberHeaderNames().length === 3 ? true : null));
    expect(restored).toBe(true);
    expect(memberHeaderNames()).toEqual(["Alice", "Bob", "Carol"]);
  });
});

describe("MonthlyAssignmentMatrix — 月合計 (人日) breakdown tooltip on the value", () => {
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

  // Regression: the staff-days breakdown must live on the hovered value (the
  // status-view link), not only on the <td>. Otherwise the link's own title
  // shadows it and the breakdown never surfaces on mouse-over.
  test("the 月合計 link's title carries the staff-days breakdown + the click hint", async () => {
    const project = makeProject({
      allocated_staff_days: 14,
      // current_effort_hours(80) * allocated_staff_days(14) / allocated_effort_hours(112) = 10 spent
      allocated_effort_hours: 112,
      projectstatus_display: { current_effort_hours: 80 },
    } as unknown as Partial<KippoProject>);

    renderMatrix(root, {
      projects: [project],
      // 50% of a 20-day month = 10 person-days → "Monthly Staff Days: 10"
      assignments: [makeAssignment({ user: "u-1", percentage: 50, is_confirmed: true })],
      members: [makeMember({ user_id: "u-1", display_name: "Alice", available_work_days: 20 })],
    });

    const link = await waitFor(() =>
      container.querySelector<HTMLAnchorElement>('a[href*="/status/"]'),
    );
    expect(link).not.toBeNull();
    const title = link?.getAttribute("title") ?? "";
    expect(title).toContain("Monthly Staff Days: 10");
    expect(title).toContain("Total Project Staff Days: 14");
    expect(title).toContain("Spent Project Staff Days: 10");
    // still tells the user the value is clickable
    expect(title).toContain("プロジェクトステータス");
  });
});
