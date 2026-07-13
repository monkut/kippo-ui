// Client-side CSV download. The browser has no built-in "save this string as a file", so build a
// Blob and click a transient object-URL anchor. Prefix a UTF-8 BOM so Excel opens 日本語 correctly.

export function downloadCsv(filename: string, content: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Defer revoke: revoking on the same tick as click() can invalidate the blob URL before the
  // browser starts the download (notably Firefox / large blobs), yielding an empty file.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
