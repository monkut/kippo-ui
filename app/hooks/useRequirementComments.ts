import { useCallback, useRef, useState } from "react";
import type { CommentData } from "~/components/project-detail/types";

type RetrieveRequirement = (id: number) => Promise<{ data?: { comments?: unknown } | null }>;

export type RequirementComments = {
  /** The requirement whose comment panel is open, or null. */
  expandedId: number | null;
  comments: CommentData[];
  showForm: boolean;
  /** The comment being replied to; null for a new top-level comment. */
  replyTo: number | null;
  /** Open the panel for `requirementId` (loading its comments), or close it if already open. */
  toggle: (requirementId: number) => Promise<void>;
  reload: (requirementId: number) => Promise<void>;
  openForm: (replyTo: number | null) => void;
  closeForm: () => void;
};

/** State for one "comments under a requirement row" panel: one panel open at a time, with an
 * inline form for a new comment or a reply. `retrieve` is the requirement detail endpoint whose
 * payload carries `comments`. */
export function useRequirementComments(retrieve: RetrieveRequirement): RequirementComments {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const retrieveRef = useRef(retrieve);
  retrieveRef.current = retrieve;

  const reload = useCallback(async (requirementId: number) => {
    try {
      const response = await retrieveRef.current(requirementId);
      setComments((response.data?.comments as CommentData[] | undefined) ?? []);
    } catch (err) {
      console.error("Failed to load comments:", err);
      setComments([]);
    }
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setReplyTo(null);
  }, []);

  const openForm = useCallback((target: number | null) => {
    setReplyTo(target);
    setShowForm(true);
  }, []);

  const toggle = async (requirementId: number) => {
    closeForm();
    if (expandedId === requirementId) {
      setExpandedId(null);
      setComments([]);
      return;
    }
    setExpandedId(requirementId);
    await reload(requirementId);
  };

  return { expandedId, comments, showForm, replyTo, toggle, reload, openForm, closeForm };
}
