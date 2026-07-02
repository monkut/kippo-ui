import type { CommentData } from "./types";

interface CommentListProps {
  comments: CommentData[];
  onReply: (commentId: number) => void;
  onResolveToggle?: (commentId: number, currentResolved: boolean) => void;
  variant?: "compact" | "detailed";
  depth?: number;
}

export function CommentList({
  comments,
  onReply,
  onResolveToggle,
  variant = "compact",
  depth = 0,
}: CommentListProps) {
  if (variant === "detailed") {
    return (
      <ul className={`space-y-4 ${depth > 0 ? "ml-8 border-l-2 border-gray-100 pl-4" : ""}`}>
        {comments.map((comment) => (
          <li key={comment.id} className={depth === 0 && comment.is_resolved ? "opacity-60" : ""}>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {comment.created_by_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.created_datetime).toLocaleString("ja-JP")}
                  </span>
                  {depth === 0 && comment.is_resolved && (
                    <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                      解決済み
                    </span>
                  )}
                </div>
                <p
                  className={`mt-1 text-sm ${comment.is_resolved ? "text-gray-500 line-through" : "text-gray-700"}`}
                >
                  {comment.comment}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onReply(comment.id)}
                    className="text-xs text-indigo-600 hover:text-indigo-500"
                  >
                    返信
                  </button>
                  {depth === 0 && onResolveToggle && (
                    <button
                      type="button"
                      onClick={() => onResolveToggle(comment.id, comment.is_resolved || false)}
                      className={`text-xs ${
                        comment.is_resolved
                          ? "text-orange-600 hover:text-orange-500"
                          : "text-green-600 hover:text-green-500"
                      }`}
                    >
                      {comment.is_resolved ? "未解決に戻す" : "解決済みにする"}
                    </button>
                  )}
                </div>
              </div>
            </div>
            {comment.replies && comment.replies.length > 0 && (
              <CommentList
                comments={comment.replies}
                onReply={onReply}
                onResolveToggle={onResolveToggle}
                variant="detailed"
                depth={depth + 1}
              />
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className={`space-y-3 ${depth > 0 ? "ml-4 border-l border-gray-100 pl-3" : ""}`}>
      {comments.map((comment) => (
        <li key={comment.id}>
          <div className="text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{comment.created_by_name}</span>
              <span className="text-gray-400">
                {new Date(comment.created_datetime).toLocaleString("ja-JP")}
              </span>
            </div>
            <p className="mt-1 text-gray-700">{comment.comment}</p>
            <button
              type="button"
              onClick={() => onReply(comment.id)}
              className="mt-1 text-indigo-600 hover:text-indigo-500"
            >
              返信
            </button>
          </div>
          {comment.replies && comment.replies.length > 0 && (
            <CommentList comments={comment.replies} onReply={onReply} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}
