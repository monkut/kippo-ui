import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { ProjectWeeklyEffort } from "~/lib/api/generated/models";
import { buildYearlyEffortMatrix } from "~/lib/yearly-effort";
import type { UseYearlyEffortReturn } from "~/hooks/useYearlyEffort";

// Drives the authLoading → authenticated transition on one instance: a hook placed after the
// early returns would change the hook count and crash (React #310, see weekly-effort route test).

const auth = vi.hoisted(() => ({
  state: { user: null as { username: string } | null, isLoading: true },
}));
const hook = vi.hoisted(() => ({ years: [] as number[], state: null as unknown }));

vi.mock("react-router", () => ({
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: "/weekly-effort/yearly" }),
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/lib/auth-context", () => ({ useAuth: () => auth.state }));
vi.mock("~/hooks/useYearlyEffort", () => ({
  useYearlyEffort: (year: number) => {
    hook.years.push(year);
    return hook.state;
  },
}));

import YearlyEffort from "../app/routes/weekly-effort.yearly";

const flush = () => new Promise((r) => setTimeout(r, 30));
const entry = (week_start: string, project: string, project_name: string, hours: number) =>
  ({ id: 0, week_start, project, project_name, hours }) as unknown as ProjectWeeklyEffort;

function clickButton(container: HTMLElement, label: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`button ${label} not found`);
  button.click();
  return button;
}

describe("YearlyEffort route", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const currentYear = new Date().getFullYear();

  beforeEach(() => {
    auth.state = { user: null, isLoading: true };
    hook.years = [];
    hook.state = {
      isLoading: false,
      error: "",
      matrix: buildYearlyEffortMatrix([
        entry(`${currentYear}-01-05`, "a", "Alpha", 10),
        entry(`${currentYear}-02-02`, "a", "Alpha", 6),
        entry(`${currentYear}-01-12`, "b", "Beta", 4),
      ]),
    } satisfies UseYearlyEffortReturn;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("renders loading → authenticated with per-project months and totals", async () => {
    root.render(<YearlyEffort />);
    await flush();
    expect(container.textContent).toContain("読み込み中");

    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<YearlyEffort />);
    await flush();

    const text = container.textContent ?? "";
    expect(text).toContain(`${currentYear}年`);
    expect(text).toContain("Alpha");
    expect(text).toContain("Beta");
    expect(text).toContain("月合計");
    expect(text).toContain("年合計 20 時間");
    const rows = Array.from(container.querySelectorAll("tbody tr"));
    // Alpha: Jan 10, Feb 6, total 16 (first row — larger total)
    const alphaCells = Array.from(rows[0].querySelectorAll("td")).map((td) => td.textContent);
    expect(alphaCells[0]).toBe("Alpha");
    expect(alphaCells[1]).toBe("10");
    expect(alphaCells[2]).toBe("6");
    expect(alphaCells[13]).toBe("16");
  });

  test("pages to the previous year; next is disabled on the current year", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<YearlyEffort />);
    await flush();

    const next = container.querySelector<HTMLButtonElement>('button[aria-label="次の年"]');
    expect(next?.disabled).toBe(true);

    clickButton(container, "前の年");
    await flush();
    expect(hook.years.at(-1)).toBe(currentYear - 1);
    expect(container.textContent).toContain("今年へ戻る");
  });

  test("shows an empty state when the year has no effort", async () => {
    auth.state = { user: { username: "me" }, isLoading: false };
    hook.state = { isLoading: false, error: "", matrix: buildYearlyEffortMatrix([]) };
    root.render(<YearlyEffort />);
    await flush();
    expect(container.textContent).toContain(`${currentYear}年の登録済み稼働はありません`);
  });
});
