/** Read a list payload defensively: the backend list-actions return a bare array, but
 * drf-spectacular types them as paginated ({results}). Handle both shapes. */
export function readList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const results = (data as { results?: T[] } | null)?.results;
  return Array.isArray(results) ? results : [];
}
