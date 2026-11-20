import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { KippoProject, ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { addMonths, firstOfMonth, formatMonth, lastOfMonth } from "~/lib/dates";

// 参加者を追加: the user picker lists only real org members (never the per-org "(unassigned)"
// placeholder or system accounts), searches by name / username / GitHub login, and shows the
// selected user's assignments for the first added month with a total that follows the input.

const api = vi.hoisted(() => ({
  monthRows: [] as unknown[],
  monthCalls: [] as Array<{ month?: string }>,
  submitted: [] as unknown[],
}));

vi.mock("~/lib/api/generated/projects/projects", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  projectsMembersRetrieve: async () => ({
    status: 200,
    data: {
      members: [
        {
          user_id: "u-goro",
          username: "goro.kaiho",
          display_name: "goro kaiho (kaiho-goro)",
          github_login: "kaiho-goro",
        },
        {
          user_id: "u-kaisei",
          username: "kaisei.deguchi",
          display_name: "カイセイ 出口 (ka714)",
          github_login: "ka714",
        },
        {
          user_id: "u-unassigned",
          username: "unassigned-kiconiaworks",
          display_name: "(unassigned)",
          github_login: "unassigned-kiconiaworks",
        },
        { user_id: "u-admin", username: "admin", display_name: "admin", github_login: "" },
      ],
    },
  }),
}));
vi.mock("~/lib/api/pagination", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllMonthlyAssignments: async (params: { month?: string }) => {
    api.monthCalls.push(params);
    return api.monthRows;
  },
}));

import { AddParticipantModal } from "../app/components/project-assignments/AddParticipantModal";

const currentMonth = firstOfMonth(new Date());
const project = {
  id: "p1",
  name: "Project One",
  start_date: currentMonth,
  target_date: lastOfMonth(addMonths(currentMonth, 2)),
} as KippoProject;

const row = (over: Partial<ProjectMonthlyAssignment>) =>
  ({
    id: 1,
    project: "p2",
    project_name: "Other",
    user: "u-kaisei",
    month: currentMonth,
    percentage: 30,
    ...over,
  }) as ProjectMonthlyAssignment;

const flush = () => new Promise((r) => setTimeout(r, 30));

/** Poll until `probe` holds (the mocked fetches resolve later on a cold browser run). */
async function waitUntil(probe: () => boolean, timeout = 2000) {
  const start = Date.now();
  while (!probe()) {
    if (Date.now() - start > timeout) throw new Error("waitUntil timed out");
    await flush();
  }
}

function typeInto(input: HTMLInputElement, text: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("AddParticipantModal user picker", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const input = () => container.querySelector<HTMLInputElement>("#add-assignment-user");
  const optionTexts = () =>
    Array.from(container.querySelectorAll('[role="option"]')).map((o) => o.textContent ?? "");
  const userSection = () =>
    container.querySelector('section[aria-label="ユーザーの割当"]')?.textContent ?? "";
  const submitButton = () =>
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (b) => b.textContent === "追加",
    );

  async function openModal() {
    root.render(
      <AddParticipantModal
        open
        project={project}
        effortUsernames={new Set()}
        isSaving={false}
        onClose={() => {}}
        onSubmit={async (payload) => {
          api.submitted.push(payload);
          return null;
        }}
      />,
    );
    // The field is disabled until the org members load.
    await waitUntil(() => input()?.disabled === false);
  }

  async function search(text: string) {
    const field = input();
    if (!field) throw new Error("user field not found");
    field.focus();
    typeInto(field, text);
    await flush();
  }

  async function choose(label: string) {
    const option = Array.from(container.querySelectorAll('[role="option"]')).find((o) =>
      o.textContent?.includes(label),
    );
    if (!option) throw new Error(`option ${label} not found`);
    option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await flush();
  }

  beforeEach(() => {
    api.monthRows = [];
    api.monthCalls = [];
    api.submitted = [];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("lists only org members: no (unassigned) placeholder or system accounts", async () => {
    await openModal();
    await search("");
    const texts = optionTexts();
    expect(texts).toHaveLength(2);
    expect(texts.join()).not.toContain("(unassigned)");
    expect(texts.join()).not.toContain("admin");
  });

  test.each([
    ["出口", "カイセイ 出口"],
    ["かいせい", "カイセイ 出口"],
    ["ka714", "カイセイ 出口"],
    ["kaiho goro", "goro kaiho"],
  ])("search %j finds %s", async (query, expected) => {
    await openModal();
    await search(query);
    expect(optionTexts()).toEqual([expect.stringContaining(expected)]);
  });

  test("no user is preselected; 追加 is enabled only after choosing one", async () => {
    await openModal();
    expect(submitButton()?.disabled).toBe(true);
    await search("goro");
    await choose("goro kaiho");
    expect(input()?.value).toBe("goro kaiho (kaiho-goro)");
    expect(submitButton()?.disabled).toBe(false);
    submitButton()?.click();
    await flush();
    expect(api.submitted).toEqual([{ user: "u-goro", percentage: 50, role: "" }]);
  });

  test("shows the chosen user's month and the total follows the percentage", async () => {
    api.monthRows = [
      row({ percentage: 30 }),
      row({ id: 2, project: "p3", project_name: "Third", percentage: 40 }),
    ];
    await openModal();
    expect(api.monthCalls).toEqual([{ month: currentMonth }]);
    await search("出口");
    await choose("出口");

    expect(userSection()).toContain(`（${formatMonth(currentMonth)}・全プロジェクト）`);
    expect(userSection()).toContain("Project One");
    expect(userSection()).toContain("120% ⚠"); // 50 (default) + 30 + 40

    const pct = container.querySelector<HTMLInputElement>("#add-assignment-pct");
    if (!pct) throw new Error("percentage field not found");
    typeInto(pct, "20");
    await flush();
    expect(userSection()).toContain("90%");
    expect(userSection()).not.toContain("⚠");
  });

  test("a month already registered on this project shows its saved percentage", async () => {
    api.monthRows = [row({ project: "p1", project_name: "Project One", percentage: 10 })];
    await openModal();
    await search("出口");
    await choose("出口");
    expect(userSection()).toContain("登録済み");
    expect(userSection()).toContain("10%");
    expect(container.textContent).toContain(
      "このプロジェクトに登録済みのため変更されません（10%）",
    );
  });
});
