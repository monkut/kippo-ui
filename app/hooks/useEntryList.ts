import { useState } from "react";

/** State + mutators for the repeated multi-entry create forms (課題定義 / 前提条件 /
 * 業務要件 / 技術要件). Each entry carries a numeric `id` (new rows use `Date.now()`
 * at the call site). `remove` keeps at least one entry — the forms never let the
 * user delete the final row. */
export function useEntryList<T extends { id: number }>(initial: T[]) {
  const [entries, setEntries] = useState<T[]>(initial);

  const add = (entry: T) => setEntries((prev) => [...prev, entry]);

  const remove = (id: number) =>
    setEntries((prev) => (prev.length > 1 ? prev.filter((e) => e.id !== id) : prev));

  const update = (id: number, patch: Partial<T>) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  return { entries, setEntries, add, remove, update };
}
