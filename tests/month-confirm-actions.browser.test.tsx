import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { MonthConfirmActions } from "../app/components/project-assignments/MonthConfirmActions";
import type { ProjectMonthlyAssignment } from "../app/lib/api/generated/models";

// kippo#23: page-level "この月を確定" / "この月の確定を解除" buttons. The matrix
// row count is implicit (the hook pre-filters to the displayed month), so the
// component takes raw `assignments` plus an `onBulkSetConfirmed` callback.

function makeAssignment(over: Partial<ProjectMonthlyAssignment>): ProjectMonthlyAssignment {
  return {
    id: 1,
    project: "p-1",
    project_name: "Project 1",
    user: "u-1",
    user_username: "alice",
    user_display_name: "Alice",
    user_github_login: "alice-gh",
    user_slack_username: null,
    user_slack_image_url: null,
    month: "2026-05-01",
    percentage: 50,
    is_confirmed: true,
    created_datetime: "2026-05-08T00:00:00Z",
    updated_datetime: "2026-05-08T00:00:00Z",
    ...over,
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

function findButton(container: HTMLElement, startsWith: string): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((b) =>
      (b.textContent ?? "").startsWith(startsWith),
    ) ?? null
  );
}

describe("MonthConfirmActions — kippo#23", () => {
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

  test("confirm button PATCHes every unconfirmed row to is_confirmed=true", async () => {
    const onBulkSetConfirmed = vi.fn().mockResolvedValue(true);
    const confirmFn = vi.fn().mockReturnValue(true);
    const assignments: ProjectMonthlyAssignment[] = [
      makeAssignment({ id: 1, is_confirmed: false }),
      makeAssignment({ id: 2, is_confirmed: false }),
      makeAssignment({ id: 3, is_confirmed: true }),
    ];

    root.render(
      <MonthConfirmActions
        assignments={assignments}
        isSaving={false}
        onBulkSetConfirmed={onBulkSetConfirmed}
        confirmFn={confirmFn}
      />,
    );

    const confirmBtn = await waitFor(() => findButton(container, "この月を確定"));
    expect(confirmBtn).not.toBeNull();
    confirmBtn?.click();

    // wait for async click handler
    await waitFor(() => (onBulkSetConfirmed.mock.calls.length > 0 ? true : null));

    expect(confirmFn).toHaveBeenCalledWith("2件の割当を確定しますか?");
    expect(onBulkSetConfirmed).toHaveBeenCalledTimes(1);
    expect(onBulkSetConfirmed).toHaveBeenCalledWith([1, 2], true);
  });

  test("unconfirm button PATCHes every confirmed row to is_confirmed=false", async () => {
    const onBulkSetConfirmed = vi.fn().mockResolvedValue(true);
    const confirmFn = vi.fn().mockReturnValue(true);
    const assignments: ProjectMonthlyAssignment[] = [
      makeAssignment({ id: 1, is_confirmed: true }),
      makeAssignment({ id: 2, is_confirmed: true }),
      makeAssignment({ id: 3, is_confirmed: false }),
    ];

    root.render(
      <MonthConfirmActions
        assignments={assignments}
        isSaving={false}
        onBulkSetConfirmed={onBulkSetConfirmed}
        confirmFn={confirmFn}
      />,
    );

    const unconfirmBtn = await waitFor(() => findButton(container, "この月の確定を解除"));
    unconfirmBtn?.click();
    await waitFor(() => (onBulkSetConfirmed.mock.calls.length > 0 ? true : null));

    expect(confirmFn).toHaveBeenCalledWith("2件の割当の確定を解除しますか?");
    expect(onBulkSetConfirmed).toHaveBeenCalledWith([1, 2], false);
  });

  test("confirm disabled when every row is already confirmed", async () => {
    const onBulkSetConfirmed = vi.fn();
    root.render(
      <MonthConfirmActions
        assignments={[
          makeAssignment({ id: 1, is_confirmed: true }),
          makeAssignment({ id: 2, is_confirmed: true }),
        ]}
        isSaving={false}
        onBulkSetConfirmed={onBulkSetConfirmed}
        confirmFn={() => true}
      />,
    );

    const confirmBtn = await waitFor(() => findButton(container, "この月を確定"));
    const unconfirmBtn = findButton(container, "この月の確定を解除");
    expect(confirmBtn?.disabled).toBe(true);
    expect(unconfirmBtn?.disabled).toBe(false);
  });

  test("unconfirm disabled when every row is unconfirmed", async () => {
    root.render(
      <MonthConfirmActions
        assignments={[
          makeAssignment({ id: 1, is_confirmed: false }),
          makeAssignment({ id: 2, is_confirmed: false }),
        ]}
        isSaving={false}
        onBulkSetConfirmed={vi.fn()}
        confirmFn={() => true}
      />,
    );

    const confirmBtn = await waitFor(() => findButton(container, "この月を確定"));
    const unconfirmBtn = findButton(container, "この月の確定を解除");
    expect(confirmBtn?.disabled).toBe(false);
    expect(unconfirmBtn?.disabled).toBe(true);
  });

  test("both buttons disabled while isSaving", async () => {
    root.render(
      <MonthConfirmActions
        assignments={[
          makeAssignment({ id: 1, is_confirmed: true }),
          makeAssignment({ id: 2, is_confirmed: false }),
        ]}
        isSaving={true}
        onBulkSetConfirmed={vi.fn()}
        confirmFn={() => true}
      />,
    );

    const confirmBtn = await waitFor(() => findButton(container, "この月を確定"));
    const unconfirmBtn = findButton(container, "この月の確定を解除");
    expect(confirmBtn?.disabled).toBe(true);
    expect(unconfirmBtn?.disabled).toBe(true);
  });

  test("cancelling the confirm dialog aborts — no PATCH call", async () => {
    const onBulkSetConfirmed = vi.fn();
    const confirmFn = vi.fn().mockReturnValue(false); // user clicks "Cancel"
    root.render(
      <MonthConfirmActions
        assignments={[makeAssignment({ id: 1, is_confirmed: false })]}
        isSaving={false}
        onBulkSetConfirmed={onBulkSetConfirmed}
        confirmFn={confirmFn}
      />,
    );

    const confirmBtn = await waitFor(() => findButton(container, "この月を確定"));
    confirmBtn?.click();
    // small wait — handler is async, but the cancel path returns synchronously
    await new Promise((r) => setTimeout(r, 50));

    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(onBulkSetConfirmed).not.toHaveBeenCalled();
  });

  test("button labels surface the affected count", async () => {
    root.render(
      <MonthConfirmActions
        assignments={[
          makeAssignment({ id: 1, is_confirmed: true }),
          makeAssignment({ id: 2, is_confirmed: true }),
          makeAssignment({ id: 3, is_confirmed: false }),
        ]}
        isSaving={false}
        onBulkSetConfirmed={vi.fn()}
        confirmFn={() => true}
      />,
    );

    const confirmBtn = await waitFor(() => findButton(container, "この月を確定"));
    const unconfirmBtn = findButton(container, "この月の確定を解除");
    expect(confirmBtn?.textContent).toContain("(1)");
    expect(unconfirmBtn?.textContent).toContain("(2)");
  });
});
