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
  participants: [] as unknown[],
  participantListCalls: 0,
}));

// Real router (MemoryRouter) so ?month= is read from and written to the URL; only useParams / Link are stubbed.
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<object>()),
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
  projectsParticipantsList: async () => {
    api.participantListCalls += 1;
    return { status: 200, data: api.participants };
  },
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

import { MemoryRouter, useLocation } from "react-router";
import ProjectAssignments from "../app/routes/projects.$id.assignments";

const PAGE_PATH = "/projects/p1/assignments";

/** Exposes the router's current ?query for URL assertions. */
function LocationProbe() {
  return <span data-testid="location-search">{useLocation().search}</span>;
}

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
  let initialEntry: string;
  // MemoryRouter reads initialEntries on its first render only; later renders keep its history.
  const renderPage = () =>
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <ProjectAssignments />
        <LocationProbe />
      </MemoryRouter>,
    );
  const locationSearch = () =>
    container.querySelector('[data-testid="location-search"]')?.textContent ?? "";

  beforeEach(() => {
    auth.state = { user: null, isLoading: true };
    api.listCalls = [];
    api.participantCalls = [];
    api.participants = [];
    api.participantListCalls = 0;
    api.project = { id: "p1", name: "Proj", customer_name: "Cust", weekly_effort_users: [] };
    api.rows = [row(1, currentMonth, "alice"), row(2, nextMonth, "bob")];
    initialEntry = PAGE_PATH;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("requests the displayed month and renders next month's row after switching", async () => {
    renderPage();
    await flush();
    expect(container.textContent).toContain("読み込み中");

    auth.state = { user: { username: "me" }, isLoading: false };
    renderPage();
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

  // Shareable link: the displayed month is kept in ?month=YYYY-MM.
  test("writes the selected month to ?month= when the month changes", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    renderPage();
    await flush();
    expect(locationSearch()).toBe(""); // no param until the month is changed

    clickButton(container, "次の月");
    await flush();
    expect(locationSearch()).toBe(`?month=${formatMonth(nextMonth)}`);

    clickButton(container, "前の月");
    await flush();
    expect(locationSearch()).toBe(`?month=${formatMonth(currentMonth)}`);
  });

  test("opens the month from a shared ?month= link", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    initialEntry = `${PAGE_PATH}?month=${formatMonth(nextMonth)}`;
    renderPage();
    await flush();
    expect(api.listCalls.at(-1)).toEqual({ project: "p1", month: nextMonth });
    expect(container.textContent).toContain("bob");
    expect(container.textContent).not.toContain("alice");
  });

  test("falls back to the current month for a malformed ?month=", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    initialEntry = `${PAGE_PATH}?month=2026-13`;
    renderPage();
    await flush();
    expect(api.listCalls.at(-1)).toEqual({ project: "p1", month: currentMonth });
  });

  // kiconiaworks/kippo#75 K1: no single-month add or suggested-team buttons on the project page.
  test("does not render ＋ 割当を追加 or 候補パターンを生成", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    renderPage();
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
    renderPage();
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
    renderPage();
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
    renderPage();
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

  // kiconiaworks/kippo#75: participants list (month-independent defaults).
  test("lists participants with their default percentage and role", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    api.participants = [
      {
        id: 1,
        project: "p1",
        user: "u-a",
        user_username: "alice",
        user_display_name: "Alice A",
        percentage: 40,
        role: "developer",
      },
      {
        id: 2,
        project: "p1",
        user: "u-d",
        user_username: "dave",
        user_display_name: "",
        percentage: 10,
        role: "",
      },
    ];
    renderPage();
    await flush();

    const section = Array.from(container.querySelectorAll("section")).find((s) =>
      s.textContent?.startsWith("参加者 (2名)"),
    );
    expect(section).toBeDefined();
    const rows = Array.from(section?.querySelectorAll("tbody tr") ?? []).map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td) => td.textContent),
    );
    expect(rows).toEqual([
      ["Alice A", "40%", "developer"],
      ["dave", "10%", "(指定なし)"],
    ]);
  });

  test("shows an empty participants message and refetches participants after adding one", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    api.project = {
      ...api.project,
      start_date: currentMonth,
      target_date: lastOfMonth(addMonths(currentMonth, 1)),
    };
    renderPage();
    await flush();
    expect(container.textContent).toContain("参加者 (0名)");
    expect(container.textContent).toContain("参加者はまだいません。");

    const callsBefore = api.participantListCalls;
    participantButton()?.click();
    await flush();
    Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((b) => b.textContent === "追加")
      ?.click();
    await flush();
    expect(api.participantListCalls).toBeGreaterThan(callsBefore);
  });
});
