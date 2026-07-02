import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuthGate } from "~/hooks/useAuthGate";
import { Layout } from "~/components/layout";
import { CustomerFormModal } from "~/components/customers/CustomerFormModal";
import {
  CustomerProjectModal,
  type ProjectFormTarget,
} from "~/components/customers/CustomerProjectModal";
import { useCustomerMutations } from "~/hooks/useCustomerMutations";
import { useCustomerProjectMutations } from "~/hooks/useCustomerProjectMutations";
import { fetchAllCustomers } from "~/lib/api/pagination";
import {
  customersActiveProjectsList,
  customersFiscalYearSummaryList,
} from "~/lib/api/generated/customers/customers";
import { organizationsList } from "~/lib/api/generated/organizations/organizations";
import { readList } from "~/lib/api/read-list";
import { formatDisplayDate } from "~/lib/dates";
import type {
  CustomerActiveProject,
  FiscalYearSummary,
  KippoCustomer,
  Organization,
} from "~/lib/api/generated/models";

export function meta() {
  return [{ title: "顧客一覧 - Kippo要件管理" }];
}

const formatJpy = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isNaN(n) ? "-" : `¥${n.toLocaleString("ja-JP")}`;
};

/** Org list defensively (endpoint returns {organizations} at runtime, typed as {results}). */
function extractOrganizations(data: unknown): Organization[] {
  const payload = data as {
    organizations?: Organization[];
    results?: { organizations?: Organization[] }[];
  };
  if (Array.isArray(payload.organizations)) return payload.organizations;
  if (Array.isArray(payload.results)) return payload.results.flatMap((r) => r.organizations ?? []);
  return [];
}

