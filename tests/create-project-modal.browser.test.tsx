import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { CreateProjectModal } from "../app/components/project-assignments/CreateProjectModal";

// CreateProjectModal registers a new KippoProject. Since kippo#40 (T19) registration requires
// customer / project_manager / start_date / target_date in addition to organization + name;
// the 企業 field is a search autocomplete (kippo#34 / T04) that also surfaces the customer's
// contract-folder URL. `columnset` is resolved from the org default on the backend.

const organizationsList = vi.fn();
const organizationsMembersRetrieve = vi.fn();
const customersList = vi.fn();

vi.mock("~/lib/api/generated/organizations/organizations", () => ({
  organizationsList: (...args: unknown[]) => organizationsList(...args),
  organizationsMembersRetrieve: (...args: unknown[]) => organizationsMembersRetrieve(...args),
}));
vi.mock("~/lib/api/generated/customers/customers", () => ({
  customersList: (...args: unknown[]) => customersList(...args),
}));

function makeOrg(id: string, name: string) {
  return { id, name, github_organization_name: name };
}

function orgResponse(orgs: ReturnType<typeof makeOrg>[]) {
  return { status: 200 as const, data: { organizations: orgs } };
}

function membersResponse(members: { user_id: string; username: string; display_name: string }[]) {
  return { status: 200 as const, data: { members } };
}

function customersResponse(customers: { id: string; name: string; document_url?: string }[]) {
  return { status: 200 as const, data: { results: customers } };
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

/** Fill every required registration field except organization (single-org auto-selected). */
async function fillRequiredFields(container: HTMLElement) {
  setInputValue(
    container.querySelector<HTMLInputElement>("#create-project-name") as HTMLInputElement,
    "Apollo",
  );

  // 企業: type to search, pick the first result
  const customerInput = container.querySelector<HTMLInputElement>("#create-project-customer");
  setInputValue(customerInput as HTMLInputElement, "Beta");
  const customerOption = await waitFor(() => findButton(container, "Beta Co"));
  customerOption?.click();

  // 担当PM: select the loaded member
  const pmSelect = await waitFor(() => {
    const select = container.querySelector<HTMLSelectElement>("#create-project-pm");
    return select && select.querySelectorAll("option").length > 1 ? select : null;
  });
  setSelectValue(pmSelect as HTMLSelectElement, "user-1");

  setInputValue(
    container.querySelector<HTMLInputElement>("#create-project-start") as HTMLInputElement,
    "2026-02-01",
  );
  setInputValue(
    container.querySelector<HTMLInputElement>("#create-project-target") as HTMLInputElement,
    "2026-08-31",
  );
}

describe("CreateProjectModal — registration with required fields", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    organizationsList.mockReset();
    organizationsMembersRetrieve.mockReset();
    customersList.mockReset();
    organizationsList.mockResolvedValue(orgResponse([makeOrg("org-1", "Acme")]));
    organizationsMembersRetrieve.mockResolvedValue(
      membersResponse([{ user_id: "user-1", username: "pm", display_name: "PM User" }]),
    );
    customersList.mockResolvedValue(
      customersResponse([
        { id: "cust-1", name: "Beta Co", document_url: "https://drive.example.com/beta" },
      ]),
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("single org: submits the full registration payload", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    root.render(
      <CreateProjectModal open={true} isSaving={false} onClose={onClose} onSubmit={onSubmit} />,
    );

    await waitFor(() => (container.textContent?.includes("Acme") ? true : null));
    expect(container.querySelector("#create-project-org")).toBeNull(); // single org → label

    await fillRequiredFields(container);

    const submitBtn = await waitFor(() =>
      findButton(container, "作成")?.disabled === false ? findButton(container, "作成") : null,
    );
    submitBtn?.click();

    await waitFor(() => (onSubmit.mock.calls.length > 0 ? true : null));
    expect(onSubmit).toHaveBeenCalledWith({
      organization: "org-1",
      name: "Apollo",
      customer: "cust-1",
      project_manager: "user-1",
      start_date: "2026-02-01",
      target_date: "2026-08-31",
    });
    await waitFor(() => (onClose.mock.calls.length > 0 ? true : null));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("selecting a customer shows its contract-folder URL", async () => {
    root.render(
      <CreateProjectModal open={true} isSaving={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    await waitFor(() => (container.textContent?.includes("Acme") ? true : null));

    const customerInput = container.querySelector<HTMLInputElement>("#create-project-customer");
    setInputValue(customerInput as HTMLInputElement, "Beta");
    const option = await waitFor(() => findButton(container, "Beta Co"));
    option?.click();

    await waitFor(() => (container.textContent?.includes("契約書フォルダ") ? true : null));
    const link = Array.from(container.querySelectorAll("a")).find(
      (a) => a.getAttribute("href") === "https://drive.example.com/beta",
    );
    expect(link).toBeTruthy();
  });

  test("作成 stays disabled until all required fields are filled", async () => {
    root.render(
      <CreateProjectModal open={true} isSaving={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    await waitFor(() => (container.textContent?.includes("Acme") ? true : null));
    // name only → still disabled (customer / PM / dates missing)
    setInputValue(
      container.querySelector<HTMLInputElement>("#create-project-name") as HTMLInputElement,
      "X",
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(findButton(container, "作成")?.disabled).toBe(true);

    await fillRequiredFields(container);
    await waitFor(() => (findButton(container, "作成")?.disabled === false ? true : null));
    expect(findButton(container, "作成")?.disabled).toBe(false);
  });

  test("explains that columnset uses the org default", async () => {
    root.render(
      <CreateProjectModal open={true} isSaving={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    await waitFor(() => (container.textContent?.includes("カラムセット") ? true : null));
    expect(container.textContent).toContain("組織の既定値");
  });
});
