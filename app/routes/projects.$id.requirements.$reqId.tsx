import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router";
import { useAuthGate } from "~/hooks/useAuthGate";
import { Layout } from "~/components/layout";
import { ChevronIcon } from "~/components/icons";
import { CommentInlineForm } from "~/components/project-detail/CommentInlineForm";
import { CommentList } from "~/components/project-detail/CommentList";
import { TechnicalRequirementInlineForm } from "~/components/project-detail/forms/TechnicalRequirementForms";
import type { CommentData } from "~/components/project-detail/types";
import { projectsRetrieve } from "~/lib/api/generated/projects/projects";
import {
  requirementsBusinessRequirementsRetrieve,
  requirementsTechnicalRequirementCategoriesList,
  requirementsBusinessRequirementsCommentsPartialUpdate,
} from "~/lib/api/generated/requirements/requirements";
import { readList } from "~/lib/api/read-list";
import type {
  KippoProject,
  ProjectBusinessRequirementDetail,
  ProjectTechnicalRequirementCategory,
  ProjectTechnicalRequirement,
} from "~/lib/api/generated/models";

export function meta() {
  return [{ title: "ビジネス要件詳細 - Kippo要件管理" }];
}

export default function BusinessRequirementDetails() {
  const { id: projectId, reqId } = useParams();
  const { user, authLoading } = useAuthGate();
  const [project, setProject] = useState<KippoProject | null>(null);
  const [requirement, setRequirement] = useState<ProjectBusinessRequirementDetail | null>(null);
  const [techCategories, setTechCategories] = useState<ProjectTechnicalRequirementCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [showTechReqForm, setShowTechReqForm] = useState(false);
  const [techReqsCompact, setTechReqsCompact] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [replyToComment, setReplyToComment] = useState<number | null>(null);
  const [commentsExpanded, setCommentsExpanded] = useState(true);

  const requirementId = reqId ? Number.parseInt(reqId, 10) : 0;

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await projectsRetrieve(projectId);
      if (response.data) {
        setProject(response.data);
      }
    } catch (err) {
      console.error("Failed to load project:", err);
    }
  }, [projectId]);

  const loadRequirement = useCallback(async () => {
    if (!requirementId) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await requirementsBusinessRequirementsRetrieve(requirementId);
      if (response.data) {
        setRequirement(response.data);
      }
    } catch (err) {
      console.error("Failed to load requirement:", err);
      setError("ビジネス要件の読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [requirementId]);

  const loadCategories = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await requirementsTechnicalRequirementCategoriesList({ project: projectId });
      setTechCategories(readList<ProjectTechnicalRequirementCategory>(response.data));
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }, [projectId]);

  useEffect(() => {
    if (user && requirementId) {
      loadProject();
      loadRequirement();
      loadCategories();
    }
  }, [user, requirementId, loadProject, loadRequirement, loadCategories]);

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <Layout>
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      </Layout>
    );
  }

  if (!requirement) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">ビジネス要件が見つかりません</p>
          <Link
            to={`/projects/${projectId}`}
            className="mt-4 text-indigo-600 hover:text-indigo-500"
          >
            プロジェクトに戻る
          </Link>
        </div>
      </Layout>
    );
  }

  const totalEstimate = requirement.total_estimate as {
    total_days?: number;
    weighted_days?: number;
  };
  const technicalRequirements = requirement.technical_requirements || [];
  const comments = (requirement.comments || []) as unknown as CommentData[];

  return (
    <Layout projectName={project?.name} projectId={projectId}>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
              {requirement.display_id}
            </span>
            <h1 className="text-2xl font-bold text-gray-900">{requirement.title}</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            課題: {requirement.problems_data?.map((p) => p.title).join(", ") || "-"} | カテゴリ:{" "}
            {requirement.category_name}
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          {requirement.details && (
            <div className="mb-4">
              <h2 className="text-sm font-medium text-gray-500 mb-2">詳細</h2>
              <p className="text-gray-900 whitespace-pre-wrap">{requirement.details}</p>
            </div>
          )}
          <div className={requirement.details ? "border-t border-gray-200 pt-4" : ""}>
            <div className="flex justify-between items-center mb-2">
              <button
                type="button"
                onClick={() => setCommentsExpanded(!commentsExpanded)}
                className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                <ChevronIcon isExpanded={commentsExpanded} className="w-4 h-4" />
                <span>コメント</span>
                {!commentsExpanded && (
                  <span className="ml-1 text-xs font-normal">({comments.length}件)</span>
                )}
              </button>
              {!showCommentForm && replyToComment === null && commentsExpanded && (
                <button
                  type="button"
                  onClick={() => {
                    setReplyToComment(null);
                    setShowCommentForm(true);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-500"
                >
                  追加
                </button>
              )}
            </div>
            {commentsExpanded && (
              <>
                {comments.length === 0 && !showCommentForm ? (
                  <p className="text-xs text-gray-500">コメントがありません</p>
                ) : (
                  <CommentList
                    comments={comments}
                    variant="detailed"
                    onReply={(commentId) => {
                      setReplyToComment(commentId);
                      setShowCommentForm(true);
                    }}
                    onResolveToggle={async (commentId, currentResolved) => {
                      try {
                        await requirementsBusinessRequirementsCommentsPartialUpdate(
                          String(requirementId),
                          commentId,
                          {
                            is_resolved: !currentResolved,
                          },
                        );
                        loadRequirement();
                      } catch (err) {
                        console.error("Failed to update comment:", err);
                      }
                    }}
                  />
                )}
                {showCommentForm && (
                  <CommentInlineForm
                    requirementId={requirementId}
                    parentCommentId={replyToComment}
                    variant="detailed"
                    onCancel={() => {
                      setShowCommentForm(false);
                      setReplyToComment(null);
                    }}
                    onCreated={() => {
                      setShowCommentForm(false);
                      setReplyToComment(null);
                      loadRequirement();
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-500">合計見積日数</p>
              <p className="text-2xl font-bold text-blue-600">
                {totalEstimate?.total_days || 0} 日
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-500">重み付け見積</p>
              <p className="text-2xl font-bold text-green-600">
                {totalEstimate?.weighted_days?.toFixed(1) || 0} 日
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">技術要件</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTechReqsCompact(!techReqsCompact)}
                className={`px-2 py-1 text-xs font-medium rounded-md ${
                  techReqsCompact
                    ? "bg-gray-200 text-gray-700"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                コンパクト
              </button>
              {!showTechReqForm && (
                <button
                  type="button"
                  onClick={() => setShowTechReqForm(true)}
                  className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100"
                >
                  追加
                </button>
              )}
            </div>
          </div>
          <div className="p-6">
            {technicalRequirements.length === 0 && !showTechReqForm ? (
              <p className="text-gray-500 text-center py-4">技術要件がありません</p>
            ) : techReqsCompact ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1 justify-items-start">
                {technicalRequirements.map((tech: ProjectTechnicalRequirement) => (
                  <div key={tech.id} className="flex items-center gap-2 py-1">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                      {tech.display_id}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded">
                      {tech.category_name}
                    </span>
                    <span className="text-sm text-gray-900 truncate">{tech.title}</span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {tech.estimate?.days || 0}日
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {technicalRequirements.map((tech: ProjectTechnicalRequirement) => (
                  <li key={tech.id} className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                          {tech.display_id}
                        </span>
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
                          {tech.category_name}
                        </span>
                        <span className="text-sm text-gray-900">{tech.title}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {tech.estimate?.days || 0} 日
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          (信頼度: {tech.estimate?.confidence || 0}%)
                        </span>
                      </div>
                    </div>
                    {tech.details && (
                      <p className="mt-2 text-sm text-gray-500 ml-16">{tech.details}</p>
                    )}
                    {tech.github_issues && tech.github_issues.length > 0 && (
                      <div className="mt-2 ml-16 flex flex-wrap gap-2">
                        {tech.github_issues.map((issue) => (
                          <a
                            key={issue.id}
                            href={issue.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                          >
                            GitHub Issue
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {showTechReqForm && projectId && (
              <TechnicalRequirementInlineForm
                projectId={projectId}
                businessRequirementId={requirementId}
                categories={techCategories}
                onCancel={() => setShowTechReqForm(false)}
                onCreated={() => {
                  setShowTechReqForm(false);
                  loadRequirement();
                  loadCategories();
                }}
              />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
