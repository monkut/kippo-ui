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
// Organizations carry the listener URL + key (kiconiaworks/kippo#66); empty by default.
const orgs = vi.hoisted(() => ({ organizations: [] as unknown[] }));
vi.mock("~/lib/api/generated/organizations/organizations", () => ({
  organizationsList: () =>
    Promise.resolve({ status: 200, data: { organizations: orgs.organizations } }),
}));

import ProjectStatus, {
  allocatedEffortHoursTitle,
  ESTIMATED_MARKER,
  formatContractAmount,
  githubProjectLabel,
  LISTENER_SYNC_LABELS,
  meterFillPercentage,
} from "../app/routes/project-status";
import { LISTENER_FOCUS_DEBOUNCE_MS } from "../app/hooks/useListenerFocusSync";
import { LISTENER_FOCUS_SYNC_STORAGE_KEY } from "../app/lib/listener";

const flush = () => new Promise((r) => setTimeout(r, 50));

const contractedProject = {
  id: "proj-1",
  organization: "org-1",
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
    orgs.organizations = [];
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

  test("marks a contract-estimated budget with an asterisk and a dashed meter track", async () => {
    data.projects = [
      {
        ...contractedProject,
        projectstatus_display: {
          current_effort_hours: 40,
          expected_effort_hours: 60,
          allocated_effort_hours: 80,
          is_estimated_allocated_effort_hours: true,
          difference_percentage: -33.3,
        },
      } as unknown as KippoProject,
    ];
    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<ProjectStatus />);
    await flush();

    expect(container.textContent).toContain(`80h${ESTIMATED_MARKER}`);
    expect(container.querySelector(".border-dashed")).not.toBeNull();

    // the asterisk carries the explanation on hover AND to assistive tech / keyboard focus
    const marker = container.querySelector("abbr");
    expect(marker?.textContent).toBe(ESTIMATED_MARKER);
    expect(marker?.getAttribute("tabindex")).toBe("0");
    const title = marker?.getAttribute("title") ?? "";
    expect(title).toContain(ESTIMATED_MARKER);
    expect(title).toContain("推定値");
    expect(title).toContain("契約金額 ÷ 人日単価 × 1日の稼働時間");
  });

  test("leaves an entered budget unmarked", async () => {
    data.projects = [
      {
        ...contractedProject,
        projectstatus_display: {
          current_effort_hours: 40,
          expected_effort_hours: 60,
          allocated_effort_hours: 80,
          is_estimated_allocated_effort_hours: false,
          difference_percentage: -33.3,
        },
      } as unknown as KippoProject,
    ];
    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<ProjectStatus />);
    await flush();

    expect(container.textContent).toContain("80h");
    expect(container.textContent).not.toContain(ESTIMATED_MARKER);
    expect(container.querySelector("abbr")).toBeNull();
    expect(container.querySelector(".border-dashed")).toBeNull();
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

  test("allocatedEffortHoursTitle names the derivation that produced the budget", () => {
    expect(allocatedEffortHoursTitle(true)).toContain("契約金額");
    // the tooltip leads with the marker so hovering explains the asterisk itself
    expect(allocatedEffortHoursTitle(true).startsWith(ESTIMATED_MARKER)).toBe(true);
    expect(allocatedEffortHoursTitle(false)).toContain("割当人日");
    expect(allocatedEffortHoursTitle(false)).not.toContain("見積");
    expect(allocatedEffortHoursTitle(false)).not.toContain(ESTIMATED_MARKER);
    // absent on an older payload -> treated as an entered budget
    expect(allocatedEffortHoursTitle(undefined)).toBe(allocatedEffortHoursTitle(false));
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

// Listener focus sync (monkut/kippo-ui#139): the displayed project is POSTed to the
// organization's listener (URL + key from kippo#66) on mount and on every slide change.
describe("project-status listener focus sync", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const fetchMock = vi.fn();
  const originalFetch = globalThis.fetch;

  const secondProject = {
    ...contractedProject,
    id: "proj-2",
    name: "二番目",
  } as unknown as KippoProject;
  const listenerOrg = {
    id: "org-1",
    name: "org",
    github_organization_name: "org",
    listener_api_url: "https://listener.example/",
    listener_api_key: "key-1",
  };

  // the hook debounces, then awaits the POST; wait past both.
  const settle = () => new Promise((r) => setTimeout(r, LISTENER_FOCUS_DEBOUNCE_MS + 100));
  const postedProjectIds = () =>
    fetchMock.mock.calls.map(
      ([, init]) => JSON.parse((init as RequestInit).body as string).project_id,
    );

  beforeEach(() => {
    auth.state = { user: { username: "me" }, isLoading: false };
    data.projects = [contractedProject, secondProject];
    orgs.organizations = [listenerOrg];
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    localStorage.removeItem(LISTENER_FOCUS_SYNC_STORAGE_KEY);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    root.unmount();
    container.remove();
  });

  test("posts the displayed project on mount and on arrow-key navigation", async () => {
    root.render(<ProjectStatus />);
    await flush();
    await settle();
    expect(postedProjectIds()).toEqual(["proj-1"]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://listener.example/sessions/current/focus");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe("key-1");
    expect(container.textContent).toContain(LISTENER_SYNC_LABELS.synced);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await flush();
    await settle();
    expect(postedProjectIds()).toEqual(["proj-1", "proj-2"]);
  });

  test("shows セッションなし on 404 and keeps navigation working", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    root.render(<ProjectStatus />);
    await flush();
    await settle();
    expect(container.textContent).toContain(LISTENER_SYNC_LABELS["no-session"]);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await flush();
    expect(container.textContent).toContain("二番目");
  });

  test("the badge toggles sync off for this browser and persists the choice", async () => {
    root.render(<ProjectStatus />);
    await flush();
    await settle();
    const badge = findBadge(container);
    expect(badge?.getAttribute("aria-pressed")).toBe("true");
    badge?.click();
    await flush();
    expect(localStorage.getItem(LISTENER_FOCUS_SYNC_STORAGE_KEY)).toBe("off");
    expect(container.textContent).toContain(LISTENER_SYNC_LABELS.off);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await flush();
    await settle();
    expect(postedProjectIds()).toEqual(["proj-1"]); // nothing posted while off
  });

  test("without a listener on the organization nothing is posted and no badge renders", async () => {
    orgs.organizations = [{ ...listenerOrg, listener_api_url: "" }];
    root.render(<ProjectStatus />);
    await flush();
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(findBadge(container)).toBeNull();
  });
});

function findBadge(container: HTMLElement): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
      (b.textContent ?? "").startsWith("リスナー"),
    ) ?? null
  );
}
