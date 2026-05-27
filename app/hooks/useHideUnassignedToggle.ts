import { useEffect, useState } from "react";

export const HIDE_UNASSIGNED_STORAGE_KEY = "kippo.monthlyMatrix.hideUnassigned";

/** Read+persist the matrix's "hide unassigned members" toggle to localStorage.
 *
 * SSR-safe: defaults to `false` on the server (no window) and on first client
 * paint, then rehydrates from storage in an effect. Failures to access
 * localStorage (private mode, disabled storage) are swallowed — the toggle
 * still works for the current session.
 *
 * Key: `kippo.monthlyMatrix.hideUnassigned` (#21 F5).
 */
export function useHideUnassignedToggle(): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(HIDE_UNASSIGNED_STORAGE_KEY);
      if (raw === "true") setValue(true);
    } catch {
      // localStorage unavailable — keep default.
    }
  }, []);

  const update = (next: boolean) => {
    setValue(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(HIDE_UNASSIGNED_STORAGE_KEY, next ? "true" : "false");
    } catch {
      // localStorage unavailable — in-memory toggle still works.
    }
  };

  return [value, update];
}
