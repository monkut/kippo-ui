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

  test("renders through loading → authenticated as a flat table (customer + project columns)", async () => {
    api.rows = [
      row({
        id: 1,
        project_name: "Alpha",
        customer_name: "AlphaCust",
        billed_to_name: "AlphaCo",
        amount: "1000000",
        is_received: true,
        received_datetime: "2026-07-10T00:00:00Z",
      }),
      row({
        id: 2,
        project_name: "Beta",
        customer_name: "BetaCust",
        billed_to_name: "BetaCo",
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
    expect(container.textContent).toContain("請求金額計");
    expect(container.textContent).not.toContain("読み込み中");

    // Flat table: exactly one <table>; 顧客 is right of プロジェクト, 請求先 left of 請求方法, no 組織.
    const tables = container.querySelectorAll("table");
    expect(tables).toHaveLength(1);
    const headers = Array.from(tables[0].querySelectorAll("th")).map((th) => th.textContent);
    expect(headers).toEqual([
      "請求日",
      "プロジェクト",
      "顧客",
      "完了",
      "請求先",
      "請求方法",
      "金額",
      "入金日",
    ]);
    expect(headers).not.toContain("組織");

    // 顧客 (customer) and 請求先 (billing dest) are distinct columns, both shown per row.
    expect(container.textContent).toContain("AlphaCust");
    expect(container.textContent).toContain("AlphaCo");
    expect(container.textContent).toContain("BetaCust");
    expect(container.textContent).toContain("BetaCo");

    // 完了 is its own column: exactly one cell reads 完了 (Alpha completed; Beta in-progress is blank).
    const completedCells = Array.from(container.querySelectorAll("td")).filter(
      (td) => td.textContent === "完了",
    );
    expect(completedCells).toHaveLength(1);

    // Received entry shows the 入金日 (date, not a boolean); unreceived shows 未入金.
    expect(container.textContent).toContain("2026/7/10");
    expect(container.textContent).toContain("未入金");
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
