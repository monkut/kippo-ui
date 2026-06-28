import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import {
  CustomerProjectModal,
  type ProjectFormTarget,
} from "../app/components/customers/CustomerProjectModal";
import type { KippoCustomer } from "../app/lib/api/generated/models";

// CustomerProjectModal creates a project for a customer (collecting the required KippoProject /add/
// fields — kippo#41) from the Customers list (kippo#42). Editing a project is the dedicated
// /projects/:id/edit page, not this modal.

const organizationsMembersRetrieve = vi.fn();
const projectCategoriesList = vi.fn();

vi.mock("~/lib/api/generated/organizations/organizations", () => ({
  organizationsMembersRetrieve: (...args: unknown[]) => organizationsMembersRetrieve(...args),
}));
vi.mock("~/lib/api/generated/project-categories/project-categories", () => ({
  projectCategoriesList: (...args: unknown[]) => projectCategoriesList(...args),
}));

function membersResponse(members: { user_id: string; username: string; display_name: string }[]) {
  return { status: 200 as const, data: { members } };
}

function categoriesResponse(keys: { key: string; label: string }[]) {
  return {
    status: 200 as const,
    data: {
      results: keys.map((k) => ({ ...k, organization: null, sort_order: 0, is_active: true })),
    },
  };
}

function makeCustomer(): KippoCustomer {
  return {
    id: "cust-1",
    organization: "org-1",
    organization_name: "Acme",
    name: "Beta Co",
    active_project_count: 1,
    active_projects_contract_total: 0,
    compliance_verified: false,
    created_datetime: "2026-01-01T00:00:00Z",
    updated_datetime: "2026-01-01T00:00:00Z",
  };
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

function setValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype =
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(el, value);
  el.dispatchEvent(
    new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
  );
}

describe("CustomerProjectModal", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    organizationsMembersRetrieve.mockReset();
    projectCategoriesList.mockReset();
    organizationsMembersRetrieve.mockResolvedValue(
      membersResponse([{ user_id: "user-1", username: "pm", display_name: "PM User" }]),
    );
    projectCategoriesList.mockResolvedValue(
      categoriesResponse([
        { key: "ai-development", label: "AI開発" },
        { key: "other", label: "その他" },
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

  test("create: 作成 stays disabled until all required /add/ fields are filled, then submits them", async () => {
    const onCreate = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    const target: ProjectFormTarget = { customer: makeCustomer() };

    root.render(
      <CustomerProjectModal
        open={true}
        target={target}
        isSaving={false}
        onClose={onClose}
        onCreate={onCreate}
      />,
    );

    await waitFor(() => (container.textContent?.includes("Acme") ? true : null));
    expect(container.textContent).toContain("Beta Co"); // customer read-only
    // name only → still disabled (PM / category / dates / 工数 / 課題 missing)
    setValue(container.querySelector("#customer-project-name") as HTMLInputElement, "Apollo");
    await new Promise((r) => setTimeout(r, 50));
    expect(findButton(container, "作成")?.disabled).toBe(true);

    const pm = await waitFor(() => {
      const s = container.querySelector<HTMLSelectElement>("#customer-project-pm");
      return s && s.querySelectorAll("option").length > 1 ? s : null;
    });
    setValue(pm as HTMLSelectElement, "user-1");
    const cat = await waitFor(() => {
      const s = container.querySelector<HTMLSelectElement>("#customer-project-category");
      return s && s.querySelectorAll("option").length > 1 ? s : null;
    });
    setValue(cat as HTMLSelectElement, "ai-development");
    setValue(container.querySelector("#customer-project-start") as HTMLInputElement, "2026-02-01");
    setValue(container.querySelector("#customer-project-target") as HTMLInputElement, "2026-08-31");
    setValue(container.querySelector("#customer-project-allocated") as HTMLInputElement, "10");
    setValue(
      container.querySelector("#customer-project-problem") as HTMLTextAreaElement,
      "課題XYZ",
    );

    const submit = await waitFor(() =>
      findButton(container, "作成")?.disabled === false ? findButton(container, "作成") : null,
    );
    submit?.click();
    await waitFor(() => (onCreate.mock.calls.length > 0 ? true : null));
    expect(projectCategoriesList).toHaveBeenCalledWith({ organization: "org-1" });
    expect(onCreate).toHaveBeenCalledWith({
      organization: "org-1",
      customer: "cust-1",
      name: "Apollo",
      phase: "proposing-low",
      category: "ai-development",
      project_manager: "user-1",
      start_date: "2026-02-01",
      target_date: "2026-08-31",
      allocated_staff_days: 10,
      problem_definition: "課題XYZ",
    });
    await waitFor(() => (onClose.mock.calls.length > 0 ? true : null));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