export default function Customers() {
  const { user, authLoading } = useAuthGate();
  const [customers, setCustomers] = useState<KippoCustomer[]>([]);
  const [summaries, setSummaries] = useState<FiscalYearSummary[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [recentEndingOnly, setRecentEndingOnly] = useState(false);
  // Modal state: null = closed; { customer: null } = create; { customer } = edit.
  const [editing, setEditing] = useState<{ customer: KippoCustomer | null } | null>(null);
  // Add-project modal (create a project for a customer). Editing an active project is the
  // dedicated /projects/:id/edit page, reached from the project row link / 編集.
  const [projectModal, setProjectModal] = useState<ProjectFormTarget | null>(null);
  // Expand/collapse of the per-customer active-project detail (lazily fetched).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeProjects, setActiveProjects] = useState<
    Record<string, CustomerActiveProject[] | "loading">
  >({});

  // Organizations for the filter (loaded once); the filter only matters with >1 org.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const response = await organizationsList();
        setOrganizations(extractOrganizations(response.data));
      } catch {
        // non-fatal: the org filter just stays empty
      }
    })();
  }, [user]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    const params = {
      organization: orgFilter || undefined,
      recent_ending: recentEndingOnly || undefined,
    };
    try {
      const [custs, summaryResponse] = await Promise.all([
        fetchAllCustomers(params),
        customersFiscalYearSummaryList(params),
      ]);
      setCustomers(custs);
      setSummaries(readList<FiscalYearSummary>(summaryResponse.data));
      // collapse + drop cached detail so re-filtered rows refetch on expand
      setExpanded(new Set());
      setActiveProjects({});
    } catch (err) {
      console.error("Failed to load customers:", err);
      setError("顧客の読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [orgFilter, recentEndingOnly]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const { isSaving, createCustomer, updateCustomer } = useCustomerMutations(loadData, setError);
  const { isSaving: isSavingProject, createProject } = useCustomerProjectMutations(
    loadData,
    setError,
  );

  const handleToggleExpand = useCallback(
    async (customer: KippoCustomer) => {
      const id = customer.id;
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      // Lazy-load the detail on first expand of a customer with active projects.
      if (customer.active_project_count > 0 && !activeProjects[id]) {
        setActiveProjects((prev) => ({ ...prev, [id]: "loading" }));
        try {
          const response = await customersActiveProjectsList(id);
          setActiveProjects((prev) => ({
            ...prev,
            [id]: readList<CustomerActiveProject>(response.data),
          }));
        } catch {
          setActiveProjects((prev) => ({ ...prev, [id]: [] }));
        }
      }
    },
    [activeProjects],
  );

  // Client-side text search + default sort by active-project count desc, then name.
  const displayedCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? customers.filter((customer) =>
          [customer.name, customer.email, customer.organization_name]
            .filter(Boolean)
            .some((field) => (field as string).toLowerCase().includes(query)),
        )
      : customers;
    const collator = new Intl.Collator("ja");
    return [...filtered].sort(
      (a, b) => b.active_project_count - a.active_project_count || collator.compare(a.name, b.name),
    );
  }, [customers, searchQuery]);

  const handleSubmit = useCallback(
    (payload: Parameters<typeof createCustomer>[0]) => {
      const target = editing?.customer;
      return target ? updateCustomer(target.id, payload) : createCustomer(payload);
    },
    [editing, createCustomer, updateCustomer],
  );

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
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">顧客一覧</h1>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="検索（顧客名・メール・組織）"
              aria-label="顧客検索"
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {organizations.length > 1 && (
              <select
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                aria-label="組織で絞り込み"
                className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">すべての組織</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            )}
            <label className="flex items-center gap-1 text-sm text-gray-600">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={recentEndingOnly}
                onChange={(e) => setRecentEndingOnly(e.target.checked)}
              />
              直近2会計年度に終了案件あり
            </label>
            <button
              type="button"
              onClick={() => setEditing({ customer: null })}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              顧客を追加
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        {!isLoading && summaries.length > 0 && <FiscalYearSummarySection summaries={summaries} />}

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">読み込み中...</div>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">顧客がありません</p>
          </div>
        ) : displayedCustomers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">「{searchQuery}」に一致する顧客がありません</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-x-auto sm:rounded-md">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">顧客名</th>
                  <th className="px-4 py-3">アクティブプロジェクト</th>
                  <th className="px-4 py-3 text-center">反社チェック</th>
                  <th className="px-4 py-3">更新日時</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayedCustomers.map((customer) => (
                  <CustomerRow
                    key={customer.id}
                    customer={customer}
                    expanded={expanded.has(customer.id)}
                    detail={activeProjects[customer.id]}
                    onToggle={() => handleToggleExpand(customer)}
                    onEdit={() => setEditing({ customer })}
                    onAddProject={() => setProjectModal({ customer })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CustomerFormModal
        open={editing !== null}
        isSaving={isSaving}
        customer={editing?.customer}
        onClose={() => setEditing(null)}
        onSubmit={handleSubmit}
      />

      <CustomerProjectModal
        open={projectModal !== null}
        target={projectModal}
        isSaving={isSavingProject}
        onClose={() => setProjectModal(null)}
        onCreate={createProject}
      />
    </Layout>
  );
}

// Per-organization current-fiscal-year summary (顧客数 / 今期終了予定契約数 / 計画売上 / 入金済 +
// month-by-month planned breakdown), mirroring KippoCustomerAdmin's changelist header.
function FiscalYearSummarySection({ summaries }: { summaries: FiscalYearSummary[] }) {
  return (
    <div className="space-y-4">
      {summaries.map((summary) => (
        <div
          key={summary.organization.id}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900">
              {summary.organization.name}
              <span className="ml-2 text-xs font-normal text-gray-500">
                {summary.fiscal_year_start} 〜 {summary.fiscal_year_end}（今期）
              </span>
            </h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700">
              <span>顧客数: {summary.customer_count}</span>
              <span>今期終了予定契約数: {summary.project_count}</span>
              <span>計画売上: {formatJpy(summary.planned_total)}</span>
              <span>入金済: {formatJpy(summary.received_total)}</span>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-gray-500">
                  {summary.monthly_planned_breakdown.map((row) => (
                    <th key={row.month} className="px-2 py-1 text-right font-medium">
                      {row.month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="text-gray-700">
                  {summary.monthly_planned_breakdown.map((row) => (
                    <td key={row.month} className="px-2 py-1 text-right whitespace-nowrap">
                      {formatJpy(row.amount)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomerRow({
  customer,
  expanded,
  detail,
  onToggle,
  onEdit,
  onAddProject,
}: {
  customer: KippoCustomer;
  expanded: boolean;
  detail: CustomerActiveProject[] | "loading" | undefined;
  onToggle: () => void;
  onEdit: () => void;
  onAddProject: () => void;
}) {
  const count = customer.active_project_count;
  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900">{customer.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
            <span>{customer.organization_name}</span>
            {customer.email && <span>{customer.email}</span>}
            {customer.document_url && (
              <a
                href={customer.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                ドキュメント
              </a>
            )}
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          {count > 0 ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
            >
              <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span>
              <span className="font-medium">{count}</span>
              <span className="text-gray-500">
                ({formatJpy(customer.active_projects_contract_total)})
              </span>
            </button>
          ) : (
            <span className="text-gray-400">0</span>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          {customer.compliance_verified ? (
            <span className="text-green-600" title="確認済み">
              ✓
            </span>
          ) : (
            <span className="text-red-500" title="未確認">
              ✗
            </span>
          )}
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-gray-500">
          {formatDisplayDate(customer.updated_datetime)}
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={onAddProject}
            className="mr-2 rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
          >
            ＋プロジェクト
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            編集
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={5} className="px-4 py-3">
            <ActiveProjectsDetail detail={detail} />
          </td>
        </tr>
      )}
    </>
  );
}

function ActiveProjectsDetail({
  detail,
}: {
  detail: CustomerActiveProject[] | "loading" | undefined;
}) {
  if (detail === "loading" || detail === undefined) {
    return <div className="text-sm text-gray-500">読み込み中...</div>;
  }
  if (detail.length === 0) {
    return <div className="text-sm text-gray-500">アクティブなプロジェクトがありません</div>;
  }
  // Order by 契約終了日 earliest → latest; projects without an end date sort last.
  const sorted = [...detail].sort((a, b) => {
    if (!a.contract_end_date) return 1;
    if (!b.contract_end_date) return -1;
    return a.contract_end_date.localeCompare(b.contract_end_date);
  });
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left text-xs font-medium text-gray-500">
          <th className="px-2 py-1">プロジェクト</th>
          <th className="px-2 py-1 text-right">入金済合計(今期)</th>
          <th className="px-2 py-1 text-right">契約金額</th>
          <th className="px-2 py-1">契約終了日</th>
          <th className="px-2 py-1" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {sorted.map((project) => (
          <tr key={project.id} className="text-gray-700">
            <td className="px-2 py-1">
              {/* KippoProject record edit in the SPA (not /projects/:id, which is the requirements view). */}
              <Link to={`/projects/${project.id}/edit`} className="text-indigo-600 hover:underline">
                {project.name}
              </Link>
            </td>
            <td className="px-2 py-1 text-right">{formatJpy(project.received_total_current_fy)}</td>
            <td className="px-2 py-1 text-right">{formatJpy(project.contract_amount)}</td>
            <td className="px-2 py-1">{formatDisplayDate(project.contract_end_date)}</td>
            <td className="px-2 py-1 text-right">
              {/* Same KippoProject record edit page as the project-name link (one edit interface). */}
              <Link
                to={`/projects/${project.id}/edit`}
                className="inline-block rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                編集
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
