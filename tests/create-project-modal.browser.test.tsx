import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { CreateProjectModal } from "../app/components/project-assignments/CreateProjectModal";

// CreateProjectModal registers a new KippoProject from its required fields only
// (organization + name). `columnset` is resolved from the org default on the
// backend, so the modal never asks for it. The org list is fetched on open.

const organizationsList = vi.fn();
vi.mock("~/lib/api/generated/organizations/organizations", () => ({
  organizationsList: (...args: unknown[]) => organizationsList(...args),
}));

function makeOrg(id: string, name: string) {
  return { id, name, github_organization_name: name };
}

// The runtime `/api/organizations/` payload is `{organizations: [...]}` (the schema
// auto-paginates, but the endpoint does not) — mirror the runtime shape here.
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

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("CreateProjectModal — required-fields-only project creation", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    organizationsList.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("single org: renders read-only org label + name, submits org+name only", async () => {
    organizationsList.mockResolvedValue(orgResponse([makeOrg("org-1", "Acme")]));
    const onSubmit = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    root.render(
      <CreateProjectModal open={true} isSaving={false} onClose={onClose} onSubmit={onSubmit} />,
    );

    // Org loads → single org shown as a read-only label (no <select>).
    await waitFor(() => (container.textContent?.includes("Acme") ? true : null));
    expect(container.querySelector("#create-project-org")).toBeNull();

    const nameInput = container.querySelector<HTMLInputElement>("#create-project-name");
    expect(nameInput).not.toBeNull();
    setInputValue(nameInput as HTMLInputElement, "Apollo");

    const submitBtn = await waitFor(() =>
      findButton(container, "作成")?.disabled === false ? findButton(container, "作成") : null,
    );
    submitBtn?.click();

    await waitFor(() => (onSubmit.mock.calls.length > 0 ? true : null));
    expect(onSubmit).toHaveBeenCalledWith({ organization: "org-1", name: "Apollo" });
    await waitFor(() => (onClose.mock.calls.length > 0 ? true : null));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("explains that columnset uses the org default", async () => {
    organizationsList.mockResolvedValue(orgResponse([makeOrg("org-1", "Acme")]));
    root.render(
      <CreateProjectModal open={true} isSaving={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    await waitFor(() => (container.textContent?.includes("カラムセット") ? true : null));
    expect(container.textContent).toContain("組織の既定値");
  });

  test("multiple orgs: renders a select, submits the chosen org", async () => {
    organizationsList.mockResolvedValue(
      orgResponse([makeOrg("org-1", "Acme"), makeOrg("org-2", "Globex")]),
    );
    const onSubmit = vi.fn().mockResolvedValue(true);

    root.render(
      <CreateProjectModal open={true} isSaving={false} onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    const select = await waitFor(() =>
      container.querySelector<HTMLSelectElement>("#create-project-org"),
    );
    expect(select).not.toBeNull();
    expect(select?.querySelectorAll("option").length).toBe(2);

    setSelectValue(select as HTMLSelectElement, "org-2");
    setInputValue(
      container.querySelector<HTMLInputElement>("#create-project-name") as HTMLInputElement,
      "Mercury",
    );

    const submitBtn = await waitFor(() =>
      findButton(container, "作成")?.disabled === false ? findButton(container, "作成") : null,
    );
    submitBtn?.click();

    await waitFor(() => (onSubmit.mock.calls.length > 0 ? true : null));
    expect(onSubmit).toHaveBeenCalledWith({ organization: "org-2", name: "Mercury" });
  });

  test("作成 stays disabled until a name is entered", async () => {
    organizationsList.mockResolvedValue(orgResponse([makeOrg("org-1", "Acme")]));
    root.render(
      <CreateProjectModal open={true} isSaving={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await waitFor(() => (container.textContent?.includes("Acme") ? true : null));
    expect(findButton(container, "作成")?.disabled).toBe(true);

    setInputValue(
      container.querySelector<HTMLInputElement>("#create-project-name") as HTMLInputElement,
      "X",
    );
    await waitFor(() => (findButton(container, "作成")?.disabled === false ? true : null));
    expect(findButton(container, "作成")?.disabled).toBe(false);
  });

  test("whitespace-only name does not enable 作成", async () => {
    organizationsList.mockResolvedValue(orgResponse([makeOrg("org-1", "Acme")]));
    root.render(
      <CreateProjectModal open={true} isSaving={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    await waitFor(() => (container.textContent?.includes("Acme") ? true : null));
    setInputValue(
      container.querySelector<HTMLInputElement>("#create-project-name") as HTMLInputElement,
      "   ",
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(findButton(container, "作成")?.disabled).toBe(true);
  });
});
