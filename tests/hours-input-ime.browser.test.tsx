import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import { commands } from "@vitest/browser/context";
import { HoursInput } from "../app/components/weekly-effort/HoursInput";

declare module "@vitest/browser/context" {
  interface BrowserCommands {
    imeType: (selector: string, text: string) => Promise<void>;
  }
}

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function Harness() {
  const [hours, setHours] = useState("");
  return (
    <>
      <HoursInput id="hours" value={hours} onValueChange={setHours} />
      <output id="state">{hours}</output>
    </>
  );
}

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<Harness />);
  });
}

async function imeType(text: string) {
  await commands.imeType("#hours", text);
  // Let React flush the composition-end update.
  await act(async () => {});
}

const input = () => document.querySelector<HTMLInputElement>("#hours")!;
const state = () => document.querySelector("#state")!.textContent;

describe("HoursInput IME entry", () => {
  test("a full-width digit committed via IME is entered once", async () => {
    await mount();
    await imeType("８");
    expect(input().value).toBe("8");
    expect(state()).toBe("8");
  });

  test("consecutive IME commits append without doubling", async () => {
    await mount();
    await imeType("１");
    await imeType("２");
    expect(input().value).toBe("12");
    expect(state()).toBe("12");
  });

  test("a half-width digit committed via IME is entered once", async () => {
    await mount();
    await imeType("5");
    expect(input().value).toBe("5");
  });

  test("non-digits committed via IME are stripped", async () => {
    await mount();
    await imeType("あ");
    expect(input().value).toBe("");
    expect(state()).toBe("");
  });
});
