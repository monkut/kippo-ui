import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { UseWeeklyEffortReturn } from "~/hooks/useWeeklyEffort";
import type { KippoProject, ProjectWeeklyEffort } from "~/lib/api/generated/models";

// Regression for the deployed React #310 ("rendered more hooks than the previous
// render"): the route's savedWeekProjectIds useMemo was placed AFTER the
// authLoading / !user early returns, so it ran only after auth resolved — changing
// the hook count between the loading render and the loaded render and crashing the
// page. Driving that exact transition here fails on the buggy ordering.
//
// Also covers the closed-week lock surface (kippo#54 / T17,T18): when selectedWeekEntries
// carry is_closed, ExistingEntriesList shows a lock banner + アンロックを申請 button that opens
// the request-unlock modal.

const auth = vi.hoisted(() => ({
  state: { user: null as { username: string } | null, isLoading: true },
}));

vi.mock("react-router", () => ({
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: "/weekly-effort" }),
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/lib/auth-context", () => ({ useAuth: () => auth.state }));

// Mutable hook return — the route reads many fields; empty/no-op defaults render the
// full-form variant without touching the network. Tests flip `hook.state` per case.
const hook = vi.hoisted(() => {
  const base = {
    isLoading: false,
    isSubmitting: false,
    error: "",
    setError: () => {},
    projects: [],
    recentUserEntries: [],
    selectedWeekEntries: [],
    monthlyAssignments: [],
    targetMonth: "2026-06-01",
    monthHoursByProject: {},
    monthEffortProjects: [],
    expectedHours: 40,
    missingWeeks: [],
    weekPersonalHolidays: [],
    weekPublicHolidays: [],
    monthPersonalHolidays: [],
    monthPublicHolidays: [],
    isLoadingMonthHolidays: false,
    templateEntries: [],
    createEntries: () => Promise.resolve(true),
    updateEntryHours: () => Promise.resolve(true),
    deleteEntry: () => Promise.resolve(true),
    refreshAfterHolidayChange: () => Promise.resolve(),
  } as unknown as UseWeeklyEffortReturn;
  return { base, state: base };
});
vi.mock("~/hooks/useWeeklyEffort", () => ({ useWeeklyEffort: () => hook.state }));

import WeeklyEffort from "../app/routes/weekly-effort";

const flush = () => new Promise((r) => setTimeout(r, 30));

function findButton(container: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
      (b.textContent ?? "").includes(text),
    ) ?? null
  );
}

const closedEntry = {
  id: 1,
  week_start: "2026-06-01",
  project: "proj-1",
  project_name: "Alpha",
  user: null,
  user_username: "me",
  user_display_name: "Me",
  hours: 10,
  is_closed: true,
  created_datetime: "2026-06-01T00:00:00Z",
  updated_datetime: "2026-06-01T00:00:00Z",
} as unknown as ProjectWeeklyEffort;

const project = {
  id: "proj-1",
  organization: "org-1",
  customer_name: null,
} as unknown as KippoProject;

describe("WeeklyEffort route", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    auth.state = { user: null, isLoading: true };
    hook.state = hook.base;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("renders through loading → authenticated without a hooks-order crash", async () => {
    // 1) Loading render (authLoading = true): the early return must not skip any hook.
    root.render(<WeeklyEffort />);
    await flush();
    expect(container.textContent).toContain("読み込み中");

    // 2) Auth resolves on the SAME instance — this is the render that previously threw
    // React #310 because savedWeekProjectIds' useMemo only ran once user was present.
    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<WeeklyEffort />);
    await flush();

    // The full input form renders; no error boundary, no crash.
    expect(container.textContent).toContain("稼働入力");
    expect(container.textContent).not.toContain("読み込み中");
  });

  test("a closed week shows the lock banner and opens the request-unlock modal", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    hook.state = {
      ...hook.base,
      selectedWeekEntries: [closedEntry],
      projects: [project],
    } as unknown as UseWeeklyEffortReturn;

    root.render(<WeeklyEffort />);
    await flush();

    // Lock banner + request button surface (before any save attempt).
    expect(container.textContent).toContain("この週は締め切られています");
    const requestButton = findButton(container, "アンロックを申請");
    expect(requestButton).not.toBeNull();

    // Opens the modal with the reason field.
    requestButton?.click();
    await flush();
    expect(container.textContent).toContain("申請理由");
    expect(container.querySelector("#unlock-reason")).not.toBeNull();
  });
});
