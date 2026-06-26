import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "~/lib/auth-context";
import { Layout } from "~/components/layout";
import { CustomerFormModal } from "~/components/customers/CustomerFormModal";
import { useCustomerMutations } from "~/hooks/useCustomerMutations";
import { fetchAllCustomers } from "~/lib/api/pagination";
import type { KippoCustomer } from "~/lib/api/generated/models";

export function meta() {
  return [{ title: "顧客一覧 - Kippo要件管理" }];
}

export default function Customers() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<KippoCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  // Modal state: null = closed; { customer: null } = create; { customer } = edit.
  const [editing, setEditing] = useState<{ customer: KippoCustomer | null } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setCustomers(await fetchAllCustomers());
    } catch (err) {
      console.error("Failed to load customers:", err);
      setError("顧客の読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadCustomers();
    }
  }, [user, loadCustomers]);

  const { isSaving, createCustomer, updateCustomer } = useCustomerMutations(
    loadCustomers,
    setError,
  );

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
    return [...filtered].sort((a, b) => collator.compare(a.name, b.name));
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
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {displayedCustomers.map((customer) => (
                <CustomerListItem
                  key={customer.id}
                  customer={customer}
                  onEdit={() => setEditing({ customer })}
                />
              ))}
            </ul>
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
    </Layout>
  );
}

function CustomerListItem({ customer, onEdit }: { customer: KippoCustomer; onEdit: () => void }) {
  return (
    <li className="px-4 py-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{customer.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
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
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex-shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          編集
        </button>
      </div>
    </li>
  );
}
