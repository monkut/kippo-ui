import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Layout } from "~/components/layout";
import { useAuthGate } from "~/hooks/useAuthGate";
import { type BillingListEntry, fetchAllBillingEntries } from "~/lib/api/billing";
import {
  BILLING_TYPE_LABELS,
  type BillingFilters,
  type MonthGroup,
  PRICING_BASIS_LABELS,
  type ReceivedFilter,
  availableMonths,
  billedToDisplay,
  buildBillingCsv,
  filterBillingRows,
  groupByMonth,
  summarize,
} from "~/lib/billing-report";
import { downloadCsv } from "~/lib/csv";
import { formatDisplayDate } from "~/lib/dates";

export function meta() {
  return [{ title: "請求一覧 - Kippo要件管理" }];
}

const formatJpy = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isNaN(n) ? "-" : `¥${n.toLocaleString("ja-JP")}`;
};

export default function Billing() {
  const { user, authLoading } = useAuthGate();
  const [rows, setRows] = useState<BillingListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [completedOnly, setCompletedOnly] = useState(false);
  const [received, setReceived] = useState<ReceivedFilter>("all");
  const [month, setMonth] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const entries = await fetchAllBillingEntries();
        if (!cancelled) setRows(entries);
      } catch (err) {
        console.error("Failed to load billing entries:", err);
        if (!cancelled) setError("請求データの読み込みに失敗しました");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filters: BillingFilters = useMemo(
    () => ({ search, completedOnly, received, month }),
    [search, completedOnly, received, month],
  );
  const filteredRows = useMemo(() => filterBillingRows(rows, filters), [rows, filters]);
  const groups = useMemo<MonthGroup[]>(() => groupByMonth(filteredRows), [filteredRows]);
  const totals = useMemo(() => summarize(filteredRows), [filteredRows]);
  const months = useMemo(() => availableMonths(rows), [rows]);

  const handleDownloadCsv = useCallback(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`billing-${stamp}.csv`, buildBillingCsv(filteredRows));
  }, [filteredRows]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">請求一覧</h1>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="検索（請求先・プロジェクト・組織）"
              aria-label="請求検索"
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="請求月で絞り込み"
              className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">すべての月</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={received}
              onChange={(e) => setReceived(e.target.value as ReceivedFilter)}
              aria-label="入金状況で絞り込み"
              className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">入金状況：すべて</option>
              <option value="received">入金済</option>
              <option value="unreceived">未入金</option>
            </select>
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={completedOnly}
                onChange={(e) => setCompletedOnly(e.target.checked)}
              />
              完了案件のみ
            </label>
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={filteredRows.length === 0}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              CSVダウンロード
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        <BillingSummaryBar totals={totals} />

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">読み込み中...</div>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">請求データがありません</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">条件に一致する請求がありません</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <MonthSection key={group.month} group={group} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

// Grand-total bar that live-updates as the filters narrow the rows.
function BillingSummaryBar({ totals }: { totals: ReturnType<typeof summarize> }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm">
      <span className="text-gray-700">
        件数: <span className="font-semibold">{totals.count.toLocaleString("ja-JP")}</span>
      </span>
      <span className="text-gray-700">
        請求金額計: <span className="font-semibold">{formatJpy(totals.amount)}</span>
      </span>
      <span className="text-green-700">入金済: {formatJpy(totals.receivedAmount)}</span>
      <span className="text-amber-700">未入金: {formatJpy(totals.unreceivedAmount)}</span>
    </div>
  );
}

function MonthSection({ group }: { group: MonthGroup }) {
  return (
    <div className="bg-white shadow overflow-x-auto sm:rounded-md">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2">
        <h2 className="text-base font-semibold text-gray-900">{group.month}</h2>
        <div className="flex flex-wrap gap-x-4 text-xs text-gray-600">
          <span>件数: {group.totals.count}</span>
          <span>計: {formatJpy(group.totals.amount)}</span>
          <span className="text-green-700">入金済: {formatJpy(group.totals.receivedAmount)}</span>
          <span className="text-amber-700">未入金: {formatJpy(group.totals.unreceivedAmount)}</span>
        </div>
      </div>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-4 py-2">請求日</th>
            <th className="px-4 py-2">請求先</th>
            <th className="px-4 py-2">プロジェクト</th>
            <th className="px-4 py-2">請求方法</th>
            <th className="px-4 py-2 text-right">金額</th>
            <th className="px-4 py-2 text-center">入金</th>
            <th className="px-4 py-2">入金日</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {group.rows.map((row) => (
            <BillingRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BillingRow({ row }: { row: BillingListEntry }) {
  const billingType = BILLING_TYPE_LABELS[row.billing_type] ?? row.billing_type;
  const pricingBasis = PRICING_BASIS_LABELS[row.pricing_basis] ?? row.pricing_basis;
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2 whitespace-nowrap text-gray-700">
        {formatDisplayDate(row.billing_date)}
      </td>
      <td className="px-4 py-2 text-gray-700">{billedToDisplay(row)}</td>
      <td className="px-4 py-2">
        <Link
          to={`/projects/${row.project_id}/edit`}
          className="font-medium text-indigo-600 hover:underline"
        >
          {row.project_name}
        </Link>
        <div className="mt-0.5 text-xs text-gray-500">
          {row.organization_name}
          {row.project_phase === "completed" && (
            <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-green-700">完了</span>
          )}
        </div>
      </td>
      <td className="px-4 py-2 whitespace-nowrap text-gray-600">
        {billingType} / {pricingBasis}
      </td>
      <td className="px-4 py-2 text-right whitespace-nowrap font-medium text-gray-900">
        {formatJpy(row.amount)}
      </td>
      <td className="px-4 py-2 text-center">
        {row.is_received ? (
          <span className="text-green-600" title="入金済">
            ✓
          </span>
        ) : (
          <span className="text-gray-300" title="未入金">
            —
          </span>
        )}
      </td>
      <td className="px-4 py-2 whitespace-nowrap text-gray-500">
        {row.received_datetime ? formatDisplayDate(row.received_datetime) : "-"}
      </td>
    </tr>
  );
}
