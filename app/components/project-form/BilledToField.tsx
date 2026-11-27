import { useEffect, useState } from "react";
import { customersList } from "~/lib/api/generated/customers/customers";
import type { KippoCustomer } from "~/lib/api/generated/models";
import { readList } from "~/lib/api/read-list";

// Debounced customer search within the project's organization (mirrors CreateProjectModal's
// useCustomerSearch; kept separate so this picker needn't couple to that modal's KippoCustomer-specific
// field). Backs the 請求先 picker below.
function useCustomerSearch(organizationId: string, query: string): KippoCustomer[] {
  const [results, setResults] = useState<KippoCustomer[]>([]);
  useEffect(() => {
    if (!organizationId || query.trim().length === 0) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await customersList({
          organization: organizationId,
          search: query.trim(),
        });
        if (!cancelled) setResults(readList<KippoCustomer>(response.data));
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [organizationId, query]);
  return results;
}

// 請求先 (billed_to, kippo#31) — the customer invoiced for the contract. Defaults to the project's
// customer server-side; editable here to a different customer in the project's organization. The
// backend rejects a customer outside the project's org, so the search is scoped to it.
export function BilledToField({
  organizationId,
  projectCustomerId,
  projectCustomerName,
  billedToId,
  billedToName,
  onSelect,
  disabled,
}: {
  organizationId: string;
  projectCustomerId: string;
  projectCustomerName: string | null;
  billedToId: string;
  billedToName: string | null;
  onSelect: (customer: { id: string; name: string } | null) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const results = useCustomerSearch(organizationId, query);
  const canResetToProjectCustomer = projectCustomerId !== "" && projectCustomerId !== billedToId;

  const stopEditing = () => {
    setEditing(false);
    setQuery("");
  };

  return (
    <div>
      <span className="block text-sm font-medium text-gray-700 mb-1">請求先</span>
      {editing && !disabled ? (
        <div className="relative">
          <input
            id="c-billed-to"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="請求先を顧客名で検索"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {query.trim().length > 0 && results.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect({ id: result.id, name: result.name });
                      stopEditing();
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-indigo-50"
                  >
                    {result.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs">
            {canResetToProjectCustomer && (
              <button
                type="button"
                onClick={() => {
                  onSelect({ id: projectCustomerId, name: projectCustomerName ?? "" });
                  stopEditing();
                }}
                className="text-indigo-600 hover:text-indigo-800"
              >
                プロジェクトの顧客（{projectCustomerName}）にする
              </button>
            )}
            <button
              type="button"
              onClick={stopEditing}
              className="text-gray-500 hover:text-gray-700"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-md border border-gray-300 px-3 py-2 text-sm">
          <span className="font-medium text-gray-800">
            {billedToName ?? "（未設定：プロジェクトの顧客に請求）"}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >
              変更
            </button>
          )}
        </div>
      )}
    </div>
  );
}
