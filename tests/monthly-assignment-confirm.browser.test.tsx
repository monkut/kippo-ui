import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { MonthlyAssignmentMatrix } from "../app/components/project-assignments/MonthlyAssignmentMatrix";
import type {
  KippoProject,
  OrganizationMemberDetail,
  ProjectMonthlyAssignment,
} from "../app/lib/api/generated/models";

// Per-project 確定 column: a 3-state checkbox per project row confirms/unconfirms
// every assignment of that project for the displayed month via onBulkSetConfirmed.

function makeProject(over: Partial<KippoProject> = {}): KippoProject {
  return {
    id: "p-1",
    name: "Project 1",
    start_date: "2026-01-01",
    target_date: "2026-12-31",
    confidence: 100,
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
    is_confirmed: false,
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

const alice = makeMember({ user_id: "u-1", display_name: "Alice" });
const bob = makeMember({ user_id: "u-2", display_name: "Bob" });

describe("MonthlyAssignmentMatrix — per-project 確定 column", () => {
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

  const confirmBox = () =>
    container.querySelector<HTMLInputElement>('tbody input[type="checkbox"]');

  test("partial row → indeterminate; clicking confirms ALL of the project's ids", async () => {
    const onBulkSetConfirmed = vi.fn(() => Promise.resolve(true));
    renderMatrix(root, {
      projects: [makeProject()],
      assignments: [
        makeAssignment({ id: 1, user: "u-1", is_confirmed: true }),
        makeAssignment({ id: 2, user: "u-2", is_confirmed: false }),
      ],
      members: [alice, bob],
      editableMonth: true,
      onBulkSetConfirmed,
    });

    const box = await waitFor(confirmBox);
    expect(box?.checked).toBe(false);
    expect(box?.indeterminate).toBe(true);

    box?.click();
    expect(onBulkSetConfirmed).toHaveBeenCalledTimes(1);
    expect(onBulkSetConfirmed).toHaveBeenCalledWith([1, 2], true);
  });

  test("fully-confirmed row → checked; clicking unconfirms ALL of the project's ids", async () => {
    const onBulkSetConfirmed = vi.fn(() => Promise.resolve(true));
    renderMatrix(root, {
      projects: [makeProject()],
      assignments: [
        makeAssignment({ id: 1, user: "u-1", is_confirmed: true }),
        makeAssignment({ id: 2, user: "u-2", is_confirmed: true }),
      ],
      members: [alice, bob],
      editableMonth: true,
      onBulkSetConfirmed,
    });

    const box = await waitFor(confirmBox);
    expect(box?.checked).toBe(true);
    expect(box?.indeterminate).toBe(false);

    box?.click();
    expect(onBulkSetConfirmed).toHaveBeenCalledWith([1, 2], false);
  });

  test("unconfirmed row → unchecked; clicking confirms", async () => {
    const onBulkSetConfirmed = vi.fn(() => Promise.resolve(true));
    renderMatrix(root, {
      projects: [makeProject()],
      assignments: [makeAssignment({ id: 7, user: "u-1", is_confirmed: false })],
      members: [alice],
      editableMonth: true,
      onBulkSetConfirmed,
    });

    const box = await waitFor(confirmBox);
    expect(box?.checked).toBe(false);
    expect(box?.indeterminate).toBe(false);

    box?.click();
    expect(onBulkSetConfirmed).toHaveBeenCalledWith([7], true);
  });

  test("project with no assignments → checkbox disabled", async () => {
    renderMatrix(root, {
      projects: [makeProject()],
      assignments: [],
      members: [alice],
      editableMonth: true,
      onBulkSetConfirmed: vi.fn(() => Promise.resolve(true)),
    });

    const box = await waitFor(confirmBox);
    expect(box?.disabled).toBe(true);
  });

  test("confidence < 100 → confirm disabled with an explaining tooltip", async () => {
    renderMatrix(root, {
      projects: [makeProject({ confidence: 80 })],
      assignments: [makeAssignment({ id: 1, user: "u-1", is_confirmed: false })],
      members: [alice],
      editableMonth: true,
      onBulkSetConfirmed: vi.fn(() => Promise.resolve(true)),
    });

    const box = await waitFor(confirmBox);
    expect(box?.disabled).toBe(true);
    expect(box?.title).toContain("確度が100%でないため確定できません");
    expect(box?.title).toContain("80%");
  });

  test("confidence < 100 but already fully confirmed → still allowed to unconfirm", async () => {
    const onBulkSetConfirmed = vi.fn(() => Promise.resolve(true));
    renderMatrix(root, {
      projects: [makeProject({ confidence: 80 })],
      assignments: [makeAssignment({ id: 1, user: "u-1", is_confirmed: true })],
      members: [alice],
      editableMonth: true,
      onBulkSetConfirmed,
    });

    const box = await waitFor(confirmBox);
    expect(box?.checked).toBe(true);
    expect(box?.disabled).toBe(false);
    box?.click();
    expect(onBulkSetConfirmed).toHaveBeenCalledWith([1], false);
  });
});
