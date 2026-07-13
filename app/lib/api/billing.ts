// Client for the flat cross-project billing list endpoint (GET /api/billing/), which backs the
// 請求一覧 view. Hand-written (not orval-generated) because the endpoint ships in a kippo release
// AFTER this UI PR; once `pnpm update:api` picks it up this module can be swapped for the generated
// `billingList` fn. Matches the generated client's { status, data, headers } return convention by
// going through the same `customFetch` mutator.

import { customFetch } from "./custom-fetch";
import { readList } from "./read-list";

const FETCH_ALL_CONCURRENCY = 5;

/** One denormalized billing-ledger row, mirroring BillingListEntrySerializer on the backend. */
export interface BillingListEntry {
  id: number;
  billing_date: string;
  amount: string; // JPY, DecimalField serialized as string
  is_manual: boolean;
  is_received: boolean;
  received_datetime: string | null;
  received_by_username: string | null;
  note: string;
  project_id: string;
  project_name: string;
  organization_name: string;
  project_phase: string;
  project_actual_date: string | null;
  billed_to_name: string | null;
  customer_name: string | null;
  billing_type: string; // "delivery" | "monthly"
  pricing_basis: string; // "fixed" | "effort"
  contract_total_amount: string | null;
  contract_end_date: string | null;
}

export interface BillingListParams {
  month?: string; // YYYY-MM
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  project?: string; // project UUID
  page?: number;
}

type BillingListResponse = {
  status: number;
  data?: { count?: number; results?: BillingListEntry[] } | BillingListEntry[];
  headers?: Headers;
};

function buildUrl(params?: BillingListParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") search.append(key, String(value));
  }
  const qs = search.toString();
  return qs ? `/api/billing/?${qs}` : "/api/billing/";
}

export const billingList = (params?: BillingListParams): Promise<BillingListResponse> =>
  customFetch<BillingListResponse>(buildUrl(params), { method: "GET" });

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
  if (Array.isArray(first.data)) return first.data; // non-paginated response — everything is here

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
