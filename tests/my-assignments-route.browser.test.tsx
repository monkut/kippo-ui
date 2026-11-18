import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { addMonths, firstOfMonth } from "~/lib/dates";

// kiconiaworks/kippo#74: 自分の割当 lists the signed-in user's assignments across months.
// Drives authLoading → authenticated on one instance (hooks above early returns).

const auth = vi.hoisted(() => ({
  state: { user: null as { username: string } | null, isLoading: true },
}));
const api = vi.hoisted(() => ({
  calls: [] as Array<{ month_gte?: string; month_lte?: string }>,
  rows: [] as unknown[],
}));

vi.mock("react-router", () => ({
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: "/my-assignments" }),
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/lib/auth-context", () => ({ useAuth: () => auth.state }));
vi.mock("~/lib/api/pagination", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllMonthlyAssignments: async (params: { month_gte?: string; month_lte?: string }) => {
    api.calls.push(params);
    return api.rows;
  },
}));
vi.mock("~/lib/api/generated/projects/projects", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  projectsRetrieve: async (id: string) => ({
    status: 200,
    data: { id, customer_name: "Cust", phase_display: "契約(稼働中)", confidence: 100 },
  }),
}));

import MyAssignments from "../app/routes/my-assignments";

const flush = () => new Promise((r) => setTimeout(r, 30));
const current = firstOfMonth(new Date());
const assignment = (user_username: string, project: string, month: string, percentage: number) =>
  ({
    user_username,
    project,
    project_name: `Project-${project}`,
    month,
    percentage,
  }) as unknown as ProjectMonthlyAssignment;

describe("自分の割当 route", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    auth.state = { user: null, isLoading: true };
    api.calls = [];
    api.rows = [
      assignment("me", "a", current, 60),
      assignment("me", "b", current, 50),
      assignment("someone-else", "c", current, 30),
    ];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("shows only my assignments with project info and an over-100% warning", async () => {
    root.render(<MyAssignments />);
    await flush();
    expect(container.textContent).toContain("読み込み中");

    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<MyAssignments />);
    await flush();

    expect(api.calls.at(-1)).toEqual({
      month_gte: addMonths(current, -5),
      month_lte: addMonths(current, 6),
    });
    const text = container.textContent ?? "";
    expect(text).toContain("Project-a");
    expect(text).toContain("Project-b");
    expect(text).not.toContain("Project-c");
    expect(text).toContain("契約(稼働中) · 確度 100%");
    expect(text).toContain("110% ⚠");
    expect(container.querySelectorAll("tbody tr")).toHaveLength(12);
  });

  test("pages the window by six months and shows an empty state", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<MyAssignments />);
    await flush();

    api.rows = [];
    container.querySelector<HTMLButtonElement>('button[aria-label="次の期間"]')?.click();
    await flush();
    expect(api.calls.at(-1)?.month_gte).toBe(addMonths(current, 1));
    expect(container.textContent).toContain("この期間の割当はありません");
    expect(container.textContent).toContain("今月へ戻る");
  });
});
