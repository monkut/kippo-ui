import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { KippoProject } from "../app/lib/api/generated/models";

// Projects list route (kippo#39 / T15): free-text search, sort, and per-month
// billing rows for monthly-billing projects. Mocks auth/router/data so the route
// renders without a network or full app shell.

const projectsList = vi.fn();
vi.mock("~/lib/api/generated/projects/projects", () => ({
  projectsList: (...args: unknown[]) => projectsList(...args),
}));
vi.mock("~/lib/auth-context", () => ({
  useAuth: () => ({ user: { username: "me" }, isLoading: false }),
}));
vi.mock("react-router", () => ({
  useNavigate: () => () => {},
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/components/layout", () => ({
  Layout: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/hooks/useHiddenProjectCategories", () => ({
  useHiddenProjectCategories: () => [new Set<string>(), () => {}],
}));

import Projects from "../app/routes/projects";

function makeProject(overrides: Partial<KippoProject>): KippoProject {
  return {
    id: overrides.id ?? "p",
    name: "Project",
    has_requirements: false,
    category: "ai-development",
    category_label: "AI開発",
    customer_name: null,
    phase_display: "契約稼働中",
    problem_definition: "",
    billing_types: [],
    monthly_billing_schedule: [],
    total_revenue: "0",
    start_date: "2026-01-01",
    target_date: "2026-12-31",
    allocated_staff_days: null,
    ...overrides,
  } as unknown as KippoProject;
}

async function waitFor<T>(probe: () => T | null | undefined, timeout = 2000): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = probe();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

describe("Projects route — search / sort / per-month rows", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    projectsList.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("renders per-month rows for a monthly-billing project", async () => {
    projectsList.mockResolvedValue({
      data: {
        results: [
          makeProject({
            id: "m",
            name: "Monthly Project",
            billing_types: ["monthly"],
            monthly_billing_schedule: [
              { month: "2026-01-31", amount: "300000" },
              { month: "2026-02-28", amount: "300000" },
            ],
          }),
        ],
      },
    });

    root.render(<Projects />);
    await waitFor(() => (container.textContent?.includes("Monthly Project") ? true : null));

    // summary shows the count; expanding reveals the month rows
    expect(container.textContent).toContain("月額請求 2 ヶ月分を表示");
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(container.textContent).toContain("2026年1月");
    expect(container.textContent).toContain("2026年2月");
    expect(container.textContent).toContain("¥300,000");
  });

  test("no per-month section for a delivery project", async () => {
    projectsList.mockResolvedValue({
      data: {
        results: [makeProject({ id: "d", name: "Delivery Project", billing_types: ["delivery"] })],
      },
    });
    root.render(<Projects />);
    await waitFor(() => (container.textContent?.includes("Delivery Project") ? true : null));
    expect(container.textContent).not.toContain("月額請求");
  });

  test("search filters by customer name", async () => {
    projectsList.mockResolvedValue({
      data: {
        results: [
          makeProject({ id: "a", name: "Alpha", customer_name: "Acme Co" }),
          makeProject({ id: "b", name: "Beta", customer_name: "Globex" }),
        ],
      },
    });
    root.render(<Projects />);
    await waitFor(() => (container.textContent?.includes("Alpha") ? true : null));

    const search = container.querySelector<HTMLInputElement>('input[type="search"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(search, "globex");
    search?.dispatchEvent(new Event("input", { bubbles: true }));

    await waitFor(() => (!container.textContent?.includes("Alpha") ? true : null));
    expect(container.textContent).toContain("Beta");
    expect(container.textContent).not.toContain("Alpha");
  });
});
