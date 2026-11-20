import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { KippoProject } from "~/lib/api/generated/models";
import { addMonths, firstOfMonth, formatMonth } from "~/lib/dates";

// kiconiaworks/kippo#71: the 月別プロジェクト割当 matrix lists only 確度 >= 99% projects and
// reports how many in-window projects it hides. Also drives authLoading → authenticated on one
// instance (hooks above early returns).

const auth = vi.hoisted(() => ({
  state: { user: null as { username: string } | null, isLoading: true },
}));
const api = vi.hoisted(() => ({ projects: [] as unknown[] }));

// Real router (MemoryRouter) so ?month= is read from and written to the URL; only Link is stubbed.
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/lib/auth-context", () => ({ useAuth: () => auth.state }));
vi.mock("~/lib/api/pagination", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllProjects: async () => api.projects,
  fetchAllMonthlyAssignments: async () => [],
}));
vi.mock("~/lib/api/generated/organizations/organizations", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  organizationsMembersRetrieve: async () => ({ status: 200, data: { members: [] } }),
}));

import { MemoryRouter, useLocation } from "react-router";
import ProjectAssignmentsMonthly from "../app/routes/project-assignments";

const PAGE_PATH = "/project-assignments";

/** Exposes the router's current ?query for URL assertions. */
function LocationProbe() {
  return <span data-testid="location-search">{useLocation().search}</span>;
}

const flush = () => new Promise((r) => setTimeout(r, 30));
const month = firstOfMonth(new Date());
const project = (id: string, name: string, confidence: number) =>
  ({
    id,
    name,
    confidence,
    organization: "org-1",
    customer_name: "Cust",
    start_date: month,
    target_date: null,
    weekly_effort_users: [],
  }) as unknown as KippoProject;

describe("月別プロジェクト割当 confidence filter", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let initialEntry: string;
  // MemoryRouter reads initialEntries on its first render only; later renders keep its history.
  const renderPage = () =>
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <ProjectAssignmentsMonthly />
        <LocationProbe />
      </MemoryRouter>,
    );
  const locationSearch = () =>
    container.querySelector('[data-testid="location-search"]')?.textContent ?? "";

  beforeEach(() => {
    auth.state = { user: null, isLoading: true };
    api.projects = [
      project("p98", "Proposal98", 98),
      project("p99", "Verbal99", 99),
      project("p100", "Contract100", 100),
    ];
    initialEntry = PAGE_PATH;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("lists only 確度 >= 99% projects and shows the hidden count", async () => {
    renderPage();
    await flush();
    expect(container.textContent).toContain("読み込み中");

    auth.state = { user: { username: "me" }, isLoading: false };
    renderPage();
    await flush();

    const text = container.textContent ?? "";
    expect(text).toContain("Verbal99");
    expect(text).toContain("Contract100");
    expect(text).not.toContain("Proposal98");
    expect(text).toContain("プロジェクト数: 2");
    expect(text).toContain("非表示 1件: 確度 < 99%");
    expect(text).toContain("確度 99% 以上");

    const header = container.querySelector<HTMLButtonElement>('th button[title*="確度 99% 以上"]');
    expect(header?.textContent).toContain("プロジェクト名");
  });

  test("omits the hidden hint when every in-window project is >= 99%", async () => {
    api.projects = [project("p99", "Verbal99", 99)];
    auth.state = { user: { username: "me" }, isLoading: false };
    renderPage();
    await flush();
    expect(container.textContent).toContain("プロジェクト数: 1");
    expect(container.textContent).not.toContain("件: 確度 <");
  });

  // Shareable link: the displayed month is kept in ?month=YYYY-MM.
  test("writes the selected month to ?month= when the month changes", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    renderPage();
    await flush();
    expect(locationSearch()).toBe("");

    container.querySelector<HTMLButtonElement>('button[aria-label="次の月"]')?.click();
    await flush();
    expect(locationSearch()).toBe(`?month=${formatMonth(addMonths(month, 1))}`);
  });

  test("opens the month from a shared ?month= link", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    // The fixture projects start this month, so last month's matrix lists none of them.
    initialEntry = `${PAGE_PATH}?month=${formatMonth(addMonths(month, -1))}`;
    renderPage();
    await flush();
    expect(container.textContent).toContain(formatMonth(addMonths(month, -1)));
    expect(container.textContent).toContain("プロジェクト数: 0");
    expect(container.textContent).not.toContain("Verbal99");
  });
});
