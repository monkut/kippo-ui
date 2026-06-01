import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { useWeeklyEffort } from "../app/hooks/useWeeklyEffort";

// Regression tests for the monthly-effort feature (PR #94 code review):
//  - the "今月の割当" panel + auto-calc must follow the SELECTED week's month, and
//  - a slow earlier-month response must NOT overwrite a newer month (last request wins).

// Controllable per-month deferreds, shared by the assignments + month-effort calls.
// vi.hoisted so the factory below can reference it (vi.mock is hoisted above imports).
const ctl = vi.hoisted(() => {
  const registry = new Map<string, { promise: Promise<unknown>; resolve: (v: unknown) => void }>();
  function get(key: string) {
    let entry = registry.get(key);
    if (!entry) {
      let resolve!: (v: unknown) => void;
      const promise = new Promise<unknown>((r) => {
        resolve = r;
      });
      entry = { promise, resolve };
      registry.set(key, entry);
    }
    return entry;
  }
  // A month-effort list call uses week_start_gte = `${month}-01` and week_start_lte at
  // month-end (day >= 28); the two-week window call never spans that far.
  function isMonthEffortCall(params: { week_start_gte?: string; week_start_lte?: string }) {
    const gte = params.week_start_gte ?? "";
    const lteDay = Number((params.week_start_lte ?? "").split("-")[2] ?? "0");
    return gte.endsWith("-01") && lteDay >= 28;
  }
  return { registry, get, isMonthEffortCall };
});

vi.mock("~/lib/api/pagination", () => ({
  fetchAllProjects: vi.fn(() =>
    Promise.resolve([
      { id: "pa", name: "PA", phase: "project-development", closed_datetime: null },
    ]),
  ),
}));
vi.mock("~/lib/api/generated/personal-holidays/personal-holidays", () => ({
  personalHolidaysList: vi.fn(() => Promise.resolve({ data: { results: [] } })),
}));
vi.mock("~/lib/api/generated/public-holidays/public-holidays", () => ({
  publicHolidaysList: vi.fn(() => Promise.resolve({ data: { results: [] } })),
}));
vi.mock("~/lib/api/generated/weekly-effort/weekly-effort", () => ({
  weeklyEffortExpectedHoursRetrieve: vi.fn(() =>
    Promise.resolve({ status: 200, data: { expected_hours: 40 } }),
  ),
  weeklyEffortMissingWeeksRetrieve: vi.fn(() =>
    Promise.resolve({ status: 200, data: { missing_weeks: [] } }),
  ),
}));
vi.mock("~/lib/api/generated/monthly-assignments/monthly-assignments", () => ({
  monthlyAssignmentsList: vi.fn(
    (params: { month: string }) => ctl.get(`A:${params.month.substring(0, 7)}`).promise,
  ),
}));
vi.mock("~/lib/api/generated/projects/projects", () => ({
  projectsWeeklyeffortList: vi.fn(
    (params: { week_start_gte?: string; week_start_lte?: string }) => {
      if (ctl.isMonthEffortCall(params)) {
        return ctl.get(`E:${(params.week_start_gte ?? "").substring(0, 7)}`).promise;
      }
      return Promise.resolve({ data: { results: [] } });
    },
  ),
  projectsWeeklyeffortCreate: vi.fn(() => Promise.resolve({ data: {} })),
  projectsWeeklyeffortPartialUpdate: vi.fn(() => Promise.resolve({ data: {} })),
  projectsWeeklyeffortDestroy: vi.fn(() => Promise.resolve({ data: {} })),
}));

function resolveMonth(
  month: string,
  data: { effort: Array<{ project: string; hours: number }>; assignments?: unknown[] },
) {
  ctl.get(`A:${month}`).resolve({ data: { results: data.assignments ?? [] } });
  ctl.get(`E:${month}`).resolve({ data: { results: data.effort } });
}

function assignment(project: string, percentage: number) {
  return { id: `${project}-id`, project, project_name: project, user_username: "me", percentage };
}

// Stable reference — mirrors the real app where `user` comes from auth context and
// does not change identity each render (the hook's mount effect depends on `user`).
const USER = { username: "me" };

function Harness({ weekStart }: { weekStart: string }) {
  const { monthHoursByProject, monthlyAssignments } = useWeeklyEffort(USER, weekStart);
  return (
    <div data-testid="state">
      {JSON.stringify({
        hours: monthHoursByProject,
        assignments: monthlyAssignments.map((a) => a.project_name),
      })}
    </div>
  );
}

async function waitForState(
  container: HTMLElement,
  predicate: (s: { hours: Record<string, number>; assignments: string[] }) => boolean,
  timeout = 3000,
) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const text = container.querySelector('[data-testid="state"]')?.textContent;
    if (text) {
      const parsed = JSON.parse(text);
      if (predicate(parsed)) return parsed;
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  const text = container.querySelector('[data-testid="state"]')?.textContent;
  throw new Error(`state predicate not met; last state = ${text}`);
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("useWeeklyEffort — target-month monthly data (PR #94)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    ctl.registry.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    ctl.registry.clear();
  });

  test("loads the selected week's month, then switches when navigating across months", async () => {
    root.render(<Harness weekStart="2026-05-11" />);
    resolveMonth("2026-05", {
      effort: [{ project: "pa", hours: 4 }],
      assignments: [assignment("pa", 50)],
    });
    await waitForState(container, (s) => s.hours.pa === 4 && s.assignments.includes("pa"));

    // Navigate into June and resolve its (different) data.
    root.render(<Harness weekStart="2026-06-08" />);
    resolveMonth("2026-06", {
      effort: [{ project: "pb", hours: 9 }],
      assignments: [assignment("pb", 30)],
    });
    await waitForState(container, (s) => s.hours.pb === 9 && s.assignments.includes("pb"));

    // May's data must be gone — the panel now reflects June, not the wall-clock month.
    const text = container.querySelector('[data-testid="state"]')?.textContent ?? "";
    expect(text).not.toContain("pa");
  });

  test("a stale earlier-month response does not overwrite a newer month (last request wins)", async () => {
    root.render(<Harness weekStart="2026-05-11" />);
    resolveMonth("2026-05", { effort: [{ project: "pa", hours: 4 }] });
    await waitForState(container, (s) => s.hours.pa === 4);

    // Navigate June (leave pending), let its fetch fire, then navigate July (leave pending).
    root.render(<Harness weekStart="2026-06-08" />);
    await tick();
    root.render(<Harness weekStart="2026-07-06" />);
    await tick();

    // Resolve the NEWER month (July) first, then the OLDER in-flight month (June).
    resolveMonth("2026-07", { effort: [{ project: "pc", hours: 5 }] });
    await waitForState(container, (s) => s.hours.pc === 5);
    resolveMonth("2026-06", { effort: [{ project: "pb", hours: 99 }] });
    await tick();
    await tick();

    // June's late response must be dropped: state stays on July, never flips to pb.
    const text = container.querySelector('[data-testid="state"]')?.textContent ?? "";
    expect(text).toContain("pc");
    expect(text).not.toContain("pb");
  });
});
