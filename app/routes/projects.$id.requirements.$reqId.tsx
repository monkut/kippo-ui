import { useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { useAuth } from "~/lib/auth-context";
import { Layout } from "~/components/layout";
import {
  requirementsBusinessRequirementsRetrieve,
  projectsRetrieve,
  requirementsTechnicalRequirementsCreate,
  requirementsTechnicalRequirementCategoriesList,
  requirementsTechnicalRequirementCategoriesCreate,
  requirementsBusinessRequirementCommentsCreate,
  requirementsBusinessRequirementCommentsPartialUpdate,
  requirementsEstimatesCreate,
} from "~/lib/api/generated";
import type {
  KippoProject,
  ProjectBusinessRequirementDetail,
  ProjectTechnicalRequirementCategory,
  ProjectTechnicalRequirement,
} from "~/lib/api/generated";

export function meta() {
  return [{ title: "ビジネス要件詳細 - Kippo要件管理" }];
}

function ChevronIcon({
  isExpanded,
  className = "w-4 h-4",
}: {
  isExpanded: boolean;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={`${className} transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

export default function BusinessRequirementDetails() {
  const { id: projectId, reqId } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

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
      if (response.data?.results) {
        setTechCategories(response.data.results);
      }
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
                <ChevronIcon isExpanded={commentsExpanded} />
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
                    onReply={(commentId) => {
                      setReplyToComment(commentId);
                      setShowCommentForm(true);
                    }}
                    onResolveToggle={async (commentId, currentResolved) => {
                      try {
                        await requirementsBusinessRequirementCommentsPartialUpdate(commentId, {
                          is_resolved: !currentResolved,
                        });
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

interface CommentData {
  id: number;
  comment: string;
  created_by_name: string;
  created_datetime: string;
  is_resolved?: boolean;
  replies?: CommentData[];
}

interface CommentListProps {
  comments: CommentData[];
  onReply: (commentId: number) => void;
  onResolveToggle?: (commentId: number, currentResolved: boolean) => void;
  depth?: number;
}

function CommentList({ comments, onReply, onResolveToggle, depth = 0 }: CommentListProps) {
  return (
    <ul className={`space-y-4 ${depth > 0 ? "ml-8 border-l-2 border-gray-100 pl-4" : ""}`}>
      {comments.map((comment) => (
        <li key={comment.id} className={depth === 0 && comment.is_resolved ? "opacity-60" : ""}>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{comment.created_by_name}</span>
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
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

interface TechnicalRequirementInlineFormProps {
  projectId: string;
  businessRequirementId: number;
  categories: ProjectTechnicalRequirementCategory[];
  onCancel: () => void;
  onCreated: () => void;
}

type TechnicalRequirementEntry = {
  id: number;
  title: string;
  details: string;
  categoryId: number | "new";
  newCategoryName: string;
  estimateDays: string;
  confidence: string;
};

function TechnicalRequirementInlineForm({
  projectId,
  businessRequirementId,
  categories,
  onCancel,
  onCreated,
}: TechnicalRequirementInlineFormProps) {
  const defaultCategoryId = categories.length > 0 ? categories[0].id : "new";
  const [entries, setEntries] = useState<TechnicalRequirementEntry[]>([
    {
      id: 1,
      title: "",
      details: "",
      categoryId: defaultCategoryId,
      newCategoryName: "",
      estimateDays: "",
      confidence: "80",
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addEntry = () => {
    setEntries([
      ...entries,
      {
        id: Date.now(),
        title: "",
        details: "",
        categoryId: defaultCategoryId,
        newCategoryName: "",
        estimateDays: "",
        confidence: "80",
      },
    ]);
  };

  const removeEntry = (id: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((e) => e.id !== id));
    }
  };

  const updateEntry = (
    id: number,
    field: keyof TechnicalRequirementEntry,
    value: string | number | "new",
  ) => {
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const hasValidEntry = entries.some((e) => e.title.trim() && e.estimateDays);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validEntries = entries.filter((entry) => entry.title.trim() && entry.estimateDays);
    if (validEntries.length === 0) return;

    setIsSubmitting(true);
    setError("");
    try {
      const categoryCache: Record<string, number> = {};

      for (const entry of validEntries) {
        let finalCategoryId = entry.categoryId;
        if (entry.categoryId === "new") {
          if (!entry.newCategoryName.trim()) {
            setError("カテゴリ名を入力してください");
            setIsSubmitting(false);
            return;
          }
          if (categoryCache[entry.newCategoryName.trim()]) {
            finalCategoryId = categoryCache[entry.newCategoryName.trim()];
          } else {
            const catResponse = await requirementsTechnicalRequirementCategoriesCreate({
              project: projectId,
              name: entry.newCategoryName.trim(),
            });
            if (catResponse.data) {
              finalCategoryId = catResponse.data.id;
              categoryCache[entry.newCategoryName.trim()] = catResponse.data.id;
            }
          }
        }

        const techReqResponse = await requirementsTechnicalRequirementsCreate({
          project: projectId,
          business_requirements: [businessRequirementId],
          title: entry.title.trim(),
          details: entry.details.trim() || undefined,
          category: finalCategoryId as number,
        });

        if (techReqResponse.data) {
          await requirementsEstimatesCreate({
            requirement: techReqResponse.data.id,
            days: Number.parseFloat(entry.estimateDays),
            confidence: Number.parseInt(entry.confidence, 10) / 100,
          });
        }
      }

      onCreated();
    } catch (err) {
      console.error("Failed to create technical requirement:", err);
      setError("技術要件の作成に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-sm font-medium text-gray-900 mb-3">新規技術要件</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="rounded-md bg-red-50 p-3">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}
        {entries.map((entry, index) => (
          <div
            key={entry.id}
            className="grid grid-cols-1 md:grid-cols-[1fr_8rem_5rem_5rem_1fr_auto] gap-3 items-start"
          >
            <div>
              <label
                htmlFor={`tech-req-title-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                タイトル
              </label>
              <input
                type="text"
                id={`tech-req-title-${entry.id}`}
                value={entry.title}
                onChange={(e) => updateEntry(entry.id, "title", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                placeholder="技術要件のタイトル"
                disabled={isSubmitting}
                autoFocus={index === 0}
              />
            </div>
            <div>
              <label
                htmlFor={`tech-req-category-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                カテゴリ
              </label>
              {entry.categoryId === "new" ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    id={`tech-req-category-${entry.id}`}
                    value={entry.newCategoryName}
                    onChange={(e) => updateEntry(entry.id, "newCategoryName", e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                    placeholder="新規カテゴリ名"
                    disabled={isSubmitting}
                  />
                  {categories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        updateEntry(entry.id, "categoryId", categories[0].id);
                        updateEntry(entry.id, "newCategoryName", "");
                      }}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                      title="既存カテゴリから選択"
                    >
                      取消
                    </button>
                  )}
                </div>
              ) : (
                <select
                  id={`tech-req-category-${entry.id}`}
                  value={entry.categoryId}
                  onChange={(e) =>
                    updateEntry(
                      entry.id,
                      "categoryId",
                      e.target.value === "new" ? "new" : Number.parseInt(e.target.value, 10),
                    )
                  }
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                  disabled={isSubmitting}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                  <option value="new">+ 新規カテゴリ</option>
                </select>
              )}
            </div>
            <div>
              <label
                htmlFor={`tech-req-estimate-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                日数
              </label>
              <input
                type="number"
                id={`tech-req-estimate-${entry.id}`}
                value={entry.estimateDays}
                onChange={(e) => updateEntry(entry.id, "estimateDays", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                placeholder="日数"
                min="0.5"
                step="0.5"
                disabled={isSubmitting}
              />
              <div className="flex gap-1 mt-1">
                {[1, 3, 5].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => updateEntry(entry.id, "estimateDays", String(days))}
                    className={`px-1.5 py-0.5 text-xs font-medium rounded border ${
                      entry.estimateDays === String(days)
                        ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                        : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                    disabled={isSubmitting}
                  >
                    {days}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                htmlFor={`tech-req-confidence-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                信頼度%
              </label>
              <input
                type="number"
                id={`tech-req-confidence-${entry.id}`}
                value={entry.confidence}
                onChange={(e) => updateEntry(entry.id, "confidence", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                placeholder="%"
                min="10"
                max="100"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label
                htmlFor={`tech-req-details-${entry.id}`}
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                詳細（任意）
              </label>
              <textarea
                id={`tech-req-details-${entry.id}`}
                value={entry.details}
                onChange={(e) => updateEntry(entry.id, "details", e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 resize-y"
                placeholder="詳細"
                disabled={isSubmitting}
                rows={2}
              />
            </div>
            {entries.length > 1 && (
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md mt-6"
                title="削除"
                disabled={isSubmitting}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
          disabled={isSubmitting}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          追加
        </button>
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
            disabled={isSubmitting || !hasValidEntry}
          >
            {isSubmitting
              ? "作成中..."
              : `作成${entries.filter((e) => e.title.trim() && e.estimateDays).length > 1 ? ` (${entries.filter((e) => e.title.trim() && e.estimateDays).length}件)` : ""}`}
          </button>
        </div>
      </form>
    </div>
  );
}

interface CommentInlineFormProps {
  requirementId: number;
  parentCommentId: number | null;
  onCancel: () => void;
  onCreated: () => void;
}

function CommentInlineForm({
  requirementId,
  parentCommentId,
  onCancel,
  onCreated,
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
      await requirementsBusinessRequirementCommentsCreate({
        requirement: requirementId,
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
