import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { BillingListEntry } from "~/lib/api/billing";

// Guards the deployed React #310 hooks-order class of bug (see weekly-effort-route test): every
// hook in the billing route must sit ABOVE the authLoading / !user early returns, so the hook count
// is stable across the loading → authenticated transition. Also checks the list renders and the CSV
// button is wired to the download helper over the filtered rows.

const auth = vi.hoisted(() => ({
  state: { user: null as { username: string } | null, isLoading: true },
}));

vi.mock("react-router", () => ({
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: "/billing" }),
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/lib/auth-context", () => ({ useAuth: () => auth.state }));

const api = vi.hoisted(() => ({ rows: [] as BillingListEntry[] }));
vi.mock("~/lib/api/billing", () => ({
  fetchAllBillingEntries: () => Promise.resolve(api.rows),
}));

const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }));
vi.mock("~/lib/csv", () => ({ downloadCsv: csv.downloadCsv }));

import Billing from "../app/routes/billing";

const flush = () => new Promise((r) => setTimeout(r, 40));

function row(overrides: Partial<BillingListEntry>): BillingListEntry {
  return {
    id: 1,
    billing_date: "2026-07-31",
    amount: "1000000",
    is_manual: false,
    is_received: false,
    received_datetime: null,
    received_by_username: null,
    note: "",
    project_id: "p1",
    project_name: "Alpha",
    organization_name: "Org",
    project_phase: "completed",
    project_actual_date: "2026-07-31",
    billed_to_name: "BillCo",
    customer_name: null,
    billing_type: "monthly",
    pricing_basis: "fixed",
    contract_total_amount: "3000000",
    ...overrides,
  };
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
      (b.textContent ?? "").includes(text),
    ) ?? null
  );
}

describe("Billing route", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    auth.state = { user: null, isLoading: true };
    api.rows = [];
    csv.downloadCsv.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("one master row per project; folds down to billing-entry detail", async () => {
    // Project pa (Alpha) has two monthly entries; pb (Beta) has one.
    api.rows = [
      row({
        id: 1,
        project_id: "pa",
        project_name: "Alpha",
        customer_name: "AlphaCust",
        billed_to_name: "AlphaCo",
        billing_date: "2026-07-31",
        amount: "1000000",
        contract_total_amount: "3000000",
        is_received: true,
        received_datetime: "2026-07-10T00:00:00Z",
      }),
      row({
        id: 2,
        project_id: "pa",
        project_name: "Alpha",
        customer_name: "AlphaCust",
        billed_to_name: "AlphaCo",
        billing_date: "2026-08-31",
        amount: "1000000",
        contract_total_amount: "3000000",
        is_received: false,
      }),
      row({
        id: 3,
        project_id: "pb",
        project_name: "Beta",
        customer_name: "BetaCust",
        billed_to_name: "BetaCo",
        billing_date: "2026-07-31",
        amount: "500000",
        contract_total_amount: "500000",
        is_received: false,
        project_phase: "in-progress",
      }),
    ];

    // 1) Loading render (authLoading = true): the early return must not skip any hook.
    root.render(<Billing />);
    await flush();
    expect(container.textContent).toContain("読み込み中");

    // 2) Auth resolves on the SAME instance — the render that would throw React #310 if a hook
    // (useMemo/useCallback) were placed below the early returns.
    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<Billing />);
    await flush();

    expect(container.textContent).toContain("請求一覧");
    expect(container.textContent).not.toContain("読み込み中");

    // One master row per project → two fold toggles, both collapsed initially.
    const toggles = () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-expanded]"));
    expect(toggles()).toHaveLength(2);
    expect(toggles().every((b) => b.getAttribute("aria-expanded") === "false")).toBe(true);

    // Master row shows contract cost (契約金額) and summed billing entries (請求合計); 顧客 + 請求先 distinct.
    expect(container.textContent).toContain("AlphaCust");
    expect(container.textContent).toContain("AlphaCo");
    expect(container.textContent).toContain("¥3,000,000"); // 契約金額
    expect(container.textContent).toContain("¥2,000,000"); // 請求合計 = sum of Alpha's two entries

    // Collapsed: the individual entry 請求日 are hidden.
    expect(container.textContent).not.toContain("2026/8/31");

    // Fold down Alpha (first group, AlphaCust) → its billing entries appear.
    toggles()[0].click();
    await flush();
    expect(toggles()[0].getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("2026/7/31");
    expect(container.textContent).toContain("2026/8/31");
  });

  test("CSV button downloads the filtered rows", async () => {
    api.rows = [row({ id: 1, project_name: "Alpha" }), row({ id: 2, project_name: "Beta" })];
    auth.state = { user: { username: "me" }, isLoading: false };

    root.render(<Billing />);
    await flush();

    const button = findButton(container, "CSVダウンロード");
    expect(button).not.toBeNull();
    button?.click();
    await flush();

    expect(csv.downloadCsv).toHaveBeenCalledTimes(1);
    const [, content] = csv.downloadCsv.mock.calls[0];
    expect(content).toContain("Alpha");
    expect(content).toContain("Beta");
  });
});
