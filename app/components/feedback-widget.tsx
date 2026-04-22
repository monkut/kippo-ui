import { useState } from "react";
import { customFetch } from "~/lib/api/custom-fetch";

const MAX_TITLE_LENGTH = 200;

interface FeedbackCreateRequest {
  category: "general";
  title: string;
  comment: string;
}

interface FeedbackCreateResponse {
  status: number;
  data: unknown;
  headers: Headers;
}

function deriveTitle(comment: string): string {
  const firstLine = comment.split(/\r?\n/, 1)[0].trim();
  return firstLine.slice(0, MAX_TITLE_LENGTH) || "フィードバック";
}

async function submitFeedback(payload: FeedbackCreateRequest): Promise<FeedbackCreateResponse> {
  return customFetch<FeedbackCreateResponse>("/api/feedback/feedback/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setIsOpen(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = comment.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await submitFeedback({
        category: "general",
        title: deriveTitle(trimmed),
        comment: trimmed,
      });
      if (response.status !== 201) {
        throw new Error(`送信に失敗しました (${response.status})`);
      }
      setComment("");
      setJustSent(true);
      setIsOpen(false);
      setTimeout(() => setJustSent(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-80 rounded-lg bg-white shadow-xl ring-1 ring-gray-200">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">フィードバック</h2>
            <button
              type="button"
              onClick={handleClose}
              className="rounded text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="閉じる"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <title>閉じる</title>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-4 py-3">
            <label htmlFor="feedback-comment" className="sr-only">
              コメント
            </label>
            <textarea
              id="feedback-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              autoFocus
              required
              placeholder="ご意見・ご要望をお聞かせください"
              className="block w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !comment.trim()}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {isSubmitting ? "送信中..." : "送信"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      aria-label="フィードバックを送る"
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.8"
        stroke="currentColor"
      >
        <title>フィードバック</title>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
        />
      </svg>
      {justSent && (
        <span className="absolute -top-9 right-0 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white shadow">
          送信しました
        </span>
      )}
    </button>
  );
}
