import { afterEach, beforeEach, describe, expect, test } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import {
  DEFAULT_HIDDEN_PROJECT_CATEGORIES,
  HIDDEN_PROJECT_CATEGORIES_STORAGE_KEY,
  useHiddenProjectCategories,
} from "../app/hooks/useHiddenProjectCategories";

// The hidden-category selection seeds from the canonical defaults and must
// persist user overrides (including "hide nothing") across re-mounts.

function Harness() {
  const [hidden, setHidden] = useHiddenProjectCategories();
  const toggle = (category: string) => {
    const next = new Set(hidden);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    setHidden(next);
  };
  return (
    <div>
      <span data-testid="hidden">{[...hidden].sort().join(",")}</span>
      <button type="button" data-testid="toggle-pao" onClick={() => toggle("PAO")}>
        toggle PAO
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

const read = (container: HTMLElement) =>
  container.querySelector('[data-testid="hidden"]')?.textContent;

describe("useHiddenProjectCategories", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    window.localStorage.removeItem(HIDDEN_PROJECT_CATEGORIES_STORAGE_KEY);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    window.localStorage.removeItem(HIDDEN_PROJECT_CATEGORIES_STORAGE_KEY);
  });

  test("defaults to the canonical hidden categories when nothing is stored", async () => {
    root.render(<Harness />);
    const expected = [...DEFAULT_HIDDEN_PROJECT_CATEGORIES].sort().join(",");
    const value = await waitFor(() => (read(container) === expected ? expected : null));
    expect(value).toBe(expected);
  });

  test("unticking the last default still hides it persists as an explicit set", async () => {
    // PAO is a default; toggling it removes PAO from the hidden set and writes it.
    root.render(<Harness />);
    await waitFor(() => container.querySelector('[data-testid="toggle-pao"]'));
    (container.querySelector('[data-testid="toggle-pao"]') as HTMLButtonElement).click();
    await waitFor(() => (read(container)?.includes("PAO") ? null : true));

    const stored = JSON.parse(
      window.localStorage.getItem(HIDDEN_PROJECT_CATEGORIES_STORAGE_KEY) ?? "[]",
    ) as string[];
    expect(stored).not.toContain("PAO");
    expect(stored).toContain("maintenance");
  });

  test("a stored empty list wins over the defaults (hide nothing)", async () => {
    window.localStorage.setItem(HIDDEN_PROJECT_CATEGORIES_STORAGE_KEY, "[]");
    root.render(<Harness />);
    const value = await waitFor(() => (read(container) === "" ? "" : null));
    expect(value).toBe("");
  });

  test("re-mounting restores the stored selection", async () => {
    window.localStorage.setItem(HIDDEN_PROJECT_CATEGORIES_STORAGE_KEY, JSON.stringify(["poc"]));
    root.render(<Harness />);
    const value = await waitFor(() => (read(container) === "poc" ? "poc" : null));
    expect(value).toBe("poc");
  });
});
