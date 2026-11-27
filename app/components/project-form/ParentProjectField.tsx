import { useEffect, useState } from "react";
import type { KippoProject } from "~/lib/api/generated/models";
import { projectsList } from "~/lib/api/generated/projects/projects";
import { readList } from "~/lib/api/read-list";
import { formatProjectWithCustomer } from "~/lib/format-project";

// Optional parent_project picker with project-name search. Queries the org-scoped project list
// (projectsList?search=) and limits candidates to the SAME KippoCustomer as the project being
// edited (continuation parents share a customer), excluding the project itself. Falls back to the same
// organization when the project has no customer. The backend rejects a cross-org / self parent.
export function ParentProjectField({
  organizationId,
  customerId,
  currentProjectId,
  selectedId,
  selectedName,
  onSelect,
}: {
  organizationId: string;
  customerId: string;
  currentProjectId: string;
  selectedId: string;
  selectedName: string | null;
  onSelect: (id: string | null, name: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; name: string; customer_name: string | null }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Fetch whenever the field is open (focused) — even with an empty query — so focusing shows the
    // full candidate list; typing then narrows it. Scope to the project's customer server-side
    // (?customer=); without a customer, fall back to a client-side org filter (the list is already
    // org-scoped to the user's memberships).
    if (!open) return;
    const q = query.trim();
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const response = await projectsList({
          page_size: 50,
          ...(q ? { search: q } : {}),
          ...(customerId ? { customer: customerId } : {}),
        });
        if (cancelled) return;
        const items = readList<KippoProject>(response.data)
          .filter(
            (p) => p.id !== currentProjectId && (customerId || p.organization === organizationId),
          )
          .map((p) => ({ id: p.id, name: p.name, customer_name: p.customer_name }));
        setResults(items);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, query, organizationId, customerId, currentProjectId]);

  return (
    <div>
      <span className="block text-sm font-medium text-gray-700 mb-1">親プロジェクト</span>
      {selectedId ? (
        <div className="flex items-center gap-2 text-sm text-gray-800">
          <span>{selectedName || selectedId}</span>
          <button
            type="button"
            onClick={() => onSelect(null, null)}
            className="text-xs text-indigo-600 hover:underline"
          >
            クリア
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            // Delay close so a click on a result (which blurs the input) still registers.
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="プロジェクト名で検索..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {open && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
              {loading ? (
                <p className="px-3 py-2 text-sm text-gray-500">検索中...</p>
              ) : results.length > 0 ? (
                <ul>
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(r.id, r.name);
                          setQuery("");
                          setOpen(false);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
                      >
                        {formatProjectWithCustomer(r.name, r.customer_name)}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-2 text-sm text-gray-500">
                  この顧客に関連するプロジェクトがありません
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
