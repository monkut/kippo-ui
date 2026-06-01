import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

// Regression for the deployed React #310 ("rendered more hooks than the previous
// render"): the route's savedWeekProjectIds useMemo was placed AFTER the
// authLoading / !user early returns, so it ran only after auth resolved — changing
// the hook count between the loading render and the loaded render and crashing the
// page. Driving that exact transition here fails on the buggy ordering.

const auth = vi.hoisted(() => ({
  state: { user: null as { username: string } | null, isLoading: true },
}));

vi.mock("react-router", () => ({
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: "/weekly-effort" }),
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/lib/auth-context", () => ({ useAuth: () => auth.state }));

// Stable hook return — the route reads many fields; empty/no-op defaults render the
// full-form variant without touching the network.
const HOOK_RETURN = {
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
};
vi.mock("~/hooks/useWeeklyEffort", () => ({ useWeeklyEffort: () => HOOK_RETURN }));

import WeeklyEffort from "../app/routes/weekly-effort";

const flush = () => new Promise((r) => setTimeout(r, 30));

describe("WeeklyEffort route — auth-loading transition (React #310 regression)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    auth.state = { user: null, isLoading: true };
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
});
