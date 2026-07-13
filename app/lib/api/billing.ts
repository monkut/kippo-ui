// Thin wrapper over the orval-generated billing client (generated/billing): walks all pages of
// GET /api/billing/ so the プロジェクト請求一覧 view can filter and sum the full ledger client-side.
// Re-exports the generated BillingListEntry / BillingListParams so the view and report helpers
// import billing types from one place.
import { billingList } from "./generated/billing/billing";
import type { BillingListEntry, BillingListParams } from "./generated/models";
import { readList } from "./read-list";

export type { BillingListEntry, BillingListParams };

const FETCH_ALL_CONCURRENCY = 5;

/** Fetch every page of /api/billing/ so the view can filter and sum the full set client-side.
 * Page 1 is fetched first (for the count + page size), then the remaining pages concurrently.
 * Throws on any non-200 so a partial fetch surfaces as an error (the view shows its error state)
 * instead of silently truncating the ledger and under-reporting totals. */
export async function fetchAllBillingEntries(
  params?: Omit<BillingListParams, "page">,
): Promise<BillingListEntry[]> {
  const first = await billingList({ ...params, page: 1 });
  if (first.status !== 200 || !first.data) {
    throw new Error(`Failed to load billing entries (HTTP ${first.status})`);
  }
  const firstResults = first.data.results ?? [];
  const count = first.data.count ?? firstResults.length;
  const pageSize = firstResults.length;
  if (!pageSize || count <= pageSize) return firstResults;

  const remainingPages = Array.from({ length: Math.ceil(count / pageSize) - 1 }, (_, i) => i + 2);
  const pages: BillingListEntry[][] = new Array(remainingPages.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(FETCH_ALL_CONCURRENCY, remainingPages.length) },
    async () => {
      while (cursor < remainingPages.length) {
        const idx = cursor++;
        const page = remainingPages[idx];
        const res = await billingList({ ...params, page });
        if (res.status !== 200 || !res.data) {
          throw new Error(`Failed to load billing entries page ${page} (HTTP ${res.status})`);
        }
        pages[idx] = readList<BillingListEntry>(res.data);
      }
    },
  );
  await Promise.all(workers);
  return [...firstResults, ...pages.flat()];
}
