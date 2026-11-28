import { CommentIcon } from "~/components/icons";
import type { RequirementComments } from "~/hooks/useRequirementComments";
import { CommentInlineForm } from "./CommentInlineForm";
import { CommentList } from "./CommentList";

type CommentType = "business" | "technical";

// Class literals are kept whole so Tailwind's source scanner emits them.
const PANEL_CLASSES: Record<CommentType, string> = {
  business: "mt-3 ml-4 pl-4 border-l-2 border-gray-200",
  technical: "mt-3 ml-4 pl-4 border-l-2 border-gray-100",
};

/** コメント icon button of a requirement row; stays visible while that row's panel is open. */
export function CommentToggleButton({
  requirementId,
  comments,
}: {
  requirementId: number;
  comments: RequirementComments;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        comments.toggle(requirementId);
      }}
      className={`p-1 transition-opacity ${
        comments.expandedId === requirementId
          ? "text-indigo-600"
          : "text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100"
      }`}
      title="コメント"
    >
      <CommentIcon />
    </button>
  );
}

/** The comment thread + inline form under a requirement row; renders only for the open row. */
export function RequirementCommentsPanel({
  requirementId,
  comments,
  commentType,
}: {
  requirementId: number;
  comments: RequirementComments;
  commentType: CommentType;
}) {
  if (comments.expandedId !== requirementId) return null;
  return (
    <div className={PANEL_CLASSES[commentType]}>
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium text-gray-700">コメント</h4>
        {!comments.showForm && (
          <button
            type="button"
            onClick={() => comments.openForm(null)}
            className="text-xs text-indigo-600 hover:text-indigo-500"
          >
            追加
          </button>
        )}
      </div>
      {comments.comments.length === 0 && !comments.showForm ? (
        <p className="text-xs text-gray-500">コメントがありません</p>
      ) : (
        <CommentList comments={comments.comments} onReply={comments.openForm} />
      )}
      {comments.showForm && (
        <CommentInlineForm
          requirementId={requirementId}
          parentCommentId={comments.replyTo}
          commentType={commentType}
          onCancel={comments.closeForm}
          onCreated={() => {
            comments.closeForm();
            comments.reload(requirementId);
          }}
        />
      )}
    </div>
  );
}
