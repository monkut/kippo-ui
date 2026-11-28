import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

// Customers route (/customers): the customer list and the organization filter. Drives
// authLoading → authenticated so a hook placed after an early return (React #310) fails here.

const auth = vi.hoisted(() => ({
  state: { user: null as { username: string } | null, isLoading: true },
}));
const api = vi.hoisted(() => ({
  fetchAllCustomers: vi.fn(),
  customersFiscalYearSummaryList: vi.fn(),
  organizationsList: vi.fn(),
}));

vi.mock("react-router", () => ({
  useNavigate: () => () => {},
  useLocation: () => ({ pathname: "/customers" }),
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/lib/auth-context", () => ({ useAuth: () => auth.state }));
vi.mock("~/components/layout", () => ({
  Layout: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/lib/api/pagination", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchAllCustomers: (...a: unknown[]) => api.fetchAllCustomers(...a),
}));
vi.mock("~/lib/api/generated/customers/customers", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  customersFiscalYearSummaryList: (...a: unknown[]) => api.customersFiscalYearSummaryList(...a),
}));
vi.mock("~/lib/api/generated/organizations/organizations", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  organizationsList: (...a: unknown[]) => api.organizationsList(...a),
}));

import Customers from "../app/routes/customers";

async function waitFor<T>(probe: () => T | null | undefined, timeout = 8000): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = probe();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

const hasText = (container: HTMLElement, text: string) =>
  container.textContent?.includes(text) ? true : null;

const organizationFilter = (container: HTMLElement) =>
  container.querySelector<HTMLSelectElement>('select[aria-label="組織で絞り込み"]');

function customer(id: string, name: string, organizationName: string) {
  return {
    id,
    name,
    email: "",
    organization: `org-${organizationName}`,
    organization_name: organizationName,
    active_project_count: 0,
  };
}

const TWO_ORGANIZATIONS = {
  status: 200,
  data: {
    organizations: [
      { id: "org-a", name: "Org A" },
      { id: "org-b", name: "Org B" },
    ],
  },
};

describe("Customers route", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    auth.state = { user: { username: "me" }, isLoading: false };
    for (const mock of Object.values(api)) mock.mockReset();
    api.fetchAllCustomers.mockResolvedValue([
      customer("c1", "Acme", "Org A"),
      customer("c2", "Beta", "Org B"),
    ]);
    api.customersFiscalYearSummaryList.mockResolvedValue({ status: 200, data: [] });
    api.organizationsList.mockResolvedValue(TWO_ORGANIZATIONS);
    vi.spyOn(console, "error").mockImplementation(() => {});
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    vi.restoreAllMocks();
  });

  test("renders through loading → authenticated and lists customers with the organization filter", async () => {
    auth.state = { user: null, isLoading: true };
    root.render(<Customers />);
    await waitFor(() => hasText(container, "読み込み中"));
    expect(container.textContent).toContain("読み込み中");
    expect(api.fetchAllCustomers).not.toHaveBeenCalled();
    expect(api.organizationsList).not.toHaveBeenCalled();

    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<Customers />);
    await waitFor(() => hasText(container, "Beta"));
    expect(container.textContent).toContain("Acme");
    expect(container.textContent).toContain("Beta");

    const filter = await waitFor(() => organizationFilter(container));
    expect(filter).not.toBeNull();
    const options = Array.from(filter?.querySelectorAll("option") ?? []).map((o) => o.textContent);
    expect(options).toEqual(["すべての組織", "Org A", "Org B"]);
    expect(api.organizationsList).toHaveBeenCalledTimes(1);
  });

  test("choosing an organization refetches the customers for it", async () => {
    root.render(<Customers />);
    const filter = await waitFor(() => organizationFilter(container));
    await waitFor(() => hasText(container, "Beta"));
    if (!filter) throw new Error("organization filter not rendered");

    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setter?.call(filter, "org-b");
    filter.dispatchEvent(new Event("change", { bubbles: true }));

    await waitFor(() =>
      api.fetchAllCustomers.mock.calls.some((c) => c[0]?.organization === "org-b") ? true : null,
    );
    expect(api.fetchAllCustomers).toHaveBeenLastCalledWith({
      organization: "org-b",
      recent_ending: undefined,
    });
    // The organization list itself is loaded once, not per filter change.
    expect(api.organizationsList).toHaveBeenCalledTimes(1);
  });

  test("a single organization offers no filter", async () => {
    api.organizationsList.mockResolvedValue({
      status: 200,
      data: { organizations: [{ id: "org-a", name: "Org A" }] },
    });
    root.render(<Customers />);
    await waitFor(() => hasText(container, "Beta"));
    await waitFor(() => (api.organizationsList.mock.calls.length > 0 ? true : null));
    await new Promise((r) => setTimeout(r, 50));
    expect(organizationFilter(container)).toBeNull();
  });

  test("a failed organization fetch leaves the list usable, with no filter and no error", async () => {
    api.organizationsList.mockRejectedValue(new Error("boom"));
    root.render(<Customers />);
    await waitFor(() => hasText(container, "Beta"));
    await new Promise((r) => setTimeout(r, 50));
    expect(container.textContent).toContain("Acme");
    expect(organizationFilter(container)).toBeNull();
    expect(container.textContent).not.toContain("失敗しました");
  });

  test("a failed customer fetch shows the load error", async () => {
    api.fetchAllCustomers.mockRejectedValue(new Error("boom"));
    root.render(<Customers />);
    await waitFor(() => hasText(container, "顧客の読み込みに失敗しました"));
    expect(container.textContent).toContain("顧客の読み込みに失敗しました");
    expect(container.textContent).not.toContain("Acme");
  });
});
