/** Shared styling for project × member percentage cells across the assignments
 * UIs. The dashed border on `UNCONFIRMED_CELL` is kept on purpose — color is
 * not the only signal (accessibility / non-color-vision-dependent encoding).
 *
 * Per-file hover behavior (e.g. `hover:bg-gray-100` on the clickable variant
 * in `AssignmentsTable`) is layered on at the call site — only the base
 * appearance lives here. */
export const CONFIRMED_CELL = {
  className: "bg-indigo-100 text-indigo-800 border border-indigo-200",
  title: "確定済み",
} as const;

export const UNCONFIRMED_CELL = {
  className: "bg-gray-50 text-gray-600 border border-dashed border-gray-300",
  title: "未確定 (予測)",
} as const;
