import { useEffect, useState } from "react";

export const HIDDEN_PROJECT_CATEGORIES_STORAGE_KEY = "kippo.projects.hiddenCategories";

/** Categories hidden by default on the project list.
 *
 * These are the canonical `KippoProject.category` values that were historically
 * excluded from the UI list (PAO, 保守 maintenance, R&D, 講師 instructor). Earlier
 * the exclusion was a hardcoded array that mixed raw values with display labels,
 * so only `PAO` and `maintenance` actually matched; the canonical values below
 * restore the intended default while letting the user override per category.
 */
export const DEFAULT_HIDDEN_PROJECT_CATEGORIES = ["PAO", "maintenance", "r-and-d", "instructor"];

/** Read+persist the project list's "hidden categories" set to localStorage.
 *
 * Seeded with {@link DEFAULT_HIDDEN_PROJECT_CATEGORIES} when nothing is stored.
 * A stored value (including an empty list) always wins, so unticking every
 * default category sticks across reloads. Failures to access localStorage
 * (private mode, disabled storage) are swallowed — the toggle still works for
 * the current session.
 *
 * Key: `kippo.projects.hiddenCategories`.
 */
export function useHiddenProjectCategories(): [Set<string>, (next: Set<string>) => void] {
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(DEFAULT_HIDDEN_PROJECT_CATEGORIES),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(HIDDEN_PROJECT_CATEGORIES_STORAGE_KEY);
      if (raw === null) return; // never set — keep defaults
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setHidden(new Set(parsed.filter((c): c is string => typeof c === "string")));
      }
    } catch {
      // localStorage unavailable or corrupt — keep defaults.
    }
  }, []);

  const update = (next: Set<string>) => {
    setHidden(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(HIDDEN_PROJECT_CATEGORIES_STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // localStorage unavailable — in-memory set still works.
    }
  };

  return [hidden, update];
}
