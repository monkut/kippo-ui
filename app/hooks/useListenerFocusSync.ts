import { useEffect, useState } from "react";
import { type ListenerConfig, postListenerFocus } from "~/lib/listener";

export type ListenerSyncState = "off" | "pending" | "synced" | "no-session" | "error";

export const LISTENER_FOCUS_DEBOUNCE_MS = 300;

/**
 * Report the displayed project to the listener whenever it changes (debounced so a fast
 * arrow-key run posts only the slide the facilitator lands on). "off" when there is no
 * listener for the project's organization or the facilitator switched sync off.
 */
export function useListenerFocusSync(
  config: ListenerConfig | null,
  projectId: string | null,
  enabled: boolean,
): ListenerSyncState {
  const [state, setState] = useState<ListenerSyncState>("off");
  const url = config?.url ?? "";
  const apiKey = config?.apiKey ?? "";

  useEffect(() => {
    if (!enabled || !url || !projectId) {
      setState("off");
      return;
    }
    setState("pending");
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await postListenerFocus({ url, apiKey }, projectId);
      if (cancelled) return;
      setState(result === "ok" ? "synced" : result);
    }, LISTENER_FOCUS_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, url, apiKey, projectId]);

  return state;
}
