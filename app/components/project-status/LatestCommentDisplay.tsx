import { formatDisplayDate } from "~/lib/dates";

interface LatestCommentDisplayProps {
  comment: {
    comment: string;
    created_by_display_name: string | null;
    created_by_username: string | null;
    created_datetime: string;
  } | null;
}

export function LatestCommentDisplay({ comment }: LatestCommentDisplayProps) {
  if (!comment) {
    return <div className="text-gray-400">-</div>;
  }

  return (
    <div className="bg-gray-50 rounded-md p-4 text-left">
      <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
        <span className="font-medium text-gray-700">
          {comment.created_by_display_name || comment.created_by_username || "不明"}
        </span>
        <span>•</span>
        <span>{formatDisplayDate(comment.created_datetime)}</span>
      </div>
      <div className="text-gray-700 whitespace-pre-wrap">{comment.comment}</div>
    </div>
  );
}
