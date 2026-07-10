import { describe, expect, test } from "vitest";
import type { BillingListEntry } from "~/lib/api/billing";
import {
  availableMonths,
  billedToDisplay,
  buildBillingCsv,
  filterBillingRows,
  sortBillingRows,
  summarize,
} from "~/lib/billing-report";

function entry(overrides: Partial<BillingListEntry>): BillingListEntry {
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
    project_phase: "in-progress",
    project_actual_date: null,
    billed_to_name: "BillCo",
    customer_name: "CustCo",
    billing_type: "monthly",
    pricing_basis: "fixed",
    contract_total_amount: "3000000",
    ...overrides,
  };
}

const rows: BillingListEntry[] = [
  entry({
    id: 1,
    billing_date: "2026-07-31",
    amount: "1000000",
    is_received: true,
    project_name: "Alpha",
  }),
  entry({
    id: 2,
    billing_date: "2026-08-31",
    amount: "2000000",
    is_received: false,
    project_name: "Beta",
    project_phase: "completed",
  }),
  entry({
    id: 3,
    billing_date: "2026-08-15",
    amount: "500000",
    is_received: true,
    project_name: "Gamma",
    billed_to_name: null,
    customer_name: "FallbackCo",
  }),
];

const noFilters = { search: "", completedOnly: false, received: "all" as const, month: "" };

describe("billedToDisplay", () => {
  test("prefers billed_to_name, falls back to customer_name, then -", () => {
    expect(billedToDisplay(entry({ billed_to_name: "A", customer_name: "B" }))).toBe("A");
    expect(billedToDisplay(entry({ billed_to_name: null, customer_name: "B" }))).toBe("B");
    expect(billedToDisplay(entry({ billed_to_name: null, customer_name: null }))).toBe("-");
  });
});

describe("filterBillingRows", () => {
  test("no filters returns all", () => {
    expect(filterBillingRows(rows, noFilters)).toHaveLength(3);
  });

  test("completedOnly keeps only completed-phase rows", () => {
    const out = filterBillingRows(rows, { ...noFilters, completedOnly: true });
    expect(out.map((r) => r.id)).toEqual([2]);
  });

  test("received filter", () => {
    expect(
      filterBillingRows(rows, { ...noFilters, received: "received" }).map((r) => r.id),
    ).toEqual([1, 3]);
    expect(
      filterBillingRows(rows, { ...noFilters, received: "unreceived" }).map((r) => r.id),
    ).toEqual([2]);
  });

  test("month filter matches YYYY-MM prefix of billing_date", () => {
    expect(filterBillingRows(rows, { ...noFilters, month: "2026-08" }).map((r) => r.id)).toEqual([
      2, 3,
    ]);
  });

  test("search matches 請求先 / project / org, case-insensitive, incl. customer fallback", () => {
    expect(filterBillingRows(rows, { ...noFilters, search: "beta" }).map((r) => r.id)).toEqual([2]);
    // Gamma's 請求先 falls back to customer_name "FallbackCo"
    expect(filterBillingRows(rows, { ...noFilters, search: "fallback" }).map((r) => r.id)).toEqual([
      3,
    ]);
  });
});

describe("summarize", () => {
  test("totals split received / unreceived", () => {
    const t = summarize(rows);
    expect(t.count).toBe(3);
    expect(t.amount).toBe(3500000);
    expect(t.receivedAmount).toBe(1500000);
    expect(t.unreceivedAmount).toBe(2000000);
  });
});

describe("sortBillingRows", () => {
  test("orders by 請求日 ascending; 請求先 then project break same-day ties; no input mutation", () => {
    const grows: BillingListEntry[] = [
      entry({
        id: 10,
        project_name: "Alpha",
        billed_to_name: "AlphaCo",
        billing_date: "2026-08-31",
      }),
      entry({ id: 12, project_name: "Beta", billed_to_name: "BetaCo", billing_date: "2026-07-31" }),
      entry({
        id: 11,
        project_name: "Alpha",
        billed_to_name: "AlphaCo",
        billing_date: "2026-07-31",
      }),
    ];
    // 07-31 rows first (AlphaCo before BetaCo on the tie), then 08-31
    expect(sortBillingRows(grows).map((r) => r.id)).toEqual([11, 12, 10]);
    expect(grows.map((r) => r.id)).toEqual([10, 12, 11]);
  });
});

describe("availableMonths", () => {
  test("distinct months, newest first", () => {
    expect(availableMonths(rows)).toEqual(["2026-08", "2026-07"]);
  });
});

describe("buildBillingCsv", () => {
  test("header + one line per row, labels localized, amount raw", () => {
    const csv = buildBillingCsv([rows[1]]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "請求月,請求日,請求先,プロジェクト,組織,請求方法,料金体系,金額,入金状況,入金日,契約金額,フェーズ,完了日,手動追加,備考",
    );
    expect(lines[1]).toContain("2026-08");
    expect(lines[1]).toContain("Beta");
    expect(lines[1]).toContain("月額"); // billing_type label
    expect(lines[1]).toContain("固定"); // pricing_basis label
    expect(lines[1]).toContain("2000000"); // raw amount
    expect(lines[1]).toContain("未入金");
  });

  test("escapes fields containing commas or quotes", () => {
    const csv = buildBillingCsv([entry({ note: 'a,b "c"', project_name: "Alpha" })]);
    expect(csv).toContain('"a,b ""c"""');
  });
});
