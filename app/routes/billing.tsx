import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Layout } from "~/components/layout";
import { useAuthGate } from "~/hooks/useAuthGate";
import { type BillingListEntry, fetchAllBillingEntries } from "~/lib/api/billing";
import {
  BILLING_TYPE_LABELS,
  type BillingFilters,
  PRICING_BASIS_LABELS,
  type ProjectGroup,
  type ReceivedFilter,
  availableMonths,
  buildBillingCsv,
  filterBillingRows,
  groupByProject,
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
  const groups = useMemo<ProjectGroup[]>(() => groupByProject(filteredRows), [filteredRows]);
  const totals = useMemo(() => summarize(filteredRows), [filteredRows]);
  const months = useMemo(() => availableMonths(rows), [rows]);

  const toggleExpanded = useCallback((projectId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  const handleDownloadCsv = useCallback(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    // CSV stays one row per billing entry, in the on-screen (per-project) order.
    downloadCsv(`billing-${stamp}.csv`, buildBillingCsv(groups.flatMap((g) => g.entries)));
  }, [groups]);

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
              placeholder="検索（プロジェクト・顧客・請求先）"
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
          <div className="bg-white shadow overflow-x-auto sm:rounded-md">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-2">契約終了日</th>
                  <th className="px-4 py-2">プロジェクト</th>
                  <th className="px-4 py-2">顧客</th>
                  <th className="px-4 py-2 text-center">完了</th>
                  <th className="px-4 py-2">請求先</th>
                  <th className="px-4 py-2 text-right">契約金額</th>
                  <th className="px-4 py-2 text-right">請求件数</th>
                  <th className="px-4 py-2 text-right">請求合計</th>
                  <th className="px-4 py-2 text-right">入金済</th>
                  <th className="px-4 py-2 text-right">未入金</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {groups.map((group) => (
                  <ProjectRow
                    key={group.projectId}
                    group={group}
                    expanded={expanded.has(group.projectId)}
                    onToggle={() => toggleExpanded(group.projectId)}
                  />
                ))}
              </tbody>
            </table>
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

// Master row: one line per project — contract cost (契約金額) + summed billing entries (請求合計) —
// with a fold-down (▶ / ▼) that reveals the project's individual billing entries.
function ProjectRow({
  group,
  expanded,
  onToggle,
}: {
  group: ProjectGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-2 whitespace-nowrap align-top text-gray-700">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={`${group.projectName} の請求明細を${expanded ? "折りたたむ" : "展開"}`}
            className="mr-2 text-gray-400 hover:text-gray-700"
          >
            <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>
              ▶
            </span>
          </button>
          {formatDisplayDate(group.contractEndDate)}
        </td>
        <td className="px-4 py-2">
          <Link
            to={`/projects/${group.projectId}/edit`}
            className="font-medium text-indigo-600 hover:underline"
          >
            {group.projectName}
          </Link>
        </td>
        <td className="px-4 py-2 text-gray-700">{group.customerName || "-"}</td>
        <td className="px-4 py-2 text-center">
          {group.phase === "completed" && (
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">完了</span>
          )}
        </td>
        <td className="px-4 py-2 text-gray-700">{group.billedTo}</td>
        <td className="px-4 py-2 text-right whitespace-nowrap text-gray-700">
          {formatJpy(group.contractTotal)}
        </td>
        <td className="px-4 py-2 text-right text-gray-700">{group.totals.count}</td>
        <td className="px-4 py-2 text-right whitespace-nowrap font-medium text-gray-900">
          {formatJpy(group.totals.amount)}
        </td>
        <td className="px-4 py-2 text-right whitespace-nowrap text-green-700">
          {formatJpy(group.totals.receivedAmount)}
        </td>
        <td className="px-4 py-2 text-right whitespace-nowrap text-amber-700">
          {formatJpy(group.totals.unreceivedAmount)}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={10} className="px-0 py-0">
            <div className="px-10 py-2">
              <BillingEntriesDetail entries={group.entries} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Fold-down detail: the project's individual billing entries (how much + when + 入金日).
function BillingEntriesDetail({ entries }: { entries: BillingListEntry[] }) {
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left text-xs font-medium text-gray-500">
          <th className="px-2 py-1">請求日</th>
          <th className="px-2 py-1">請求方法</th>
          <th className="px-2 py-1 text-right">金額</th>
          <th className="px-2 py-1">入金日</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {entries.map((entry) => {
          const billingType = BILLING_TYPE_LABELS[entry.billing_type] ?? entry.billing_type;
          const pricingBasis = PRICING_BASIS_LABELS[entry.pricing_basis] ?? entry.pricing_basis;
          return (
            <tr key={entry.id} className="text-gray-700">
              <td className="px-2 py-1 whitespace-nowrap">
                {formatDisplayDate(entry.billing_date)}
              </td>
              <td className="px-2 py-1 whitespace-nowrap text-gray-600">
                {billingType} / {pricingBasis}
              </td>
              <td className="px-2 py-1 text-right whitespace-nowrap font-medium text-gray-900">
                {formatJpy(entry.amount)}
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                {entry.is_received && entry.received_datetime ? (
                  <span className="text-green-700">
                    {formatDisplayDate(entry.received_datetime)}
                  </span>
                ) : (
                  <span className="text-amber-700">未入金</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
