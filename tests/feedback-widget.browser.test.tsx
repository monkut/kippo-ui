import { expect, test, describe, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { FeedbackWidget } from "../app/components/feedback-widget";

vi.mock("../app/lib/api/generated/feedback/feedback", () => ({
  feedbackFeedbackCreate: vi.fn(),
}));

import { feedbackFeedbackCreate } from "../app/lib/api/generated/feedback/feedback";

const waitForElement = async (selector: string, timeout = 3000): Promise<Element | null> => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("FeedbackWidget", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(feedbackFeedbackCreate).mockReset();
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  test("renders collapsed bubble button by default", async () => {
    root.render(<FeedbackWidget />);

    const button = (await waitForElement(
      "button[aria-label='フィードバックを送る']",
    )) as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.className).toContain("fixed");
    expect(button.className).toContain("bottom-6");
    expect(button.className).toContain("right-6");
    expect(button.className).toContain("rounded-full");
  });

  test("expands into form when button clicked", async () => {
    root.render(<FeedbackWidget />);

    const button = (await waitForElement(
      "button[aria-label='フィードバックを送る']",
    )) as HTMLButtonElement;
    button.click();

    const textarea = (await waitForElement("textarea#feedback-comment")) as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    expect(textarea.getAttribute("required")).not.toBeNull();

    const submitButton = document.querySelector(
      "button[type='submit']",
    ) as HTMLButtonElement | null;
    expect(submitButton).toBeTruthy();
    expect(submitButton?.disabled).toBe(true);
  });

  test("submits comment-only payload with derived title and default category", async () => {
    vi.mocked(feedbackFeedbackCreate).mockResolvedValue({
      status: 201,
      data: {},
      headers: new Headers(),
    } as Awaited<ReturnType<typeof feedbackFeedbackCreate>>);

    root.render(<FeedbackWidget />);
    const openBtn = (await waitForElement(
      "button[aria-label='フィードバックを送る']",
    )) as HTMLButtonElement;
    openBtn.click();

    const textarea = (await waitForElement("textarea#feedback-comment")) as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(textarea, "Short title line\nmore detail here");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    const form = textarea.closest("form") as HTMLFormElement;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await flush();
    await flush();

    expect(feedbackFeedbackCreate).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(feedbackFeedbackCreate).mock.calls[0][0];
    expect(payload.title).toBe("Short title line");
    expect(payload.comment).toBe("Short title line\nmore detail here");
    expect(payload.category).toBe("general");
    expect("organization" in payload).toBe(false);
  });

  test("closes when cancel clicked", async () => {
    root.render(<FeedbackWidget />);

    const openBtn = (await waitForElement(
      "button[aria-label='フィードバックを送る']",
    )) as HTMLButtonElement;
    openBtn.click();

    await waitForElement("textarea#feedback-comment");
    const cancelBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent === "キャンセル",
    ) as HTMLButtonElement;
    cancelBtn.click();

    const bubble = await waitForElement("button[aria-label='フィードバックを送る']");
    expect(bubble).toBeTruthy();
    expect(document.querySelector("textarea#feedback-comment")).toBeNull();
  });
});
