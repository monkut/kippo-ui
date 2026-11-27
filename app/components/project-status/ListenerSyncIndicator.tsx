import { useState } from "react";
import type { ListenerSyncState } from "~/hooks/useListenerFocusSync";

export const LISTENER_SYNC_LABELS: Record<ListenerSyncState, string> = {
  off: "リスナー: オフ",
  pending: "リスナー: 送信中",
  synced: "リスナー: 同期中",
  "no-session": "リスナー: セッションなし",
  "not-listed": "リスナー: 対象外",
  error: "リスナー: エラー",
};

export const LISTENER_CLOSE_LABEL = "セッション終了";
export const LISTENER_CLOSE_CONFIRM =
  "リスナーのセッションを終了しますか？\n(要約はせずに終了します。未要約の分はダッシュボードで要約できます)";

const LISTENER_SYNC_DOT_CLASSES: Record<ListenerSyncState, string> = {
  off: "bg-gray-300",
  pending: "bg-gray-400 animate-pulse",
  synced: "bg-green-500",
  "no-session": "bg-yellow-400",
  "not-listed": "bg-yellow-400",
  error: "bg-red-500",
};

// セッション終了 is offered only while the listener has confirmed an open session.
const LISTENER_OPEN_SESSION_STATES: ReadonlySet<ListenerSyncState> = new Set([
  "synced",
  "not-listed",
]);

interface ListenerSyncIndicatorProps {
  state: ListenerSyncState;
  enabled: boolean;
  onToggle: () => void;
  onCloseSession: () => Promise<void>;
}

/**
 * Coloured dot; the colour says whether the listener took the last focus. Hover (or keyboard
 * focus) opens a panel with the status text, the per-browser sync toggle and セッション終了.
 */
export function ListenerSyncIndicator({
  state,
  enabled,
  onToggle,
  onCloseSession,
}: ListenerSyncIndicatorProps) {
  const label = LISTENER_SYNC_LABELS[state];
  return (
    <div className="relative group">
      <span
        role="status"
        aria-label={label}
        tabIndex={0}
        className={`block w-3 h-3 rounded-full ${LISTENER_SYNC_DOT_CLASSES[state]}`}
      />
      {/* pt-2 (not mt-2) keeps the hover area continuous between the dot and the panel */}
      <div className="hidden group-hover:block group-focus-within:block absolute left-1/2 -translate-x-1/2 top-full pt-2 z-20">
        <div className="flex flex-col gap-2 w-max rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg">
          <span className="font-medium">{label}</span>
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={enabled}
            className="rounded px-2 py-1 text-left text-indigo-600 hover:bg-indigo-50"
          >
            {enabled ? "同期を停止" : "同期を再開"}
          </button>
          {LISTENER_OPEN_SESSION_STATES.has(state) && (
            <ListenerCloseButton onCloseSession={onCloseSession} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Disabled while the request is in flight so a double click sends one close. */
function ListenerCloseButton({ onCloseSession }: { onCloseSession: () => Promise<void> }) {
  const [closing, setClosing] = useState(false);
  const handleClose = async () => {
    setClosing(true);
    try {
      await onCloseSession();
    } finally {
      setClosing(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleClose}
      disabled={closing}
      className="rounded bg-red-600 px-2 py-1 text-white hover:bg-red-700 disabled:opacity-50"
    >
      {closing ? "終了中..." : LISTENER_CLOSE_LABEL}
    </button>
  );
}
