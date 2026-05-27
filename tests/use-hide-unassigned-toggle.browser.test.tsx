import { afterEach, beforeEach, describe, expect, test } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import {
  HIDE_UNASSIGNED_STORAGE_KEY,
  useHideUnassignedToggle,
} from "../app/hooks/useHideUnassignedToggle";

// #21 F5: the toggle's value must persist across re-mounts via localStorage.

function Harness() {
  const [value, setValue] = useHideUnassignedToggle();
  return (
    <div>
      <span data-testid="value">{value ? "true" : "false"}</span>
      <button type="button" data-testid="toggle" onClick={() => setValue(!value)}>
        toggle
      </button>
    </div>
  );
}

async function waitFor<T>(probe: () => T | null | undefined, timeout = 2000): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = probe();
    if (value !== null && value !== undefined) return value;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

describe("useHideUnassignedToggle (#21 F5)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    window.localStorage.removeItem(HIDE_UNASSIGNED_STORAGE_KEY);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    window.localStorage.removeItem(HIDE_UNASSIGNED_STORAGE_KEY);
  });

  test("defaults to false when nothing is stored", async () => {
    root.render(<Harness />);
    const value = await waitFor(
      () => container.querySelector('[data-testid="value"]')?.textContent,
    );
    expect(value).toBe("false");
  });

  test("toggling writes 'true' to localStorage", async () => {
    root.render(<Harness />);
    await waitFor(() => container.querySelector('[data-testid="toggle"]'));
    (container.querySelector('[data-testid="toggle"]') as HTMLButtonElement).click();
    const value = await waitFor(() => {
      const text = container.querySelector('[data-testid="value"]')?.textContent;
      return text === "true" ? text : null;
    });
    expect(value).toBe("true");
    expect(window.localStorage.getItem(HIDE_UNASSIGNED_STORAGE_KEY)).toBe("true");
  });

  test("re-mounting after toggle restores 'true' from localStorage", async () => {
    // First mount: toggle on.
    root.render(<Harness />);
    await waitFor(() => container.querySelector('[data-testid="toggle"]'));
    (container.querySelector('[data-testid="toggle"]') as HTMLButtonElement).click();
    await waitFor(() =>
      container.querySelector('[data-testid="value"]')?.textContent === "true" ? true : null,
    );

    // Unmount + fresh mount in a new container — simulating a page reload.
    root.unmount();
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(<Harness />);

    const value = await waitFor(() => {
      const text = container.querySelector('[data-testid="value"]')?.textContent;
      return text === "true" ? text : null;
    });
    expect(value).toBe("true");
  });

  test("toggling off writes 'false' to localStorage", async () => {
    window.localStorage.setItem(HIDE_UNASSIGNED_STORAGE_KEY, "true");
    root.render(<Harness />);
    // Wait for hydration to 'true', then toggle off.
    await waitFor(() =>
      container.querySelector('[data-testid="value"]')?.textContent === "true" ? true : null,
    );
    (container.querySelector('[data-testid="toggle"]') as HTMLButtonElement).click();
    const value = await waitFor(() => {
      const text = container.querySelector('[data-testid="value"]')?.textContent;
      return text === "false" ? text : null;
    });
    expect(value).toBe("false");
    expect(window.localStorage.getItem(HIDE_UNASSIGNED_STORAGE_KEY)).toBe("false");
  });
});
