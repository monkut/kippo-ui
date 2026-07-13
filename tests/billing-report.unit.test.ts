import { describe, expect, test } from "vitest";
import type { BillingListEntry } from "~/lib/api/billing";
import {
  availableMonths,
  billedToDisplay,
  buildBillingCsv,
  filterBillingRows,
  groupByProject,
  sortGroups,
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
    contract_end_date: "2026-09-30",
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

  test("search matches project / 顧客 / 請求先 / org, case-insensitive", () => {
    expect(filterBillingRows(rows, { ...noFilters, search: "beta" }).map((r) => r.id)).toEqual([2]);
    // 顧客 (customer_name): CustCo is id1 & id2's customer
    expect(filterBillingRows(rows, { ...noFilters, search: "custco" }).map((r) => r.id)).toEqual([
      1, 2,
    ]);
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

describe("groupByProject", () => {
  test("one group per project; entries 請求日 asc; totals sum entries; carries 契約金額; ordered by 顧客", () => {
    const grows: BillingListEntry[] = [
      entry({
        id: 1,
        project_id: "pa",
        project_name: "Alpha",
        customer_name: "AlphaCust",
        billing_date: "2026-08-31",
        amount: "1000000",
        is_received: false,
        contract_total_amount: "3000000",
      }),
      entry({
        id: 2,
        project_id: "pa",
        project_name: "Alpha",
        customer_name: "AlphaCust",
        billing_date: "2026-07-31",
        amount: "1000000",
        is_received: true,
        contract_total_amount: "3000000",
      }),
      entry({
        id: 3,
        project_id: "pb",
        project_name: "Beta",
        customer_name: "BetaCust",
        billing_date: "2026-07-31",
        amount: "500000",
        is_received: false,
        contract_total_amount: "500000",
      }),
    ];
    const groups = groupByProject(grows);
    // one row per project, ordered by 顧客 (AlphaCust before BetaCust)
    expect(groups.map((g) => g.projectName)).toEqual(["Alpha", "Beta"]);
    const alpha = groups[0];
    expect(alpha.entries.map((e) => e.id)).toEqual([2, 1]); // 請求日 ascending
    expect(alpha.contractTotal).toBe("3000000"); // contract cost carried onto the master row
    expect(alpha.contractEndDate).toBe("2026-09-30"); // 契約終了日 carried onto the master row
    expect(alpha.billingType).toBe("monthly"); // 請求方法 carried onto the master row
    expect(alpha.totals.count).toBe(2);
    expect(alpha.totals.amount).toBe(2000000); // summed billing entries (folded-up display)
    expect(alpha.totals.receivedAmount).toBe(1000000);
    expect(groups[1].totals.amount).toBe(500000);
  });
});

describe("sortGroups", () => {
  const groups = groupByProject([
    entry({
      id: 1,
      project_id: "pa",
      project_name: "Alpha",
      contract_end_date: "2026-12-31",
      amount: "100",
      contract_total_amount: "100",
    }),
    entry({
      id: 2,
      project_id: "pb",
      project_name: "Beta",
      contract_end_date: "2026-06-30",
      amount: "900",
      contract_total_amount: "900",
    }),
  ]);

  test("契約終了日 ascending (default) puts the earliest end date first", () => {
    expect(
      sortGroups(groups, { key: "contractEndDate", dir: "asc" }).map((g) => g.projectName),
    ).toEqual(["Beta", "Alpha"]);
  });

  test("direction flips the order", () => {
    expect(
      sortGroups(groups, { key: "contractEndDate", dir: "desc" }).map((g) => g.projectName),
    ).toEqual(["Alpha", "Beta"]);
  });

  test("numeric column (請求合計) sorts numerically", () => {
    expect(sortGroups(groups, { key: "amount", dir: "asc" }).map((g) => g.projectName)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  test("does not mutate the input array", () => {
    const before = groups.map((g) => g.projectName);
    sortGroups(groups, { key: "amount", dir: "desc" });
    expect(groups.map((g) => g.projectName)).toEqual(before);
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
