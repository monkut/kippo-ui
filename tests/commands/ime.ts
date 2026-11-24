/// <reference types="@vitest/browser/providers/playwright" />
import type { BrowserCommand } from "vitest/node";

/**
 * Type `text` into `selector` as a real IME composition (Chromium CDP):
 * composition start/update with `text`, then commit it. Synthetic DOM events cannot
 * reproduce IME bugs because the browser itself re-inserts the committed text.
 */
export const imeType: BrowserCommand<[selector: string, text: string]> = async (
  ctx,
  selector,
  text,
) => {
  if (ctx.provider.name !== "playwright") throw new Error("imeType requires playwright");
  await ctx.iframe.locator(selector).focus();
  const cdp = await ctx.page.context().newCDPSession(ctx.page);
  await cdp.send("Input.imeSetComposition", {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });
  await cdp.send("Input.insertText", { text });
  await cdp.detach();
};
