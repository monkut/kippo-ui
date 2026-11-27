import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

// Project detail route (/projects/:id): the four requirement sections, the per-requirement
// comment panels and confirm-then-delete. Also drives authLoading → authenticated so a hook
// placed after an early return (React #310) fails here.

const auth = vi.hoisted(() => ({
  state: { user: null as { username: string } | null, isLoading: true },
}));
const api = vi.hoisted(() => ({
  projectsRetrieve: vi.fn(),
  requirementsAssumptionsDestroy: vi.fn(),
  requirementsAssumptionsCategoriesRetrieve: vi.fn(),
  requirementsAssumptionsList: vi.fn(),
  requirementsProblemDefinitionsDestroy: vi.fn(),
  requirementsProblemDefinitionsList: vi.fn(),
  requirementsBusinessRequirementsDestroy: vi.fn(),
  requirementsBusinessRequirementsRetrieve: vi.fn(),
  requirementsBusinessRequirementsList: vi.fn(),
  requirementsBusinessRequirementCategoriesList: vi.fn(),
  requirementsTechnicalRequirementsDestroy: vi.fn(),
  requirementsTechnicalRequirementsList: vi.fn(),
  requirementsTechnicalRequirementCategoriesList: vi.fn(),
  requirementsTechnicalRequirementsRetrieve: vi.fn(),
}));

vi.mock("react-router", async () => {
  const React = await import("react");
  return {
    useNavigate: () => () => {},
    useParams: () => ({ id: "p1" }),
    useLocation: () => ({ pathname: "/projects/p1" }),
    useSearchParams: () => {
      const [params, setParams] = React.useState(() => new URLSearchParams());
      const update = React.useCallback(
        (updater: (prev: URLSearchParams) => URLSearchParams) => setParams(updater),
        [],
      );
      return [params, update];
    },
    Link: ({ children }: { children: unknown }) => children,
  };
});
vi.mock("~/lib/auth-context", () => ({ useAuth: () => auth.state }));
vi.mock("~/components/layout", () => ({
  Layout: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/lib/api/generated/projects/projects", () => ({
  projectsRetrieve: (...a: unknown[]) => api.projectsRetrieve(...a),
}));
// The forms import create/update functions from the same module: keep those, replace the rest.
vi.mock("~/lib/api/generated/requirements/requirements", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...Object.fromEntries(
    Object.keys(api)
      .filter((name) => name !== "projectsRetrieve")
      .map((name) => [
        name,
        (...a: unknown[]) => (api as Record<string, (...x: unknown[]) => unknown>)[name](...a),
      ]),
  ),
}));

import ProjectDetails from "../app/routes/projects.$id";

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

/** The row (`li`) whose text contains `text`. */
function rowOf(container: HTMLElement, text: string): HTMLLIElement {
  const row = Array.from(container.querySelectorAll<HTMLLIElement>("li")).find((li) =>
    li.textContent?.includes(text),
  );
  if (!row) throw new Error(`row not found: ${text}`);
  return row;
}

function clickTitled(scope: HTMLElement, title: string) {
  const button = scope.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
  if (!button) throw new Error(`button not found: ${title}`);
  button.click();
}

