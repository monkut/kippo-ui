// Pure helpers for the 請求一覧 (billing list) view: labels, filtering, per-project grouping,
// summation and CSV serialization. Kept free of React/DOM so they are unit-testable and reused
// by both the route component and its tests. The download side-effect lives in ./csv.

import type { BillingListEntry } from "~/lib/api/billing";

export const BILLING_TYPE_LABELS: Record<string, string> = {
  delivery: "納品",
  monthly: "月額",
};

export const PRICING_BASIS_LABELS: Record<string, string> = {
  fixed: "固定",
  effort: "実績",
};

/** The project phase key that counts as "完了" for the 完了案件のみ toggle. */
export const COMPLETED_PHASE = "completed";

export type ReceivedFilter = "all" | "received" | "unreceived";

export interface BillingFilters {
  search: string;
  completedOnly: boolean;
  received: ReceivedFilter;
  month: string; // "" = all months, else "YYYY-MM"
}

/** 請求先: the contract's billed_to, falling back to the project's 顧客, else "-". */
export function billedToDisplay(row: BillingListEntry): string {
  return row.billed_to_name || row.customer_name || "-";
}

/** "2026-08-31" → "2026-08". Empty-safe. */
export function billingMonth(row: BillingListEntry): string {
  return (row.billing_date ?? "").slice(0, 7);
}

function amountOf(row: BillingListEntry): number {
  const n = Number(row.amount);
  return Number.isFinite(n) ? n : 0;
}

/** Apply the UI filters. Free-text search matches 請求先 / プロジェクト / 組織 (case-insensitive). */
export function filterBillingRows(
  rows: BillingListEntry[],
  filters: BillingFilters,
): BillingListEntry[] {
  const query = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.completedOnly && row.project_phase !== COMPLETED_PHASE) return false;
    if (filters.received === "received" && !row.is_received) return false;
    if (filters.received === "unreceived" && row.is_received) return false;
    if (filters.month && billingMonth(row) !== filters.month) return false;
    if (query) {
      const haystack = [billedToDisplay(row), row.project_name, row.organization_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export interface BillingTotals {
  count: number;
  amount: number;
  receivedAmount: number;
  unreceivedAmount: number;
}

export function summarize(rows: BillingListEntry[]): BillingTotals {
  return rows.reduce<BillingTotals>(
    (acc, row) => {
      const value = amountOf(row);
      acc.count += 1;
      acc.amount += value;
      if (row.is_received) acc.receivedAmount += value;
      else acc.unreceivedAmount += value;
      return acc;
    },
    { count: 0, amount: 0, receivedAmount: 0, unreceivedAmount: 0 },
  );
}

/** Order rows for the flat table by 請求日 ascending (chronological ledger). 請求先 then project
 * name break ties so same-day rows stay deterministic. */
export function sortBillingRows(rows: BillingListEntry[]): BillingListEntry[] {
  const collator = new Intl.Collator("ja");
  return [...rows].sort(
    (a, b) =>
      a.billing_date.localeCompare(b.billing_date) ||
      collator.compare(billedToDisplay(a), billedToDisplay(b)) ||
      collator.compare(a.project_name, b.project_name),
  );
}

/** Distinct 請求月 present in the rows, newest first — drives the month filter dropdown. */
export function availableMonths(rows: BillingListEntry[]): string[] {
  return [...new Set(rows.map(billingMonth).filter(Boolean))].sort((a, b) => b.localeCompare(a));
}

const CSV_HEADERS = [
  "請求月",
  "請求日",
  "請求先",
  "プロジェクト",
  "組織",
  "請求方法",
  "料金体系",
  "金額",
  "入金状況",
  "入金日",
  "契約金額",
  "フェーズ",
  "完了日",
  "手動追加",
  "備考",
] as const;

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialize rows to CSV (no BOM — the download helper adds it for Excel). One row per entry,
 * in the given order, so the export matches exactly what the filtered table shows. */
export function buildBillingCsv(rows: BillingListEntry[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        billingMonth(row),
        row.billing_date,
        billedToDisplay(row),
        row.project_name,
        row.organization_name,
        BILLING_TYPE_LABELS[row.billing_type] ?? row.billing_type,
        PRICING_BASIS_LABELS[row.pricing_basis] ?? row.pricing_basis,
        row.amount,
        row.is_received ? "入金済" : "未入金",
        row.received_datetime ? new Date(row.received_datetime).toLocaleDateString("ja-JP") : "",
        row.contract_total_amount ?? "",
        row.project_phase,
        row.project_actual_date ?? "",
        row.is_manual ? "手動" : "",
        row.note ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}
