// customFetch resolves (it does NOT throw) on 4xx/5xx — it returns { status, data }. A caller that
// only try/catches around an await therefore treats a 400 as success. These helpers let a caller
// turn a non-2xx response into a throw and surface the DRF error body instead of a generic message.

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
  ) {
    super(`API error ${status}`);
    this.name = "ApiError";
  }
}

/** Throw an ApiError when a customFetch response is not 2xx; otherwise return it unchanged. */
export function throwOnError<T extends { status: number; data: unknown }>(response: T): T {
  if (response.status < 200 || response.status >= 300) {
    throw new ApiError(response.status, response.data);
  }
  return response;
}

/** Human-readable message from a thrown ApiError: the DRF `detail`, or field errors joined as
 * "field: message / …" (non_field_errors shown without a prefix). Returns null for anything that
 * isn't a recognizable DRF error body, so the caller can fall back to its own generic message. */
export function apiErrorMessage(error: unknown): string | null {
  const data = error instanceof ApiError ? error.data : null;
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;
  const parts: string[] = [];
  for (const [field, value] of Object.entries(record)) {
    const text = (Array.isArray(value) ? value : [value])
      .filter((v): v is string => typeof v === "string")
      .join(" ");
    if (text) parts.push(field === "non_field_errors" ? text : `${field}: ${text}`);
  }
  return parts.length > 0 ? parts.join(" / ") : null;
}