describe("ProjectDetails route", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    auth.state = { user: { username: "me" }, isLoading: false };
    for (const mock of Object.values(api)) mock.mockReset();
    api.projectsRetrieve.mockResolvedValue({
      status: 200,
      data: { id: "p1", name: "Project One", customer_name: "Acme" },
    });
    api.requirementsAssumptionsList.mockResolvedValue({
      data: {
        results: [
          {
            id: 1,
            display_id: "A-1",
            title: "Assumption One",
            category: "assumption",
            category_display: "前提",
          },
        ],
      },
    });
    api.requirementsProblemDefinitionsList.mockResolvedValue({
      data: {
        results: [
          { id: 5, display_id: "P-1", title: "Problem One" },
          { id: 6, display_id: "P-2", title: "Problem Orphan" },
        ],
      },
    });
    api.requirementsBusinessRequirementsList.mockResolvedValue({
      data: {
        results: [
          { id: 10, display_id: "B-1", title: "Business One", category: 3, problems: [5] },
          { id: 11, display_id: "B-2", title: "Business Orphan", category: 3, problems: [] },
        ],
      },
    });
    api.requirementsTechnicalRequirementsList.mockResolvedValue({
      data: {
        results: [
          {
            id: 20,
            display_id: "T-1",
            title: "Technical One",
            category: 4,
            category_name: "Backend",
            business_requirements: [10],
            estimate: { days: 3, confidence: 0.8 },
          },
        ],
      },
    });
    api.requirementsAssumptionsCategoriesRetrieve.mockResolvedValue({
      data: [{ value: "assumption", label: "前提" }],
    });
    api.requirementsBusinessRequirementCategoriesList.mockResolvedValue({
      data: { results: [{ id: 3, name: "Sales" }] },
    });
    api.requirementsTechnicalRequirementCategoriesList.mockResolvedValue({
      data: { results: [{ id: 4, name: "Backend" }] },
    });
    api.requirementsBusinessRequirementsRetrieve.mockResolvedValue({
      data: {
        comments: [{ id: 1, comment: "Business comment", created_by_name: "me", replies: [] }],
      },
    });
    api.requirementsTechnicalRequirementsRetrieve.mockResolvedValue({
      data: {
        comments: [{ id: 2, comment: "Technical comment", created_by_name: "me", replies: [] }],
      },
    });
    api.requirementsAssumptionsDestroy.mockResolvedValue({ status: 204 });
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

  test("renders through loading → authenticated and shows the four sections", async () => {
    auth.state = { user: null, isLoading: true };
    root.render(<ProjectDetails />);
    await waitFor(() => hasText(container, "読み込み中"));
    expect(api.projectsRetrieve).not.toHaveBeenCalled();

    auth.state = { user: { username: "me" }, isLoading: false };
    root.render(<ProjectDetails />);
    await waitFor(() => hasText(container, "Technical One"));

    const text = container.textContent ?? "";
    for (const expected of [
      "前提条件と制約事項",
      "Assumption One",
      "課題定義",
      "Problem One",
      "ビジネス要件",
      "Business One",
      "Sales",
      "課題: P-1",
      "技術要件",
      "Technical One",
      "3日 (80%)",
      "ビジネス要件: B-1",
      // Problems / business requirements nothing refers to are flagged in the next section's header.
      "未対応: P-2",
      "未対応: B-2",
    ]) {
      expect(text).toContain(expected);
    }
    expect(api.projectsRetrieve).toHaveBeenCalledWith("p1");
  });

  test("the business comment panel loads on open and closes on the second click", async () => {
    root.render(<ProjectDetails />);
    await waitFor(() => hasText(container, "Business One"));

    clickTitled(rowOf(container, "Business One"), "コメント");
    await waitFor(() => hasText(container, "Business comment"));
    expect(api.requirementsBusinessRequirementsRetrieve).toHaveBeenCalledWith(10);
    expect(api.requirementsTechnicalRequirementsRetrieve).not.toHaveBeenCalled();

    clickTitled(rowOf(container, "Business One"), "コメント");
    await waitFor(() => (container.textContent?.includes("Business comment") ? null : true));
    expect(container.textContent).not.toContain("Business comment");
  });

  test("the technical comment panel is independent of the business one", async () => {
    root.render(<ProjectDetails />);
    await waitFor(() => hasText(container, "Technical One"));

    clickTitled(rowOf(container, "Business One"), "コメント");
    await waitFor(() => hasText(container, "Business comment"));
    clickTitled(rowOf(container, "Technical One"), "コメント");
    await waitFor(() => hasText(container, "Technical comment"));

    expect(api.requirementsTechnicalRequirementsRetrieve).toHaveBeenCalledWith(20);
    expect(container.textContent).toContain("Business comment");
  });

  test("delete asks for confirmation, deletes, and reloads the lists", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    root.render(<ProjectDetails />);
    await waitFor(() => hasText(container, "Assumption One"));

    clickTitled(rowOf(container, "Assumption One"), "削除");
    expect(confirmSpy).toHaveBeenCalledWith("前提条件「Assumption One」を削除しますか？");
    expect(api.requirementsAssumptionsDestroy).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    clickTitled(rowOf(container, "Assumption One"), "削除");
    await waitFor(() => (api.requirementsAssumptionsList.mock.calls.length >= 2 ? true : null));
    expect(api.requirementsAssumptionsDestroy).toHaveBeenCalledWith(1);
    expect(api.requirementsAssumptionsList).toHaveBeenCalledTimes(2);
    await waitFor(() => hasText(container, "Assumption One"));
  });

  test("a failed delete shows the error", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.requirementsAssumptionsDestroy.mockRejectedValue(new Error("nope"));
    root.render(<ProjectDetails />);
    await waitFor(() => hasText(container, "Assumption One"));

    clickTitled(rowOf(container, "Assumption One"), "削除");
    await waitFor(() => hasText(container, "前提条件の削除に失敗しました"));
    expect(container.textContent).toContain("前提条件の削除に失敗しました");
  });

  test("コンパクト switches a section to the compact grid and back", async () => {
    root.render(<ProjectDetails />);
    await waitFor(() => hasText(container, "Technical One"));
    expect(container.querySelectorAll("ul.divide-y").length).toBe(4);

    const compactButtons = Array.from(container.querySelectorAll("button")).filter(
      (b) => b.textContent === "コンパクト",
    );
    expect(compactButtons.length).toBe(4);
    compactButtons[3].click();
    await waitFor(() => (container.querySelectorAll("ul.divide-y").length === 3 ? true : null));
    expect(container.querySelectorAll("ul.divide-y").length).toBe(3);
    expect(container.textContent).toContain("3日");
    expect(container.textContent).not.toContain("3日 (80%)");
  });

  test("a failed project load shows the load error", async () => {
    api.projectsRetrieve.mockRejectedValue(new Error("boom"));
    root.render(<ProjectDetails />);
    await waitFor(() => hasText(container, "プロジェクトの読み込みに失敗しました"));
    expect(container.textContent).toContain("プロジェクトの読み込みに失敗しました");
  });
});
