/** Shared styling for project × member percentage cells across the assignments UIs.
 * 確定 (is_confirmed) no longer affects display (kiconiaworks/kippo#69 D1), so every
 * assignment uses one style. Per-file hover behavior is layered on at the call site. */
export const ASSIGNMENT_CELL = {
  className: "bg-indigo-100 text-indigo-800 border border-indigo-200",
  title: "割当",
} as const;
