import { useState } from "react";
import {
  requirementsBusinessRequirementsCommentsCreate,
  requirementsTechnicalRequirementsCommentsCreate,
} from "~/lib/api/generated/requirements/requirements";

interface CommentInlineFormProps {
  requirementId: number;
  parentCommentId: number | null;
  onCancel: () => void;
  onCreated: () => void;
  variant?: "compact" | "detailed";
  commentType?: "business" | "technical";
}

export function CommentInlineForm({
  requirementId,
  parentCommentId,
  onCancel,
  onCreated,
  variant = "compact",
  commentType = "business",
}: CommentInlineFormProps) {
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setIsSubmitting(true);
    setError("");
    try {
      const createComment =
        commentType === "technical"
          ? requirementsTechnicalRequirementsCommentsCreate
          : requirementsBusinessRequirementsCommentsCreate;
      await createComment(String(requirementId), {
        comment: comment.trim(),
        parent_comment: parentCommentId,
      });
      onCreated();
    } catch (err) {
      console.error("Failed to create comment:", err);
      setError("コメントの作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (variant === "detailed") {
    return (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">
          {parentCommentId ? "返信" : "新規コメント"}
        </h4>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="rounded-md bg-red-50 p-3">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}
          <div>
            <textarea
              id="comment-text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
              placeholder="コメントを入力..."
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              disabled={isSubmitting || !comment.trim()}
            >
              {isSubmitting ? "送信中..." : "送信"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <form onSubmit={handleSubmit} className="space-y-2">
        {error && (
          <div className="rounded-md bg-red-50 p-2">
            <div className="text-xs text-red-800">{error}</div>
          </div>
        )}
        <div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs border px-2 py-1"
            placeholder={parentCommentId ? "返信を入力..." : "コメントを入力..."}
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            disabled={isSubmitting}
          >
            キャンセル
          </button>
          <button
            type="submit"
            className="px-2 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
            disabled={isSubmitting || !comment.trim()}
          >
            {isSubmitting ? "送信中..." : "送信"}
          </button>
        </div>
      </form>
    </div>
  );
}
