import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

// In-SPA KippoProject record edit (kippo#42): loads the project, edits its fields, PATCHes.

const navigateSpy = vi.hoisted(() => vi.fn());
const projectsRetrieve = vi.hoisted(() => vi.fn());
const projectsPartialUpdate = vi.hoisted(() => vi.fn());
const projectsForecastRetrieve = vi.hoisted(() => vi.fn());
const projectsList = vi.hoisted(() => vi.fn());
const organizationsMembersRetrieve = vi.hoisted(() => vi.fn());
const projectCategoriesList = vi.hoisted(() => vi.fn());

vi.mock("react-router", () => ({
  useNavigate: () => navigateSpy,
  useParams: () => ({ id: "proj-1" }),
  useLocation: () => ({ pathname: "/projects/proj-1/edit" }),
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("~/lib/auth-context", () => ({
  useAuth: () => ({ user: { username: "u" }, isLoading: false }),
}));
vi.mock("~/lib/api/generated/projects/projects", () => ({
  projectsRetrieve: (...a: unknown[]) => projectsRetrieve(...a),
  projectsPartialUpdate: (...a: unknown[]) => projectsPartialUpdate(...a),
  projectsForecastRetrieve: (...a: unknown[]) => projectsForecastRetrieve(...a),
  projectsList: (...a: unknown[]) => projectsList(...a),
}));
vi.mock("~/lib/api/generated/organizations/organizations", () => ({
  organizationsMembersRetrieve: (...a: unknown[]) => organizationsMembersRetrieve(...a),
}));
vi.mock("~/lib/api/generated/project-categories/project-categories", () => ({
  projectCategoriesList: (...a: unknown[]) => projectCategoriesList(...a),
}));

import ProjectEdit from "../app/routes/projects.$id.edit";

// Default 8s (not 2s): all 24 browser test files share one chromium pool, so under full parallel
// load a React re-render / async resolve can take several seconds. A tight timeout makes the
// load-gated waits return null early and the test proceed on stale state (flaky).
async function waitFor<T>(probe: () => T | null | undefined, timeout = 8000): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = probe();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
      (b.textContent ?? "").includes(text),
    ) ?? null
  );
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

const defaultProject = {
  organization: "org-1",
  organization_name: "Acme",
  customer_name: "Beta Co",
  name: "Old Name",
  phase: "proposing-low",
  category: "ai-development",
  project_manager: "user-1",
  problem_definition: "old problem",
  start_date: "2026-02-01",
  target_date: "2026-08-31",
  allocated_staff_days: 5,
  document_folder_url: "",
  docbase_tag: "",
  slack_channel_name: "",
  slack_notification_channel_name: "",
  github_project_html_url: "",
  display_as_active: true,
  display_in_project_report: true,
  is_closed: false,
};

describe("ProjectEdit route", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    navigateSpy.mockReset();
    projectsRetrieve.mockReset();
    projectsPartialUpdate.mockReset();
    projectsForecastRetrieve.mockReset();
    projectsList.mockReset();
    organizationsMembersRetrieve.mockReset();
    projectCategoriesList.mockReset();
    projectsRetrieve.mockResolvedValue({ status: 200, data: { ...defaultProject } });
    organizationsMembersRetrieve.mockResolvedValue({
      status: 200,
      data: { members: [{ user_id: "user-1", username: "pm", display_name: "PM" }] },
    });
    projectCategoriesList.mockResolvedValue({
      status: 200,
      data: {
        results: [
          {
            key: "ai-development",
            label: "AI開発",
            organization: null,
            sort_order: 0,
            is_active: true,
          },
        ],
      },
    });
    projectsPartialUpdate.mockResolvedValue({ status: 200, data: {} });
    projectsForecastRetrieve.mockResolvedValue({
      status: 200,
      data: {
        estimated_completion_date: "2026-09-15",
        delta_from_target_date_days: 15,
        target_date: "2026-08-31",
      },
    });
    projectsList.mockResolvedValue({ status: 200, data: { results: [] } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("loads the project, edits a field, and PATCHes", async () => {
    root.render(<ProjectEdit />);

    await waitFor(() =>
      container.querySelector<HTMLInputElement>("#p-name")?.value === "Old Name" ? true : null,
    );
    expect(projectsRetrieve).toHaveBeenCalledWith("proj-1");
    expect(container.textContent).toContain("Acme"); // org read-only
    expect(container.querySelector<HTMLInputElement>("#p-allocated")?.value).toBe("5");
    // 完了予測日 (read-only forecast) is fetched and rendered; アクティブ表示 was removed.
    await waitFor(() => (container.textContent?.includes("完了予測日") ? true : null));
    expect(projectsForecastRetrieve).toHaveBeenCalledWith("proj-1");
    expect(container.textContent).toContain("2026/9/15");
    expect(container.textContent).not.toContain("アクティブ表示");

    // wait for categories to load so the writable-category guard includes the selected key
    await waitFor(() => {
      const s = container.querySelector<HTMLSelectElement>("#p-category");
      return s && s.querySelectorAll("option").length > 1 ? true : null;
    });

    // `setInputValue` sets the DOM value directly, so React's onChange may not have committed the
    // new name to state before handleSave reads it — under CI load a single onChange can be lost
    // entirely, so re-dispatch the input event AND re-click each poll until a PATCH carries the new
    // name (React will have flushed by then).
    await waitFor(() => {
      setInputValue(container.querySelector("#p-name") as HTMLInputElement, "New Name");
      findButton(container, "保存")?.click();
      return projectsPartialUpdate.mock.calls.some((c) => c[1]?.name === "New Name") ? true : null;
    });
    // Exact payload: is_closed / display_in_project_report / display_as_active are NOT sent
    // (admin-managed / removed from this form per #41).
    expect(projectsPartialUpdate).toHaveBeenCalledWith("proj-1", {
      name: "New Name",
      phase: "proposing-low",
      category: "ai-development",
      project_manager: "user-1",
      problem_definition: "old problem",
      start_date: "2026-02-01",
      target_date: "2026-08-31",
      allocated_staff_days: 5,
      document_folder_url: "",
      docbase_tag: "",
      slack_channel_name: "",
      slack_notification_channel_name: "",
      github_project_html_url: "",
      enable_cost_report: false,
      parent_project: null,
    });
    await waitFor(() => (navigateSpy.mock.calls.length > 0 ? true : null));
    expect(navigateSpy).toHaveBeenCalledWith(-1);
  });

  test("contract-managed dates: inputs disabled and omitted from the PATCH", async () => {
    // billing_types is contract-derived (non-empty ⇒ the project has a contract). The contract
    // period is then the single source of the project dates (synced server-side); the backend
    // rejects a changed start_date/target_date, so the form disables and omits them.
    projectsRetrieve.mockResolvedValue({
      status: 200,
      data: { ...defaultProject, billing_types: ["monthly"] },
    });

    root.render(<ProjectEdit />);

    await waitFor(() =>
      container.querySelector<HTMLInputElement>("#p-name")?.value === "Old Name" ? true : null,
    );
    const startInput = container.querySelector<HTMLInputElement>("#p-start");
    const targetInput = container.querySelector<HTMLInputElement>("#p-target");
    expect(startInput?.disabled).toBe(true);
    expect(targetInput?.disabled).toBe(true);
    // values still displayed (read-only), plus the explanatory note
    expect(startInput?.value).toBe("2026-02-01");
    expect(container.textContent).toContain("契約期間から自動設定");

    // wait for categories so the writable-category guard includes the selected key
    await waitFor(() => {
      const s = container.querySelector<HTMLSelectElement>("#p-category");
      return s && s.querySelectorAll("option").length > 1 ? true : null;
    });

    setInputValue(container.querySelector("#p-name") as HTMLInputElement, "Renamed");
    await waitFor(() => {
      findButton(container, "保存")?.click();
      return projectsPartialUpdate.mock.calls.some((c) => c[1]?.name === "Renamed") ? true : null;
    });
    const payload = projectsPartialUpdate.mock.calls.find((c) => c[1]?.name === "Renamed")?.[1];
    expect(payload).not.toHaveProperty("start_date");
    expect(payload).not.toHaveProperty("target_date");
  });

  test("a 400 surfaces the field error and does not navigate away", async () => {
    // custom-fetch resolves (not throws) on 4xx; the route must surface the DRF field error and stay
    // on the page instead of navigating away as if the save succeeded.
    projectsPartialUpdate.mockResolvedValue({
      status: 400,
      data: {
        phase: [
          "A contract (契約) with start/end dates must be saved before setting the phase to 契約(稼働中).",
        ],
      },
    });
    root.render(<ProjectEdit />);

    await waitFor(() =>
      container.querySelector<HTMLInputElement>("#p-name")?.value === "Old Name" ? true : null,
    );
    await waitFor(() => {
      const s = container.querySelector<HTMLSelectElement>("#p-category");
      return s && s.querySelectorAll("option").length > 1 ? true : null;
    });

    setInputValue(container.querySelector("#p-name") as HTMLInputElement, "New Name");
    await waitFor(() => {
      findButton(container, "保存")?.click();
      return projectsPartialUpdate.mock.calls.some((c) => c[1]?.name === "New Name") ? true : null;
    });

    await waitFor(() => (container.textContent?.includes("phase:") ? true : null));
    expect(container.textContent).toContain("A contract"); // field error surfaced, not a generic banner
    expect(navigateSpy).not.toHaveBeenCalled(); // stayed on the page
  });

  test("shows the customer's contract-folder URL read-only when present", async () => {
    // customer_document_url is the linked customer's contract-folder link (kippo#51 / T04) —
    // display-only, since the customer itself is immutable after creation.
    projectsRetrieve.mockResolvedValue({
      status: 200,
      data: { ...defaultProject, customer_document_url: "https://drive.example/contract" },
    });
    root.render(<ProjectEdit />);

    const link = await waitFor(() =>
      Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).find(
        (a) => a.href === "https://drive.example/contract",
      ),
    );
    expect(link).not.toBeNull();
    expect(container.textContent).toContain("契約書フォルダ");
  });

  test("omits the contract-folder link when the customer has no document URL", async () => {
    // default mock has no customer_document_url — the read-only link must not render.
    root.render(<ProjectEdit />);
    await waitFor(() =>
      container.querySelector<HTMLInputElement>("#p-name")?.value === "Old Name" ? true : null,
    );
    expect(container.textContent).not.toContain("契約書フォルダ");
  });

  test("without a contract the dates stay editable and are sent", async () => {
    // default mock has no billing_types (older payload shape) — dates remain directly editable
    root.render(<ProjectEdit />);

    await waitFor(() =>
      container.querySelector<HTMLInputElement>("#p-name")?.value === "Old Name" ? true : null,
    );
    const startInput = container.querySelector<HTMLInputElement>("#p-start");
    expect(startInput?.disabled).toBe(false);
    expect(container.textContent).not.toContain("契約期間から自動設定");
  });
});
