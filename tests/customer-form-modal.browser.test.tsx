import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { CustomerFormModal } from "../app/components/customers/CustomerFormModal";

// CustomerFormModal creates/edits a KippoCustomer, mirroring KippoCustomerAdmin (kippo#42).
// Create mode loads the org picker (single org → read-only label); edit mode fixes the org.
// 顧客名 is required; other fields are optional.

const organizationsList = vi.fn();

vi.mock("~/lib/api/generated/organizations/organizations", () => ({
  organizationsList: (...args: unknown[]) => organizationsList(...args),
}));

function makeOrg(id: string, name: string) {
  return { id, name, github_organization_name: name };
}

function orgResponse(orgs: ReturnType<typeof makeOrg>[]) {
  return { status: 200 as const, data: { organizations: orgs } };
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

describe("CustomerFormModal", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    organizationsList.mockReset();
    organizationsList.mockResolvedValue(orgResponse([makeOrg("org-1", "Acme")]));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("create: single org auto-selected, submits the payload", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    root.render(
      <CustomerFormModal open={true} isSaving={false} onClose={onClose} onSubmit={onSubmit} />,
    );

    await waitFor(() => (container.textContent?.includes("Acme") ? true : null));
    expect(container.querySelector("#customer-form-org")).toBeNull(); // single org → label

    setInputValue(
      container.querySelector<HTMLInputElement>("#customer-form-name") as HTMLInputElement,
      "Beta Co",
    );
    setInputValue(
      container.querySelector<HTMLInputElement>("#customer-form-email") as HTMLInputElement,
      "ops@beta.example",
    );

    const submitBtn = await waitFor(() =>
      findButton(container, "作成")?.disabled === false ? findButton(container, "作成") : null,
    );
    submitBtn?.click();

    await waitFor(() => (onSubmit.mock.calls.length > 0 ? true : null));
    expect(onSubmit).toHaveBeenCalledWith({
      organization: "org-1",
      name: "Beta Co",
      email: "ops@beta.example",
      phone: "",
      website: "",
      document_url: "",
      notes: "",
    });
    await waitFor(() => (onClose.mock.calls.length > 0 ? true : null));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("作成 stays disabled until 顧客名 is filled", async () => {
    root.render(
      <CustomerFormModal open={true} isSaving={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    await waitFor(() => (container.textContent?.includes("Acme") ? true : null));
    expect(findButton(container, "作成")?.disabled).toBe(true);

    setInputValue(
      container.querySelector<HTMLInputElement>("#customer-form-name") as HTMLInputElement,
      "Beta Co",
    );
    await waitFor(() => (findButton(container, "作成")?.disabled === false ? true : null));
    expect(findButton(container, "作成")?.disabled).toBe(false);
  });

  test("edit: organization is fixed (read-only) and fields prefill", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const customer = {
      id: "cust-1",
      organization: "org-1",
      organization_name: "Acme",
      name: "Beta Co",
      email: "ops@beta.example",
      document_url: "https://drive.example.com/beta",
      active_project_count: 0,
      active_projects_contract_total: 0,
      compliance_verified: false,
      created_datetime: "2026-01-01T00:00:00Z",
      updated_datetime: "2026-01-01T00:00:00Z",
    };

    root.render(
      <CustomerFormModal
        open={true}
        isSaving={false}
        customer={customer}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await waitFor(() =>
      container.querySelector<HTMLInputElement>("#customer-form-name")?.value === "Beta Co"
        ? true
        : null,
    );
    // org loader is not used in edit mode
    expect(organizationsList).not.toHaveBeenCalled();
    expect(container.querySelector("#customer-form-org")).toBeNull();
    expect(container.textContent).toContain("Acme");

    const submitBtn = await waitFor(() =>
      findButton(container, "保存")?.disabled === false ? findButton(container, "保存") : null,
    );
    submitBtn?.click();
    await waitFor(() => (onSubmit.mock.calls.length > 0 ? true : null));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      organization: "org-1",
      name: "Beta Co",
      email: "ops@beta.example",
      document_url: "https://drive.example.com/beta",
    });
  });
});
