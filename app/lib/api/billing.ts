// Client for the flat cross-project billing list endpoint (GET /api/billing/), which backs the
// 請求一覧 view. Hand-written (not orval-generated) because the endpoint ships in a kippo release
// AFTER this UI PR; once `pnpm update:api` picks it up this module can be swapped for the generated
// `billingList` fn. Matches the generated client's { status, data, headers } return convention by
// going through the same `customFetch` mutator.

import { customFetch } from "./custom-fetch";

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

/** Walk all pages of /api/billing/ so the view can filter and sum the full set client-side.
 * Sequential (the ledger is bounded); stops on a non-200, the last page, or an empty page. */
export async function fetchAllBillingEntries(
  params?: Omit<BillingListParams, "page">,
): Promise<BillingListEntry[]> {
  const collected: BillingListEntry[] = [];
  for (let page = 1; ; page += 1) {
    const res = await billingList({ ...params, page });
    if (res.status !== 200 || !res.data) break;
    const { data } = res;
    if (Array.isArray(data)) {
      collected.push(...data);
      break; // non-paginated response — everything is here
    }
    const results = data.results ?? [];
    collected.push(...results);
    const count = data.count ?? collected.length;
    if (results.length === 0 || collected.length >= count) break;
  }
  return collected;
}
