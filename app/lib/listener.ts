/**
 * kiconia-kippo-listener integration (monkut/kippo-ui#139).
 *
 * The listener attributes meeting transcript to the project in focus. The project-status
 * slideshow reports the displayed project to it so the facilitator no longer mirrors every
 * slide change by hand. URL + key come from the organization (kiconiaworks/kippo#66, via
 * GET /api/organizations/), never from build-time env or hand-entered browser storage.
 */

export interface ListenerConfig {
  url: string;
  apiKey: string;
}

/** POST outcome, surfaced as the badge state in the slideshow header. */
export type ListenerFocusResult = "ok" | "no-session" | "error";

export const LISTENER_FOCUS_SYNC_STORAGE_KEY = "listenerFocusSync";
export const LISTENER_FOCUS_PATH = "/sessions/current/focus";
export const LISTENER_REQUEST_TIMEOUT_MS = 5000;

interface OrganizationLike {
  id?: unknown;
  listener_api_url?: unknown;
  listener_api_key?: unknown;
}

/**
 * organization id → listener config, for organizations that have a listener URL.
 * Reads the org-list payload defensively: the endpoint returns `{organizations}` at runtime
 * (typed as `{results}`), and the two listener fields exist only on kippo ≥ #66.
 */
export function extractListenerConfigs(data: unknown): Record<string, ListenerConfig> {
  const payload = data as {
    organizations?: OrganizationLike[];
    results?: { organizations?: OrganizationLike[] }[];
  };
  const organizations = Array.isArray(payload?.organizations)
    ? payload.organizations
    : Array.isArray(payload?.results)
      ? payload.results.flatMap((r) => r.organizations ?? [])
      : [];
  const configs: Record<string, ListenerConfig> = {};
  for (const organization of organizations) {
    const id = typeof organization.id === "string" ? organization.id : "";
    const url =
      typeof organization.listener_api_url === "string" ? organization.listener_api_url.trim() : "";
    const apiKey =
      typeof organization.listener_api_key === "string" ? organization.listener_api_key : "";
    if (id && url) configs[id] = { url: url.replace(/\/+$/, ""), apiKey };
  }
  return configs;
}

/** Per-browser on/off switch; default on. Only a convenience, so storage failures are ignored. */
export function readFocusSyncEnabled(): boolean {
  try {
    return localStorage.getItem(LISTENER_FOCUS_SYNC_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeFocusSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LISTENER_FOCUS_SYNC_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // ignore: private mode / blocked storage
  }
}

/**
 * Tell the listener which project is on screen. Fire-and-forget semantics: never throws,
 * never blocks navigation. 404 = no open session on the listener (or the project is not in
 * it), which is the normal state outside a meeting.
 */
export async function postListenerFocus(
  config: ListenerConfig,
  projectId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ListenerFocusResult> {
  try {
    const response = await fetchImpl(`${config.url}${LISTENER_FOCUS_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": config.apiKey },
      body: JSON.stringify({ project_id: projectId, source: "ui" }),
      signal: AbortSignal.timeout(LISTENER_REQUEST_TIMEOUT_MS),
    });
    if (response.ok) return "ok";
    if (response.status === 404) return "no-session";
    return "error";
  } catch {
    return "error";
  }
}
