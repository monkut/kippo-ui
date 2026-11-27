import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

// Business requirement detail route (/projects/:id/requirements/:reqId). Drives
// authLoading → authenticated so a hook placed after an early return (React #310) fails here.

const auth = vi.hoisted(() => ({
  state: { user: null as { username: string } | null, isLoading: true },
}));
const api = vi.hoisted(() => ({
  projectsRetrieve: vi.fn(),
  requirementsBusinessRequirementsRetrieve: vi.fn(),
  requirementsTechnicalRequirementCategoriesList: vi.fn(),
}));

vi.mock("react-router", () => ({
  useNavigate: () => () => {},
  useParams: () => ({ id: "p1", reqId: "10" }),
  useLocation: () => ({ pathname: "/projects/p1/requirements/10" }),
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/lib/auth-context", () => ({ useAuth: () => auth.state }));
vi.mock("~/components/layout", () => ({
  Layout: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/lib/api/generated/projects/projects", () => ({
  projectsRetrieve: (...a: unknown[]) => api.projectsRetrieve(...a),
}));
// The inline forms import create functions from the same module: keep those, replace the reads.
vi.mock("~/lib/api/generated/requirements/requirements", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requirementsBusinessRequirementsRetrieve: (...a: unknown[]) =>
    api.requirementsBusinessRequirementsRetrieve(...a),
  requirementsTechnicalRequirementCategoriesList: (...a: unknown[]) =>
    api.requirementsTechnicalRequirementCategoriesList(...a),
}));

import BusinessRequirementDetails from "../app/routes/projects.$id.requirements.$reqId";

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

const REQUIREMENT = {
  id: 10,
  display_id: "B-1",
  title: "Business One",
  details: "Requirement details",
  category_name: "Sales",
  problems_data: [{ id: 5, display_id: "P-1", title: "Problem One" }],
  total_estimate: { total_days: 3, weighted_days: 3.5 },
  technical_requirements: [
    {
      id: 20,
      display_id: "T-1",
      title: "Technical One",
      category_name: "Backend",
      estimate: { days: 3, confidence: 80 },
    },
  ],
  comments: [
    {
      id: 1,
      comment: "First comment",
      created_by_name: "me",
      created_datetime: "2026-01-05T00:00:00Z",
      replies: [],
    },
  ],
};

describe("BusinessRequirementDetails route", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    auth.state = { user: { username: "me" }, isLoading: false };
    for (const mock of Object.values(api)) mock.mockReset();
    api.projectsRetrieve.mockResolvedValue({
      status: 200,
      data: { id: "p1", name: "Project One", customer_name: "Acme" },
    });
    api.requirementsBusinessRequirementsRetrieve.mockResolvedValue({
      status: 200,
      data: REQUIREMENT,
    });
    api.requirementsTechnicalRequirementCategoriesList.mockResolvedValue({
      status: 200,
      data: { results: [{ id: 4, name: "Backend" }] },
    });
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

  test("renders through loading → authenticated and shows the requirement", async () => {
    auth.state = { user: null, isLoading: true };
    root.render(<BusinessRequirementDetails />);
    await waitFor(() => hasText(container, "読み込み中"));
    expect(container.textContent).toContain("読み込み中");
    expect(api.requirementsBusinessRequirementsRetrieve).not.toHaveBeenCalled();

    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<BusinessRequirementDetails />);
    await waitFor(() => hasText(container, "Technical One"));

    const text = container.textContent ?? "";
    for (const expected of [
      "B-1",
      "Business One",
      "課題: Problem One",
      "カテゴリ: Sales",
      "Requirement details",
      "First comment",
      "T-1",
      "Technical One",
      "Backend",
    ]) {
      expect(text).toContain(expected);
    }
    expect(api.requirementsBusinessRequirementsRetrieve).toHaveBeenCalledWith(10);
    expect(api.projectsRetrieve).toHaveBeenCalledWith("p1");
    expect(api.requirementsTechnicalRequirementCategoriesList).toHaveBeenCalledWith({
      project: "p1",
    });
  });

  test("stays on the loading placeholder until the requirement arrives", async () => {
    let resolve: (value: unknown) => void = () => {};
    api.requirementsBusinessRequirementsRetrieve.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    root.render(<BusinessRequirementDetails />);
    await waitFor(() =>
      api.requirementsBusinessRequirementsRetrieve.mock.calls.length > 0 ? true : null,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(container.textContent).toContain("読み込み中");
    expect(container.textContent).not.toContain("Business One");

    resolve({ status: 200, data: REQUIREMENT });
    await waitFor(() => hasText(container, "Business One"));
    expect(container.textContent).not.toContain("読み込み中");
  });

  test("a failed requirement fetch shows the load error", async () => {
    api.requirementsBusinessRequirementsRetrieve.mockRejectedValue(new Error("boom"));
    root.render(<BusinessRequirementDetails />);
    await waitFor(() => hasText(container, "ビジネス要件の読み込みに失敗しました"));
    expect(container.textContent).toContain("ビジネス要件の読み込みに失敗しました");
    expect(container.textContent).not.toContain("Business One");
  });

  // customFetch resolves on 4xx / 5xx: an error body must not be rendered as the requirement.
  test("a 404 requirement renders the not-found state", async () => {
    api.requirementsBusinessRequirementsRetrieve.mockResolvedValue({
      status: 404,
      data: { detail: "見つかりませんでした。" },
    });
    root.render(<BusinessRequirementDetails />);
    await waitFor(() => hasText(container, "ビジネス要件が見つかりません"), 3000);
    expect(container.textContent).toContain("ビジネス要件が見つかりません");
    expect(container.textContent).not.toContain("技術要件");
  });

  test("a 5xx requirement response is a load error", async () => {
    api.requirementsBusinessRequirementsRetrieve.mockResolvedValue({
      status: 500,
      data: "Server Error",
    });
    root.render(<BusinessRequirementDetails />);
    await waitFor(() => hasText(container, "ビジネス要件の読み込みに失敗しました"), 3000);
    expect(container.textContent).toContain("ビジネス要件の読み込みに失敗しました");
  });

  test("the project and category fetches are decoration: their failure does not block the page", async () => {
    api.projectsRetrieve.mockRejectedValue(new Error("boom"));
    api.requirementsTechnicalRequirementCategoriesList.mockRejectedValue(new Error("boom"));
    root.render(<BusinessRequirementDetails />);
    await waitFor(() => hasText(container, "Technical One"));
    expect(container.textContent).toContain("Business One");
    expect(container.textContent).not.toContain("失敗しました");
  });
});
