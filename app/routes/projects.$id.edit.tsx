import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "~/lib/auth-context";
import { Layout } from "~/components/layout";
import { PHASE_OPTIONS } from "~/components/customers/CustomerProjectModal";
import { organizationsMembersRetrieve } from "~/lib/api/generated/organizations/organizations";
import { projectCategoriesList } from "~/lib/api/generated/project-categories/project-categories";
import {
  projectsForecastRetrieve,
  projectsPartialUpdate,
  projectsRetrieve,
} from "~/lib/api/generated/projects/projects";
import type {
  KippoProjectOrganizationCategory,
  OrganizationMember,
  PatchedKippoProjectRequest,
  PhaseEnum,
} from "~/lib/api/generated/models";

// In-SPA KippoProject record edit (kippo#42 — replaces linking out to the Django admin). Covers the
// project's own fields grouped per KIPPO_PROJECT_FIELDS.md / kippo#41; organization + customer are
// shown read-only, and the contract / assignment inlines remain separate features (future work).
export function meta() {
  return [{ title: "プロジェクト編集 - Kippo" }];
}

export default function ProjectEdit() {
  const { id = "" } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const [organizationId, setOrganizationId] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [categories, setCategories] = useState<KippoProjectOrganizationCategory[]>([]);

  // Editable fields
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<PhaseEnum>("proposing-low");
  const [category, setCategory] = useState("");
  const [projectManagerId, setProjectManagerId] = useState("");
  const [problemDefinition, setProblemDefinition] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [allocatedStaffDays, setAllocatedStaffDays] = useState("");
  const [documentFolderUrl, setDocumentFolderUrl] = useState("");
  const [docbaseTag, setDocbaseTag] = useState("");
  const [slackChannelName, setSlackChannelName] = useState("");
  const [slackNotificationChannelName, setSlackNotificationChannelName] = useState("");
  const [githubProjectHtmlUrl, setGithubProjectHtmlUrl] = useState("");
  // is_closed is read-only here: per KIPPO_PROJECT_FIELDS.md it (and display_in_project_report) are
  // managed by the admin "Close Project" action, not edited directly (that would skip actual_date /
  // closed_datetime / status-comment side effects).
  const [isClosed, setIsClosed] = useState(false);
  // 完了予測日 — read-only forecast from GET /projects/:id/forecast/ (null when no future
  // assignments to project from). Mirrors the admin's estimated_completion_date display.
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || !id) return;
    setIsLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const response = await projectsRetrieve(id);
        if (cancelled) return;
        const p = response.data;
        setOrganizationId(p.organization);
        setOrganizationName(p.organization_name);
        setCustomerName(p.customer_name);
        setName(p.name ?? "");
        if (p.phase) setPhase(p.phase);
        setCategory(p.category ?? "");
        setProjectManagerId(p.project_manager ?? "");
        setProblemDefinition(p.problem_definition ?? "");
        setStartDate(p.start_date ?? "");
        setTargetDate(p.target_date ?? "");
        setAllocatedStaffDays(p.allocated_staff_days == null ? "" : String(p.allocated_staff_days));
        setDocumentFolderUrl(p.document_folder_url ?? "");
        setDocbaseTag(p.docbase_tag ?? "");
        setSlackChannelName(p.slack_channel_name ?? "");
        setSlackNotificationChannelName(p.slack_notification_channel_name ?? "");
        setGithubProjectHtmlUrl(p.github_project_html_url ?? "");
        setIsClosed(p.is_closed ?? false);
        // Best-effort forecast; a failure (or no future assignments) just leaves it blank.
        try {
          const forecast = await projectsForecastRetrieve(id);
          if (!cancelled)
            setEstimatedCompletionDate(forecast.data?.estimated_completion_date ?? null);
        } catch {
          if (!cancelled) setEstimatedCompletionDate(null);
        }
      } catch {
        if (!cancelled) setError("プロジェクトの読み込みに失敗しました");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    (async () => {
      try {
        const [memberRes, categoryRes] = await Promise.all([
          organizationsMembersRetrieve(organizationId),
          projectCategoriesList({ organization: organizationId }),
        ]);
        if (cancelled) return;
        setMembers(memberRes.status === 200 ? (memberRes.data.members ?? []) : []);
        // Only global categories are writable (serializer category queryset is organization__isnull);
        // org-specific keys would 400 on save, so don't offer them in the picker.
        setCategories((categoryRes.data?.results ?? []).filter((c) => c.organization == null));
      } catch {
        // pickers just stay empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError("");
    const allocated = allocatedStaffDays.trim();
    // Send category only when it's a writable (global) key; otherwise omit so an org-specific
    // prefilled category (or a blank) is left unchanged rather than 400-ing. (undefined → omitted)
    const writableCategory = categories.some((c) => c.key === category) ? category : undefined;
    const patch: PatchedKippoProjectRequest = {
      name: name.trim(),
      phase,
      category: writableCategory,
      project_manager: projectManagerId || null,
      problem_definition: problemDefinition,
      start_date: startDate || null,
      target_date: targetDate || null,
      allocated_staff_days: allocated === "" ? null : Number.parseInt(allocated, 10),
      document_folder_url: documentFolderUrl.trim(),
      docbase_tag: docbaseTag.trim(),
      slack_channel_name: slackChannelName.trim(),
      slack_notification_channel_name: slackNotificationChannelName.trim(),
      github_project_html_url: githubProjectHtmlUrl.trim(),
    };
    try {
      await projectsPartialUpdate(id, patch);
      navigate(-1);
    } catch {
      setError("プロジェクトの更新に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }, [
    id,
    name,
    phase,
    category,
    categories,
    projectManagerId,
    problemDefinition,
    startDate,
    targetDate,
    allocatedStaffDays,
    documentFolderUrl,
    docbaseTag,
    slackChannelName,
    slackNotificationChannelName,
    githubProjectHtmlUrl,
    navigate,
  ]);

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">読み込み中...</div>
        </div>
      </Layout>
    );
  }
  if (!user) return null;

  const saveDisabled = isSaving || name.trim().length === 0;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">プロジェクト編集</h1>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            ← 戻る
          </button>
        </div>

        {error && <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>}

        <div className="text-sm text-gray-600">
          <span className="font-medium">組織:</span> {organizationName}
          {customerName && (
            <>
              <span className="mx-2 text-gray-300">/</span>
              <span className="font-medium">顧客:</span> {customerName}
            </>
          )}
        </div>

        <Section title="基本">
          <Input
            id="p-name"
            label="プロジェクト名"
            value={name}
            onChange={setName}
            maxLength={256}
          />
          <Select
            id="p-phase"
            label="ステータス"
            value={phase}
            onChange={(v) => setPhase(v as PhaseEnum)}
          >
            {PHASE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select id="p-category" label="カテゴリ" value={category} onChange={setCategory}>
            <option value="">選択してください</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select id="p-pm" label="担当PM" value={projectManagerId} onChange={setProjectManagerId}>
            <option value="">選択してください</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name || m.username}
              </option>
            ))}
          </Select>
          <TextArea
            id="p-problem"
            label="課題定義"
            value={problemDefinition}
            onChange={setProblemDefinition}
          />
        </Section>

        <Section title="日程・見積">
          <Input
            id="p-start"
            label="開始日"
            type="date"
            value={startDate}
            onChange={setStartDate}
          />
          <Input
            id="p-target"
            label="完了予定日"
            type="date"
            value={targetDate}
            onChange={setTargetDate}
          />
          <Input
            id="p-allocated"
            label="必要工数(人日)"
            type="number"
            step={1}
            value={allocatedStaffDays}
            onChange={setAllocatedStaffDays}
          />
          {/* Read-only forecast (admin's estimated_completion_date); blank when not forecastable. */}
          <div className="text-sm text-gray-600">
            <span className="font-medium">完了予測日:</span>{" "}
            {estimatedCompletionDate
              ? new Date(estimatedCompletionDate).toLocaleDateString("ja-JP")
              : "—"}
          </div>
        </Section>

        <Section title="詳細">
          <Input
            id="p-document-folder"
            label="ドキュメントフォルダURL"
            type="url"
            value={documentFolderUrl}
            onChange={setDocumentFolderUrl}
          />
          {/* 状態(クローズ) is read-only — closing is the admin "Close Project" action (KIPPO_PROJECT_FIELDS.md). */}
          <div className="text-sm text-gray-600">
            <span className="font-medium">状態:</span> {isClosed ? "クローズ済み" : "進行中"}
          </div>
        </Section>

        <CollapsibleSection title="その他">
          <Input
            id="p-slack"
            label="Slackチャンネル名"
            value={slackChannelName}
            onChange={setSlackChannelName}
          />
          <Input
            id="p-slack-notify"
            label="Slack通知チャンネル名"
            value={slackNotificationChannelName}
            onChange={setSlackNotificationChannelName}
          />
          <Input
            id="p-github"
            label="GitHubプロジェクトURL"
            type="url"
            value={githubProjectHtmlUrl}
            onChange={setGithubProjectHtmlUrl}
          />
          <Input id="p-docbase" label="DocBaseタグ" value={docbaseTag} onChange={setDocbaseTag} />
        </CollapsibleSection>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveDisabled}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </Layout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-medium text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

// Collapsible section (native <details>) — starts collapsed (no `open` attr) so secondary
// "その他" config is tucked away after creation (kippo#42 / KIPPO_PROJECT_FIELDS.md).
function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="bg-white shadow rounded-lg p-6">
      <summary className="flex cursor-pointer select-none items-center gap-2 text-lg font-medium text-gray-900">
        <span className="text-gray-400">▸</span>
        {title}
      </summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}

function Input({
  id,
  label,
  value,
  onChange,
  type = "text",
  maxLength,
  step,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "date" | "url" | "number";
  maxLength?: number;
  step?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        min={type === "number" ? 0 : undefined}
        step={step}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {children}
      </select>
    </div>
  );
}

function TextArea({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}
