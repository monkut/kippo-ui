import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { ProjectMonthlyAssignment } from "~/lib/api/generated/models";
import { addMonths, firstOfMonth } from "~/lib/dates";

// kiconiaworks/kippo#68: /projects/:id/assignments must request assignments for the displayed
// month. Without `month` the list endpoint defaults to the current month, so other months render
// empty. Also drives authLoading → authenticated on one instance (hooks above early returns).

const auth = vi.hoisted(() => ({
  state: { user: null as { username: string } | null, isLoading: true },
}));
const api = vi.hoisted(() => ({
  listCalls: [] as Array<{ project?: string; month?: string }>,
  rows: [] as unknown[],
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
  projectsRetrieve: async () => ({
    status: 200,
    data: { id: "p1", name: "Proj", customer_name: "Cust", weekly_effort_users: [] },
  }),
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
});
