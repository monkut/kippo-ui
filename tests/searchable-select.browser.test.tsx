import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { SearchableSelect, type SearchableSelectOption } from "../app/components/searchable-select";

// The weekly-effort project dropdown is a searchable combobox: typing filters the
// option list, and picking an option reports its id to the parent.

const OPTIONS: SearchableSelectOption[] = [
  { id: "a", label: "Acme ・ Beta" },
  { id: "b", label: "Gamma" },
  { id: "c", label: "Zeta商事 ・ Alpha" },
];

const flush = () => new Promise((r) => setTimeout(r, 30));

function setInput(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// headlessui renders ComboboxOptions in a portal on document.body.
function visibleOptions(): string[] {
  return Array.from(document.querySelectorAll('[role="option"]')).map(
    (el) => el.textContent?.trim() ?? "",
  );
}

describe("SearchableSelect", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("shows the selected option's label in the input", async () => {
    root.render(<SearchableSelect options={OPTIONS} value="c" onChange={() => {}} />);
    await flush();
    const input = container.querySelector<HTMLInputElement>("input");
    expect(input?.value).toBe("Zeta商事 ・ Alpha");
  });

  test("lists all options on focus and filters them as the user types", async () => {
    root.render(<SearchableSelect options={OPTIONS} value="" onChange={() => {}} />);
    await flush();
    const input = container.querySelector<HTMLInputElement>("input");
    expect(input).not.toBeNull();
    if (!input) return;

    input.focus();
    await flush();
    expect(visibleOptions()).toEqual(["Acme ・ Beta", "Gamma", "Zeta商事 ・ Alpha"]);

    setInput(input, "alpha");
    await flush();
    expect(visibleOptions()).toEqual(["Zeta商事 ・ Alpha"]);

    setInput(input, "存在しない");
    await flush();
    expect(visibleOptions()).toEqual([]);
  });

  test("reports the picked option's id via onChange", async () => {
    const onChange = vi.fn();
    root.render(<SearchableSelect options={OPTIONS} value="" onChange={onChange} />);
    await flush();
    const input = container.querySelector<HTMLInputElement>("input");
    input?.focus();
    await flush();

    setInput(input as HTMLInputElement, "gam");
    await flush();
    const option = document.querySelector<HTMLElement>('[role="option"]');
    expect(option?.textContent).toContain("Gamma");
    // headlessui selects the active option on Enter; synthetic .click() does not
    // go through its pointer tracking.
    input?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    await flush();
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
