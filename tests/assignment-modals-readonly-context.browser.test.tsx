import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import type {
  KippoProject,
  ProjectMonthlyAssignment,
  ProjectParticipant,
} from "../app/lib/api/generated/models";

// The cell-click modal shows read-only context so the operator can confirm what they're acting
// on: customer, project, project period, the project's participants for the month, and the
// edited user's assignments on every project that month (with a live month total).

const api = vi.hoisted(() => ({
  participants: [] as unknown[],
  monthRows: [] as unknown[],
  monthCalls: [] as Array<{ month?: string }>,
}));

vi.mock("~/lib/api/generated/projects/projects", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  projectsParticipantsList: async () => ({ status: 200, data: api.participants }),
}));
vi.mock("~/lib/api/pagination", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllMonthlyAssignments: async (params: { month?: string }) => {
    api.monthCalls.push(params);
    return api.monthRows;
  },
}));

import { EditAssignmentModal } from "../app/components/project-assignments/EditAssignmentModal";

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

const participant = (over: Partial<ProjectParticipant>) =>
  ({ id: 1, project: "proj-1", role: "developer", percentage: 40, ...over }) as ProjectParticipant;

const project = {
  id: "proj-1",
  name: "Project Alpha",
  customer_name: "Acme Corp",
  start_date: "2026-04-01",
  target_date: "2026-09-30",
} as KippoProject;

async function waitFor<T>(probe: () => T | null | undefined, timeout = 1500): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = probe();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

describe("EditAssignmentModal — read-only context", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const renderModal = (props: {
    assignment: ProjectMonthlyAssignment;
    project: KippoProject | null;
  }) =>
    root.render(
      <EditAssignmentModal
        open={true}
        assignment={props.assignment}
        project={props.project}
        isSaving={false}
        onClose={() => {}}
        onSave={async () => true}
        onDelete={async () => true}
      />,
    );
  const section = (label: string) =>
    container.querySelector<HTMLElement>(`section[aria-label="${label}"]`);

  beforeEach(() => {
    api.participants = [];
    api.monthRows = [];
    api.monthCalls = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("renders customer, project, period and month above the user", async () => {
    renderModal({ assignment: makeAssignment({}), project });

    const text = await waitFor(() =>
      container.textContent?.includes("顧客") ? container.textContent : null,
    );
    expect(text).toContain("Acme Corp");
    expect(text).toContain("Project Alpha");
    expect(text).toContain("2026-04-01 〜 2026-09-30");
    expect(text).toContain("2026-06");
    expect(text).toContain("Alice Anderson");
  });

  test("omits 顧客 and shows an unset period when the project is unknown", async () => {
    renderModal({ assignment: makeAssignment({ project_name: "Project Beta" }), project: null });

    const text = await waitFor(() =>
      container.textContent?.includes("プロジェクト") ? container.textContent : null,
    );
    expect(text).toContain("Project Beta");
    expect(text).toContain("未設定 〜 未設定");
    expect(text).not.toContain("顧客");
  });

  test("lists participants with the month's percentage and the user's other projects", async () => {
    const edited = makeAssignment({ percentage: 40 });
    api.participants = [
      participant({ user: "u-1", user_username: "alice", user_display_name: "Alice Anderson" }),
      participant({
        id: 2,
        user: "u-2",
        user_username: "bob",
        user_display_name: "Bob",
        percentage: 30,
      }),
      participant({ id: 3, user: "u-3", user_username: "carol", user_display_name: "Carol" }),
    ];
    api.monthRows = [
      edited,
      makeAssignment({
        id: 8,
        user: "u-2",
        user_username: "bob",
        user_display_name: "Bob",
        percentage: 25,
      }),
      makeAssignment({ id: 9, project: "proj-2", project_name: "Project Gamma", percentage: 70 }),
    ];
    renderModal({ assignment: edited, project });

    const participants = await waitFor(() =>
      section("プロジェクト参加者")?.textContent?.includes("Carol")
        ? section("プロジェクト参加者")
        : null,
    );
    expect(api.monthCalls).toEqual([{ month: "2026-06-01" }]);
    const participantText = participants?.textContent ?? "";
    expect(participantText).toContain("3名");
    expect(participantText).toMatch(/Bob.*30%.*25%/); // default 30%, this month 25%
    expect(participantText).toMatch(/Carol.*—/); // no row this month

    const userText = section("ユーザーの割当")?.textContent ?? "";
    expect(userText).toContain("Project Gamma");
    expect(userText).toContain("110% ⚠");
    expect(userText).toContain("100% を超えています");
  });

  test("the month total follows the unsaved percentage", async () => {
    const edited = makeAssignment({ percentage: 40 });
    api.monthRows = [
      edited,
      makeAssignment({ id: 9, project: "proj-2", project_name: "G", percentage: 70 }),
    ];
    renderModal({ assignment: edited, project });
    await waitFor(() => section("ユーザーの割当")?.textContent?.includes("110%"));

    const input = container.querySelector<HTMLInputElement>("#edit-assignment-pct");
    if (!input) throw new Error("percentage input not found");
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(input, "20");
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const userText = await waitFor(() =>
      section("ユーザーの割当")?.textContent?.includes("90%")
        ? section("ユーザーの割当")?.textContent
        : null,
    );
    expect(userText).toContain("90%");
    expect(userText).not.toContain("⚠");
  });
});
