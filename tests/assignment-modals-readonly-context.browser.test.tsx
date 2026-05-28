import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { EditAssignmentModal } from "../app/components/project-assignments/EditAssignmentModal";
import { AddAssignmentModal } from "../app/components/project-assignments/AddAssignmentModal";
import type { ProjectMonthlyAssignment } from "../app/lib/api/generated/models";

// Cell-click modals must show the (customer, project) pair as read-only context
// so the operator can confirm which project they're acting on — matters most on
// the cross-project matrix where the cell click is the only project signal.

vi.mock("~/lib/api/generated/projects/projects", () => ({
  projectsMembersRetrieve: vi.fn(async () => ({ status: 200, data: { members: [] } })),
}));
vi.mock("~/lib/api/pagination", () => ({
  fetchAllMonthlyAssignments: vi.fn(async () => []),
  fetchAllProjects: vi.fn(async () => []),
}));

function makeAssignment(over: Partial<ProjectMonthlyAssignment>): ProjectMonthlyAssignment {
  return {
    id: 7,
    project: "proj-1",
    project_name: "Project Alpha",
    user: "u-1",
    user_username: "alice",
    user_display_name: "Alice Anderson",
    user_github_login: "alice-gh",
    user_slack_username: null,
    user_slack_image_url: null,
    month: "2026-06-01",
    percentage: 50,
    is_confirmed: false,
    created_datetime: "2026-05-08T00:00:00Z",
    updated_datetime: "2026-05-08T00:00:00Z",
    ...over,
  };
}

async function waitFor<T>(probe: () => T | null | undefined, timeout = 1500): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = probe();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

describe("EditAssignmentModal — read-only project + customer context", () => {
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

  test("renders customer name + project name above user/month", async () => {
    root.render(
      <EditAssignmentModal
        open={true}
        assignment={makeAssignment({ project_name: "Project Alpha" })}
        customerName="Acme Corp"
        isSaving={false}
        onClose={() => {}}
        onSave={async () => true}
        onDelete={async () => true}
      />,
    );

    const text = await waitFor(() =>
      container.textContent?.includes("顧客") ? container.textContent : null,
    );
    expect(text).toContain("顧客:");
    expect(text).toContain("Acme Corp");
    expect(text).toContain("プロジェクト:");
    expect(text).toContain("Project Alpha");
    expect(text).toContain("Alice Anderson");
    expect(text).toContain("2026-06-01");
  });

  test("omits 顧客 row when customerName is null (still shows project name)", async () => {
    root.render(
      <EditAssignmentModal
        open={true}
        assignment={makeAssignment({ project_name: "Project Beta" })}
        customerName={null}
        isSaving={false}
        onClose={() => {}}
        onSave={async () => true}
        onDelete={async () => true}
      />,
    );

    const text = await waitFor(() =>
      container.textContent?.includes("プロジェクト") ? container.textContent : null,
    );
    expect(text).toContain("プロジェクト:");
    expect(text).toContain("Project Beta");
    expect(text).not.toContain("顧客:");
  });
});

describe("AddAssignmentModal — read-only project + customer context", () => {
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

  test("renders customer + project as read-only context", async () => {
    root.render(
      <AddAssignmentModal
        open={true}
        projectId="proj-1"
        month="2026-06-01"
        effortUsernames={new Set()}
        isSaving={false}
        projectName="Project Gamma"
        customerName="Acme Corp"
        onClose={() => {}}
        onSubmit={async () => true}
      />,
    );

    const text = await waitFor(() =>
      container.textContent?.includes("プロジェクト") ? container.textContent : null,
    );
    expect(text).toContain("顧客:");
    expect(text).toContain("Acme Corp");
    expect(text).toContain("プロジェクト:");
    expect(text).toContain("Project Gamma");
  });

  test("omits the context block when both props are null (backward-compat)", async () => {
    root.render(
      <AddAssignmentModal
        open={true}
        projectId="proj-1"
        month="2026-06-01"
        effortUsernames={new Set()}
        isSaving={false}
        projectName={null}
        customerName={null}
        onClose={() => {}}
        onSubmit={async () => true}
      />,
    );

    // The "ユーザー" field label always renders — wait for that, then assert no
    // 顧客/プロジェクト rows leaked in.
    const text = await waitFor(() =>
      container.textContent?.includes("ユーザー") ? container.textContent : null,
    );
    expect(text).not.toContain("顧客:");
    expect(text).not.toContain("プロジェクト:");
  });
});
