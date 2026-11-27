import { useCallback, useState } from "react";
import type { SectionFormState } from "~/components/project-detail/display";

/** Create-form visibility + the row being edited, for one requirement section. */
export function useSectionForm<T>(): SectionFormState<T> {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const openForm = useCallback(() => setShowForm(true), []);
  const closeForm = useCallback(() => setShowForm(false), []);
  const stopEditing = useCallback(() => setEditing(null), []);
  return { showForm, editing, openForm, closeForm, startEditing: setEditing, stopEditing };
}
