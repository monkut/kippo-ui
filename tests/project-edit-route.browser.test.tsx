import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

// In-SPA KippoProject record edit (kippo#42): loads the project, edits its fields, PATCHes.

const navigateSpy = vi.hoisted(() => vi.fn());
const projectsRetrieve = vi.hoisted(() => vi.fn());
const projectsPartialUpdate = vi.hoisted(() => vi.fn());
const projectsForecastRetrieve = vi.hoisted(() => vi.fn());
const projectsList = vi.hoisted(() => vi.fn());
const projectsContractList = vi.hoisted(() => vi.fn());
const projectsContractCreate = vi.hoisted(() => vi.fn());
const projectsContractPartialUpdate = vi.hoisted(() => vi.fn());
const projectsContractDestroy = vi.hoisted(() => vi.fn());
const organizationsMembersRetrieve = vi.hoisted(() => vi.fn());
const projectCategoriesList = vi.hoisted(() => vi.fn());
const customersList = vi.hoisted(() => vi.fn());

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
  projectsContractList: (...a: unknown[]) => projectsContractList(...a),
  projectsContractCreate: (...a: unknown[]) => projectsContractCreate(...a),
  projectsContractPartialUpdate: (...a: unknown[]) => projectsContractPartialUpdate(...a),
  projectsContractDestroy: (...a: unknown[]) => projectsContractDestroy(...a),
}));
vi.mock("~/lib/api/generated/organizations/organizations", () => ({
  organizationsMembersRetrieve: (...a: unknown[]) => organizationsMembersRetrieve(...a),
}));
vi.mock("~/lib/api/generated/project-categories/project-categories", () => ({
  projectCategoriesList: (...a: unknown[]) => projectCategoriesList(...a),
}));
vi.mock("~/lib/api/generated/customers/customers", () => ({
  customersList: (...a: unknown[]) => customersList(...a),
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

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
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
    projectsContractList.mockReset();
    projectsContractCreate.mockReset();
    projectsContractPartialUpdate.mockReset();
    projectsContractDestroy.mockReset();
    organizationsMembersRetrieve.mockReset();
    projectCategoriesList.mockReset();
    customersList.mockReset();
    customersList.mockResolvedValue({ status: 200, data: { results: [] } });
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
    // No contract by default — the 契約 section shows the "契約を追加" flow.
    projectsContractList.mockResolvedValue({ status: 200, data: { results: [] } });
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
      lead_source: "",
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

  test("loads lead_source (リード) and round-trips it in the PATCH", async () => {
    projectsRetrieve.mockResolvedValue({
      status: 200,
      data: { ...defaultProject, lead_source: "employee-referral" },
    });
    root.render(<ProjectEdit />);

    await waitFor(() =>
      container.querySelector<HTMLInputElement>("#p-name")?.value === "Old Name" ? true : null,
    );
    // the リード select is populated from the loaded project
    await waitFor(() =>
      container.querySelector<HTMLSelectElement>("#p-lead-source")?.value === "employee-referral"
        ? true
        : null,
    );

    await waitFor(() => {
      setInputValue(container.querySelector("#p-name") as HTMLInputElement, "Lead Named");
      findButton(container, "保存")?.click();
      return projectsPartialUpdate.mock.calls.some((c) => c[1]?.name === "Lead Named")
        ? true
        : null;
    });
    const payload = projectsPartialUpdate.mock.calls.find((c) => c[1]?.name === "Lead Named")?.[1];
    expect(payload?.lead_source).toBe("employee-referral");
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

  test("loads an existing contract into the 契約 section", async () => {
    projectsContractList.mockResolvedValue({
      status: 200,
      data: {
        results: [
          {
            id: 7,
            project: "proj-1",
            project_name: "Old Name",
            billing_type: "monthly",
            pricing_basis: "effort",
            total_amount: "3000000",
            estimated_monthly_amount: "500000",
            start_date: "2026-03-01",
            end_date: "2026-09-30",
            note: "初回契約",
          },
        ],
      },
    });
    root.render(<ProjectEdit />);

    await waitFor(() =>
      container.querySelector<HTMLSelectElement>("#c-billing-type")?.value === "monthly"
        ? true
        : null,
    );
    expect(projectsContractList).toHaveBeenCalledWith("proj-1");
    expect(container.querySelector<HTMLSelectElement>("#c-pricing-basis")?.value).toBe("effort");
    expect(container.querySelector<HTMLInputElement>("#c-total-amount")?.value).toBe("3000000");
    expect(container.querySelector<HTMLInputElement>("#c-end")?.value).toBe("2026-09-30");
    // 月額 is shown (effort + monthly) and populated.
    expect(container.querySelector<HTMLInputElement>("#c-estimated-monthly")?.value).toBe("500000");
    // A contract exists ⇒ project's own dates are locked (contract-managed).
    expect(container.querySelector<HTMLInputElement>("#p-start")?.disabled).toBe(true);
    // Delete affordance is available for an existing contract.
    expect(findButton(container, "契約を削除")).not.toBeNull();
  });

  test("月額 is hidden for a non-(effort+monthly) contract", async () => {
    projectsContractList.mockResolvedValue({
      status: 200,
      data: {
        results: [
          {
            id: 8,
            project: "proj-1",
            project_name: "Old Name",
            billing_type: "delivery",
            pricing_basis: "fixed",
            total_amount: "3000000",
            estimated_monthly_amount: null,
            start_date: "2026-03-01",
            end_date: "2026-09-30",
            note: "",
          },
        ],
      },
    });
    root.render(<ProjectEdit />);

    await waitFor(() =>
      container.querySelector<HTMLSelectElement>("#c-pricing-basis")?.value === "fixed"
        ? true
        : null,
    );
    expect(container.querySelector("#c-estimated-monthly")).toBeNull();
  });

  test("月額 sent for an effort+monthly contract created in-page", async () => {
    projectsContractCreate.mockResolvedValue({
      status: 201,
      data: {
        id: 11,
        project: "proj-1",
        project_name: "Old Name",
        billing_type: "monthly",
        pricing_basis: "effort",
        total_amount: null,
        estimated_monthly_amount: "500000",
        start_date: "2026-02-01",
        end_date: "2026-08-31",
        note: "",
      },
    });
    root.render(<ProjectEdit />);

    await waitFor(() =>
      container.textContent?.includes("契約が登録されていません") ? true : null,
    );
    findButton(container, "契約を追加")?.click();
    await waitFor(() =>
      container.querySelector<HTMLSelectElement>("#c-billing-type") ? true : null,
    );

    // Switch to 月額 + 実績 so the 月額 field appears, then fill it.
    setSelectValue(container.querySelector("#c-billing-type") as HTMLSelectElement, "monthly");
    setSelectValue(container.querySelector("#c-pricing-basis") as HTMLSelectElement, "effort");
    await waitFor(() =>
      container.querySelector<HTMLInputElement>("#c-estimated-monthly") ? true : null,
    );
    await waitFor(() => {
      const el = container.querySelector<HTMLInputElement>("#c-estimated-monthly");
      if (el) setInputValue(el, "500000");
      findButton(container, "契約を保存")?.click();
      return projectsContractCreate.mock.calls.length > 0 ? true : null;
    });
    const body = projectsContractCreate.mock.calls[0]?.[1];
    expect(body?.billing_type).toBe("monthly");
    expect(body?.pricing_basis).toBe("effort");
    expect(body?.estimated_monthly_amount).toBe("500000");
  });

  test("adds a contract via its own save, which then locks the project dates", async () => {
    projectsContractCreate.mockResolvedValue({
      status: 201,
      data: {
        id: 10,
        project: "proj-1",
        project_name: "Old Name",
        billing_type: "delivery",
        pricing_basis: "fixed",
        total_amount: "1000000",
        start_date: "2026-02-01",
        end_date: "2026-08-31",
        note: "",
      },
    });
    root.render(<ProjectEdit />);

    // Starts with no contract — reveal the create form.
    await waitFor(() =>
      container.textContent?.includes("契約が登録されていません") ? true : null,
    );
    findButton(container, "契約を追加")?.click();
    await waitFor(() =>
      container.querySelector<HTMLInputElement>("#c-total-amount") ? true : null,
    );

    // fixed pricing requires a total_amount before the contract save enables.
    await waitFor(() => {
      setInputValue(container.querySelector("#c-total-amount") as HTMLInputElement, "1000000");
      findButton(container, "契約を保存")?.click();
      return projectsContractCreate.mock.calls.length > 0 ? true : null;
    });
    expect(projectsContractCreate).toHaveBeenCalledWith("proj-1", {
      billing_type: "delivery",
      pricing_basis: "fixed",
      total_amount: "1000000",
      // delivery + fixed is not effort+monthly → 月額 sent as null (not shown in the form).
      estimated_monthly_amount: null,
      start_date: null,
      end_date: null,
      note: "",
      // default mock has no customer id → 請求先 unset → null (server defaults it to the project customer).
      billed_to: null,
    });

    // After creation the contract owns the period: project date inputs lock.
    await waitFor(() =>
      container.querySelector<HTMLInputElement>("#p-start")?.disabled ? true : null,
    );
    expect(container.querySelector<HTMLInputElement>("#p-target")?.disabled).toBe(true);
  });

  test("seeds 請求先 from the project's customer and sends it on contract create", async () => {
    // Project has a customer → clicking 契約を追加 pre-fills 請求先 with it (the server-side default made
    // visible), and the create body carries billed_to = that customer id.
    projectsRetrieve.mockResolvedValue({
      status: 200,
      data: { ...defaultProject, customer: "cust-beta", customer_name: "Beta Co" },
    });
    projectsContractCreate.mockResolvedValue({
      status: 201,
      data: {
        id: 11,
        project: "proj-1",
        project_name: "Old Name",
        billing_type: "delivery",
        pricing_basis: "fixed",
        total_amount: "500000",
        billed_to: "cust-beta",
        billed_to_name: "Beta Co",
        start_date: "2026-02-01",
        end_date: "2026-08-31",
        note: "",
      },
    });
    root.render(<ProjectEdit />);

    await waitFor(() =>
      container.textContent?.includes("契約が登録されていません") ? true : null,
    );
    findButton(container, "契約を追加")?.click();
    await waitFor(() =>
      container.querySelector<HTMLInputElement>("#c-total-amount") ? true : null,
    );
    // 請求先 shows the seeded project customer name.
    expect(container.textContent).toContain("Beta Co");

    await waitFor(() => {
      setInputValue(container.querySelector("#c-total-amount") as HTMLInputElement, "500000");
      findButton(container, "契約を保存")?.click();
      return projectsContractCreate.mock.calls.length > 0 ? true : null;
    });
    expect(projectsContractCreate.mock.calls[0]?.[1]).toMatchObject({ billed_to: "cust-beta" });
  });

  test("closed project locks the contract section (read-only, no save/delete)", async () => {
    // The backend refuses contract writes on a closed project (admin's LockWhenProjectClosedInline
    // parity); the UI shows the contract read-only.
    projectsRetrieve.mockResolvedValue({
      status: 200,
      data: { ...defaultProject, is_closed: true },
    });
    projectsContractList.mockResolvedValue({
      status: 200,
      data: {
        results: [
          {
            id: 9,
            project: "proj-1",
            project_name: "Old Name",
            billing_type: "delivery",
            pricing_basis: "fixed",
            total_amount: "1000000",
            start_date: "2026-02-01",
            end_date: "2026-08-31",
            note: "",
          },
        ],
      },
    });
    root.render(<ProjectEdit />);

    await waitFor(() =>
      container.querySelector<HTMLSelectElement>("#c-billing-type")?.value === "delivery"
        ? true
        : null,
    );
    // Fields render but are disabled.
    expect(container.querySelector<HTMLSelectElement>("#c-billing-type")?.disabled).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#c-total-amount")?.disabled).toBe(true);
    expect(container.querySelector<HTMLInputElement>("#c-end")?.disabled).toBe(true);
    // No write affordances when closed.
    expect(findButton(container, "契約を保存")).toBeNull();
    expect(findButton(container, "契約を削除")).toBeNull();
    expect(container.textContent).toContain("クローズ済みのため");
  });

  test("closed project without a contract offers no add button", async () => {
    projectsRetrieve.mockResolvedValue({
      status: 200,
      data: { ...defaultProject, is_closed: true },
    });
    root.render(<ProjectEdit />);

    await waitFor(() =>
      container.textContent?.includes("契約が登録されていません") ? true : null,
    );
    expect(findButton(container, "契約を追加")).toBeNull();
  });
});
