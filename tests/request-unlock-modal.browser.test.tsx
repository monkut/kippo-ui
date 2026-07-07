import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "react-dom/client";

// Request-unlock flow (kippo#54 / T18): the modal POSTs { organization, week_start, reason } to
// /api/weekly-effort-unlocks/ and surfaces the server's reason on rejection (e.g. duplicate request).

const weeklyEffortUnlocksCreate = vi.hoisted(() => vi.fn());
vi.mock("~/lib/api/generated/weekly-effort-unlocks/weekly-effort-unlocks", () => ({
  weeklyEffortUnlocksCreate: (...a: unknown[]) => weeklyEffortUnlocksCreate(...a),
}));

import { RequestUnlockModal } from "../app/components/weekly-effort/RequestUnlockModal";

const flush = () => new Promise((r) => setTimeout(r, 30));

function findButton(container: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
      (b.textContent ?? "").includes(text),
    ) ?? null
  );
}

function setTextarea(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("RequestUnlockModal", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    weeklyEffortUnlocksCreate.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("submits the unlock request and shows the confirmation", async () => {
    weeklyEffortUnlocksCreate.mockResolvedValue({ status: 201, data: { id: 5 } });
    root.render(
      <RequestUnlockModal open weekStart="2026-06-01" organizationId="org-1" onClose={() => {}} />,
    );
    await flush();

    // Submit is disabled until a reason is entered.
    expect(findButton(container, "申請する")?.disabled).toBe(true);

    const reason = container.querySelector("#unlock-reason") as HTMLTextAreaElement;
    setTextarea(reason, "月末の修正が必要");
    await flush();

    await (async () => {
      const start = Date.now();
      while (Date.now() - start < 2000) {
        findButton(container, "申請する")?.click();
        if (weeklyEffortUnlocksCreate.mock.calls.length > 0) return;
        await flush();
      }
    })();

    expect(weeklyEffortUnlocksCreate).toHaveBeenCalledWith({
      organization: "org-1",
      week_start: "2026-06-01",
      reason: "月末の修正が必要",
    });
    await flush();
    expect(container.textContent).toContain("申請しました");
  });

  test("surfaces the server error on a duplicate/rejected request", async () => {
    weeklyEffortUnlocksCreate.mockResolvedValue({
      status: 400,
      data: { week_start: ["この週のアンロックは既に申請済みです。"] },
    });
    root.render(
      <RequestUnlockModal open weekStart="2026-06-01" organizationId="org-1" onClose={() => {}} />,
    );
    await flush();

    const reason = container.querySelector("#unlock-reason") as HTMLTextAreaElement;
    setTextarea(reason, "再申請");
    await flush();

    await (async () => {
      const start = Date.now();
      while (Date.now() - start < 2000) {
        findButton(container, "申請する")?.click();
        if (weeklyEffortUnlocksCreate.mock.calls.length > 0) return;
        await flush();
      }
    })();
    await flush();

    expect(container.textContent).toContain("既に申請済み");
    // Stayed on the form (no confirmation).
    expect(container.textContent).not.toContain("申請しました");
  });
});
