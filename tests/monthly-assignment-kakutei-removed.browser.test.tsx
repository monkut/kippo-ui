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

// kiconiaworks/kippo#70: 確定 is removed from the matrix (#69 D1, D4) — no 確定 column or
// legend, and a project whose rows are all is_confirmed=true is no longer locked.

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

describe("MonthlyAssignmentMatrix — 確定 removed", () => {
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

  test("renders no 確定 column, toggle or 確定/未確定 legend", async () => {
    renderMatrix(root, {
      projects: [makeProject()],
      assignments: [makeAssignment({ id: 1, user: "u-1", is_confirmed: true })],
      members: [alice, bob],
      editableMonth: true,
      onCellClick: () => {},
    });
    await waitFor(() => container.querySelector("tbody tr"));
    expect(container.querySelector("button[aria-pressed]")).toBeNull();
    const headers = Array.from(container.querySelectorAll("thead th")).map((th) => th.textContent);
    expect(headers).not.toContain("確定");
    expect(container.textContent).not.toContain("確定済み");
    expect(container.textContent).not.toContain("未確定");
  });

  test("a project whose rows are all confirmed stays editable in an editable month", async () => {
    const onCellClick = vi.fn();
    renderMatrix(root, {
      projects: [makeProject()],
      assignments: [
        makeAssignment({ id: 1, user: "u-1", is_confirmed: true }),
        makeAssignment({ id: 2, user: "u-2", is_confirmed: true }),
      ],
      members: [alice, bob],
      editableMonth: true,
      onCellClick,
    });
    const cell = await waitFor(() =>
      Array.from(container.querySelectorAll<HTMLButtonElement>("tbody button")).find(
        (b) => b.textContent === "50%",
      ),
    );
    expect(cell).toBeTruthy();
    cell?.click();
    expect(onCellClick).toHaveBeenCalledTimes(1);
    expect(onCellClick.mock.calls[0][0].assignment?.id).toBe(1);
  });
});
