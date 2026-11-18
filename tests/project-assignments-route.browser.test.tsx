import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { addMonths, firstOfMonth, formatMonth, lastOfMonth } from "~/lib/dates";

// kiconiaworks/kippo#68: /projects/:id/assignments must request assignments for the displayed
// month. Without `month` the list endpoint defaults to the current month, so other months render
// empty. Also drives authLoading → authenticated on one instance (hooks above early returns).

const auth = vi.hoisted(() => ({
  state: { user: null as { username: string } | null, isLoading: true },
}));
const api = vi.hoisted(() => ({
  listCalls: [] as Array<{ project?: string; month?: string }>,
  rows: [] as unknown[],
  project: {} as Record<string, unknown>,
  participantCalls: [] as Array<{ projectId: string; payload: unknown }>,
}));

vi.mock("react-router", () => ({
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: "/projects/p1/assignments" }),
  useParams: () => ({ id: "p1" }),
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/lib/auth-context", () => ({ useAuth: () => auth.state }));
vi.mock("~/lib/api/generated/monthly-assignments/monthly-assignments", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  monthlyAssignmentsList: async (params: { project?: string; month?: string }) => {
    api.listCalls.push(params);
    return {
      status: 200,
      data: api.rows.filter((r) => (r as { month: string }).month === params.month),
    };
  },
}));
vi.mock("~/lib/api/generated/projects/projects", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  projectsRetrieve: async () => ({ status: 200, data: api.project }),
  projectsMembersRetrieve: async () => ({
    status: 200,
    data: { members: [{ user_id: "u-carol", username: "carol", display_name: "Carol" }] },
  }),
  projectsParticipantsCreate: async (projectId: string, payload: unknown) => {
    api.participantCalls.push({ projectId, payload });
    return {
      status: 201,
      data: {
        created: [{ month: "2026-12-01" }, { month: "2027-01-01" }],
        skipped_months: ["2026-11-01"],
      },
    };
  },
  projectsForecastRetrieve: async () => ({ status: 400, data: undefined }),
}));

import ProjectAssignments from "../app/routes/projects.$id.assignments";

const flush = () => new Promise((r) => setTimeout(r, 30));
const currentMonth = firstOfMonth(new Date());
const nextMonth = addMonths(currentMonth, 1);
const row = (id: number, month: string, user_username: string) =>
  ({
    id,
    month,
    user_username,
    project: "p1",
    percentage: 75,
    is_confirmed: false,
  }) as unknown as ProjectMonthlyAssignment;

function clickButton(container: HTMLElement, label: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`button ${label} not found`);
  button.click();
}

describe("ProjectAssignments route", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    auth.state = { user: null, isLoading: true };
    api.listCalls = [];
    api.participantCalls = [];
    api.project = { id: "p1", name: "Proj", customer_name: "Cust", weekly_effort_users: [] };
    api.rows = [row(1, currentMonth, "alice"), row(2, nextMonth, "bob")];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("requests the displayed month and renders next month's row after switching", async () => {
    root.render(<ProjectAssignments />);
    await flush();
    expect(container.textContent).toContain("読み込み中");

    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<ProjectAssignments />);
    await flush();

    expect(api.listCalls.at(-1)).toEqual({ project: "p1", month: currentMonth });
    expect(container.textContent).toContain("alice");
    expect(container.textContent).not.toContain("bob");
    // kiconiaworks/kippo#70: no 確定 column, toggle or 確定/未確定 legend on the project page.
    expect(container.textContent).not.toContain("確定");
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();

    clickButton(container, "次の月");
    await flush();

    expect(api.listCalls.at(-1)).toEqual({ project: "p1", month: nextMonth });
    expect(container.textContent).toContain("bob");
    expect(container.textContent).not.toContain("この月の割当はまだ登録されていません");
  });

  // kiconiaworks/kippo#75 K1: no single-month add or suggested-team buttons on the project page.
  test("does not render ＋ 割当を追加 or 候補パターンを生成", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<ProjectAssignments />);
    await flush();
    expect(container.textContent).toContain("alice");
    expect(container.textContent).not.toContain("割当を追加");
    expect(container.textContent).not.toContain("候補パターンを生成");

    api.rows = []; // empty month: still no add / suggest buttons
    clickButton(container, "次の月");
    await flush();
    expect(container.textContent).toContain("この月の割当はまだ登録されていません");
    expect(container.textContent).not.toContain("割当を追加");
    expect(container.textContent).not.toContain("候補パターンを生成");
  });

  // kiconiaworks/kippo#73: 参加者を追加 on the project page.
  const participantButton = () =>
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
      b.textContent?.includes("参加者を追加"),
    );

  test("参加者を追加 is disabled with a reason when the project period is not set", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    api.project = { ...api.project, start_date: "2026-11-01", target_date: null };
    root.render(<ProjectAssignments />);
    await flush();
    expect(participantButton()?.disabled).toBe(true);
    expect(container.textContent).toContain("目標終了日を設定すると参加者を追加できます");
  });

  // kiconiaworks/kippo#75 R1: rows are created only for the remaining period.
  test("参加者を追加 is disabled with a reason when the project period has ended", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    api.project = {
      ...api.project,
      start_date: addMonths(currentMonth, -6),
      target_date: lastOfMonth(addMonths(currentMonth, -1)),
    };
    root.render(<ProjectAssignments />);
    await flush();
    expect(participantButton()?.disabled).toBe(true);
    expect(container.textContent).toContain("プロジェクト期間が終了しています");
  });

  test("adds a participant over the remaining period and shows created / skipped months", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    // Started two months ago: the remaining period starts at the current month.
    api.project = {
      ...api.project,
      start_date: addMonths(currentMonth, -2),
      target_date: lastOfMonth(addMonths(currentMonth, 2)),
    };
    root.render(<ProjectAssignments />);
    await flush();

    const button = participantButton();
    expect(button?.disabled).toBe(false);
    button?.click();
    await flush();
    expect(container.textContent).toContain(
      `残りの期間 ${formatMonth(currentMonth)} 〜 ${formatMonth(addMonths(currentMonth, 2))} の各月に同じ割当を登録します。登録済みの月は変更しません。`,
    );

    const submit = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (b) => b.textContent === "追加",
    );
    const listCallsBefore = api.listCalls.length;
    submit?.click();
    await flush();

    expect(api.participantCalls).toEqual([
      { projectId: "p1", payload: { user: "u-carol", percentage: 50, role: "" } },
    ]);
    expect(container.textContent).toContain("作成: 2か月 (2026-12 〜 2027-01)");
    expect(container.textContent).toContain("登録済みのためスキップ: 1か月 (2026-11)");
    expect(api.listCalls.length).toBeGreaterThan(listCallsBefore); // page refetched
  });
});
