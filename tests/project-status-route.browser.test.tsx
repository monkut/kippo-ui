import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { KippoProject } from "~/lib/api/generated/models";

// Covers two things for the project-status slideshow (kiconiaworks/kippo#56):
//
// 1. The authLoading → authenticated transition on the SAME instance. CI does not gate
//    react/rules-of-hooks, so a hook placed below an early return passes lint and crashes
//    prod with React #310; driving the transition here catches it.
// 2. The ActiveKippoProjectAdmin parity columns now rendered on the slide — カテゴリ,
//    請求方法, 契約金額, GITHUBプロジェクト — plus the consumed-effort meter fill.

const auth = vi.hoisted(() => ({
  state: { user: null as { username: string } | null, isLoading: true },
}));

vi.mock("react-router", () => ({
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: "/project-status" }),
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/lib/auth-context", () => ({ useAuth: () => auth.state }));

const data = vi.hoisted(() => ({ projects: [] as unknown[] }));
vi.mock("~/lib/active-projects", () => ({
  fetchActiveProjects: () => Promise.resolve(data.projects),
}));
// The slide fetches per-project infra costs on mount; stub it out so the test stays offline.
vi.mock("~/components/infra-cost-display", () => ({
  fetchAllMonthlyCostsForProject: () => Promise.resolve([]),
  InfraCostDisplay: () => null,
}));

import ProjectStatus, {
  formatContractAmount,
  githubProjectLabel,
  meterFillPercentage,
} from "../app/routes/project-status";

const flush = () => new Promise((r) => setTimeout(r, 50));

const contractedProject = {
  id: "proj-1",
  name: "契約プロジェクト",
  customer_name: "顧客A",
  category_label: "AI開発",
  phase: "under-contract",
  phase_display: "契約(稼働中)",
  confidence: 100,
  start_date: "2026-04-01",
  target_date: "2026-09-30",
  billing_types: ["monthly"],
  contract_amount: "1500000",
  github_project_html_url: "https://github.com/orgs/kiconiaworks/projects/42",
  display_as_active: true,
  is_closed: false,
  projectstatus_display: null,
  latest_comment: null,
  weekly_effort_users: [],
  survey_users: [],
} as unknown as KippoProject;

describe("project-status route", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    auth.state = { user: null, isLoading: true };
    data.projects = [contractedProject];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("renders through loading → authenticated without a hooks-order crash", async () => {
    root.render(<ProjectStatus />);
    await flush();
    expect(container.textContent).toContain("読み込み中");

    // Auth resolves on the same instance — the render that would throw React #310 if a
    // hook sat below the early return.
    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<ProjectStatus />);
    await flush();

    expect(container.textContent).toContain("契約プロジェクト");
    expect(container.textContent).not.toContain("読み込み中");
  });

  test("renders the ActiveKippoProjectAdmin parity columns on the slide", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<ProjectStatus />);
    await flush();

    const text = container.textContent ?? "";
    expect(text).toContain("AI開発"); // カテゴリ
    expect(text).toContain("月額"); // 請求方法 (label, not the `monthly` key)
    expect(text).toContain("¥1,500,000"); // 契約金額
    expect(text).toContain("42"); // GITHUBプロジェクト (final path segment)

    const githubLink = Array.from(container.querySelectorAll("a")).find(
      (a) => a.getAttribute("href") === contractedProject.github_project_html_url,
    );
    expect(githubLink).toBeDefined();
  });

  test("links the 稼働状況 meter to the project status page, as the admin column does", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<ProjectStatus />);
    await flush();

    const statusLink = Array.from(container.querySelectorAll("a")).find((a) =>
      (a.getAttribute("href") ?? "").endsWith("/projects/project/proj-1/status/"),
    );
    expect(statusLink).toBeDefined();
  });

  test("omits the contract row entirely for a project with no contract", async () => {
    data.projects = [
      { ...contractedProject, billing_types: [], contract_amount: "0" } as unknown as KippoProject,
    ];
    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<ProjectStatus />);
    await flush();

    expect(container.textContent).not.toContain("月額");
    expect(container.textContent).not.toContain("¥");
  });
});

describe("project-status formatting helpers", () => {
  test("formatContractAmount renders ¥ with thousands separators and blanks zero", () => {
    expect(formatContractAmount("1500000")).toBe("¥1,500,000");
    expect(formatContractAmount(0)).toBe("");
    expect(formatContractAmount(null)).toBe("");
    expect(formatContractAmount(undefined)).toBe("");
  });

  test("githubProjectLabel returns the final path segment", () => {
    expect(githubProjectLabel("https://github.com/orgs/kiconiaworks/projects/42")).toBe("42");
    expect(githubProjectLabel("https://github.com/orgs/kiconiaworks/projects/42/")).toBe("42");
  });

  test("meterFillPercentage tracks consumed effort, matching the admin <meter>", () => {
    // Under budget: fill is current/allocated.
    expect(meterFillPercentage(50, 100)).toBe(50);
    // At budget.
    expect(meterFillPercentage(100, 100)).toBe(100);
    // Over budget: max grows to current, so the bar stays full but the scale is honest —
    // it no longer reports the elapsed-schedule ratio the old expected/allocated fill showed.
    expect(meterFillPercentage(150, 100)).toBe(100);
    // Nothing logged.
    expect(meterFillPercentage(0, 100)).toBe(0);
    expect(meterFillPercentage(null, 100)).toBe(0);
  });
});
