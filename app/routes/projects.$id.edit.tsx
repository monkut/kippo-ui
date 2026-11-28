import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Layout } from "~/components/layout";
import { PageLoading } from "~/components/page-state";
import { ContractSection } from "~/components/project-form/ContractSection";
import { LEAD_SOURCE_OPTIONS, PHASE_OPTIONS } from "~/components/project-form/fields";
import {
  Checkbox,
  CollapsibleSection,
  Input,
  Section,
  Select,
  TextArea,
} from "~/components/project-form/PageFields";
import { ParentProjectField } from "~/components/project-form/ParentProjectField";
import { PhaseConfidenceHistory } from "~/components/project-form/PhaseConfidenceHistory";
import {
  buildProjectPatch,
  EMPTY_PROJECT_EDIT_FORM,
  type ProjectEditForm,
  projectEditFormFromProject,
} from "~/components/project-form/project-edit-form";
import { useOrgMembers, useProjectCategories } from "~/components/project-form/useProjectFormData";
import { useAuthGate } from "~/hooks/useAuthGate";
import { useProjectContract } from "~/hooks/useProjectContract";
import { apiErrorMessage, throwOnError } from "~/lib/api/api-error";
import type {
  KippoProject,
  KippoProjectContract,
  KippoProjectPhaseConfidenceChange,
  PhaseEnum,
} from "~/lib/api/generated/models";
import {
  projectsForecastRetrieve,
  projectsPartialUpdate,
  projectsRetrieve,
} from "~/lib/api/generated/projects/projects";

// In-SPA KippoProject record edit (kippo#42 — replaces linking out to the Django admin). Covers the
// project's own fields grouped per KIPPO_PROJECT_FIELDS.md / kippo#41; organization + customer are
// shown read-only, and the assignment inlines remain separate features (future work).
export function meta() {
  return [{ title: "プロジェクト編集 - Kippo" }];
}

const NO_PHASE_CONFIDENCE_CHANGES: readonly KippoProjectPhaseConfidenceChange[] = [];

export default function ProjectEdit() {
  const { id = "" } = useParams();
  const { user, authLoading } = useAuthGate();
  const navigate = useNavigate();
  const signedIn = !!user;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // The loaded record: source of the read-only values (organization, customer, closed state,
  // MTG links). is_closed is read-only here: per KIPPO_PROJECT_FIELDS.md it (and
  // display_in_project_report) are managed by the admin "Close Project" action, not edited
  // directly (that would skip actual_date / closed_datetime / status-comment side effects).
  const [project, setProject] = useState<KippoProject | null>(null);
  const [form, setForm] = useState<ProjectEditForm>(EMPTY_PROJECT_EDIT_FORM);
  const setField = useCallback(
    <K extends keyof ProjectEditForm>(key: K, value: ProjectEditForm[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );
  // Once a contract exists its period is the single source of the project dates (synced server-side);
  // the backend rejects a changed start_date/target_date. billing_types is contract-derived, so a
  // non-empty list is an early proxy for "has a contract" before the contract record itself loads.
  const [billingTypesPresent, setBillingTypesPresent] = useState(false);
  // 完了予測日 — read-only forecast from GET /projects/:id/forecast/ (null when no future
  // assignments to project from). Mirrors the admin's estimated_completion_date display.
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState<string | null>(null);

  const organizationId = project?.organization ?? "";
  const customerId = project?.customer ?? "";
  const customerName = project?.customer_name ?? null;
  // customer_document_url is the linked customer's contract-folder URL (read-only; kippo#51 / T04).
  // Customer itself is intentionally immutable after creation, so this is display-only.
  const customerDocumentUrl = project?.customer_document_url ?? null;
  const isClosed = project?.is_closed ?? false;
  const meetingCalendarUrl = project?.meeting_calendar_url ?? "";
  const meetingDescriptionTag = project?.meeting_description_tag ?? "";

  // The organization's members (担当PM) and its own categories (kippo#49: each org owns its copy
  // of the category set, and the API resolves the key against that set).
  const members = useOrgMembers(true, organizationId);
  const categories = useProjectCategories(true, organizationId);

  // The contract now owns the project period (synced server-side) — mirror the dates onto the
  // project fields; hasContract locks them + omits them from the patch.
  const handleContractSaved = useCallback((saved: KippoProjectContract) => {
    setForm((prev) => ({
      ...prev,
      startDate: saved.start_date ?? "",
      targetDate: saved.end_date ?? "",
    }));
  }, []);
  // Contract gone — the project's own dates become editable again (billing_types clears too).
  const handleContractDeleted = useCallback(() => setBillingTypesPresent(false), []);
  const contract = useProjectContract({
    projectId: id,
    enabled: signedIn,
    onSaved: handleContractSaved,
    onDeleted: handleContractDeleted,
  });
  // A loaded contract is authoritative; billing_types covers the window before it loads. Derived (not
  // stored) so a project re-fetch can't clobber it back to false after a contract is created in-page.
  const hasContract = contract.contractId !== null || billingTypesPresent;

  useEffect(() => {
    if (!signedIn || !id) return;
    setIsLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const response = await projectsRetrieve(id);
        if (cancelled) return;
        const loaded = response.data;
        setProject(loaded);
        setForm(projectEditFormFromProject(loaded));
        setBillingTypesPresent((loaded.billing_types ?? []).length > 0);
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
  }, [signedIn, id]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError("");
    try {
      // custom-fetch resolves (does not throw) on 4xx, so a 400 would otherwise navigate away as if
      // saved — throwOnError turns it into a catch, and apiErrorMessage surfaces the field detail
      // (e.g. the contract-period phase gate) instead of a generic banner.
      const response = throwOnError(
        await projectsPartialUpdate(id, buildProjectPatch(form, { categories, hasContract })),
      );
      // The response is the saved record: keep it, so the read-only values (the フェーズ・確度
      // change log gains a row on a phase change) are current if the page stays open — navigate(-1)
      // goes nowhere when the page was opened directly.
      setProject(response.data);
      navigate(-1);
    } catch (err) {
      setError(apiErrorMessage(err) ?? "プロジェクトの更新に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }, [id, form, categories, hasContract, navigate]);

  if (authLoading || isLoading) {
    return (
      <Layout>
        <PageLoading />
      </Layout>
    );
  }
  if (!user) return null;

  const saveDisabled = isSaving || form.name.trim().length === 0;

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
          <div>
            <span className="font-medium">組織:</span> {project?.organization_name ?? ""}
            {customerName && (
              <>
                <span className="mx-2 text-gray-300">/</span>
                <span className="font-medium">顧客:</span> {customerName}
              </>
            )}
          </div>
          {/* 契約書フォルダURL — the linked customer's document_url, read-only (kippo#51 / T04) */}
          {customerDocumentUrl && (
            <div className="mt-1 text-xs text-gray-500">
              契約書フォルダ:{" "}
              <a
                href={customerDocumentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                {customerDocumentUrl}
              </a>
            </div>
          )}
        </div>

        <Section title="基本">
          <Input
            id="p-name"
            label="プロジェクト名"
            value={form.name}
            onChange={(v) => setField("name", v)}
            maxLength={256}
          />
          <Select
            id="p-phase"
            label="ステータス"
            value={form.phase}
            onChange={(v) => setField("phase", v as PhaseEnum)}
          >
            {PHASE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            id="p-category"
            label="カテゴリ"
            value={form.category}
            onChange={(v) => setField("category", v)}
          >
            <option value="">選択してください</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select
            id="p-lead-source"
            label="リード"
            value={form.leadSource}
            onChange={(v) => setField("leadSource", v)}
          >
            <option value="">選択してください</option>
            {LEAD_SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            id="p-pm"
            label="担当PM"
            value={form.projectManagerId}
            onChange={(v) => setField("projectManagerId", v)}
          >
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
            value={form.problemDefinition}
            onChange={(v) => setField("problemDefinition", v)}
          />
        </Section>

        <Section title="日程・見積">
          <Input
            id="p-start"
            label="開始日"
            type="date"
            value={form.startDate}
            onChange={(v) => setField("startDate", v)}
            disabled={hasContract}
          />
          <Input
            id="p-target"
            label="完了予定日"
            type="date"
            value={form.targetDate}
            onChange={(v) => setField("targetDate", v)}
            disabled={hasContract}
          />
          {hasContract && (
            <p className="text-xs text-gray-500">
              ※ 契約が登録済みのため、開始日・完了予定日は契約期間から自動設定されます
            </p>
          )}
          <Input
            id="p-allocated"
            label="必要工数(人日)"
            type="number"
            step={1}
            value={form.allocatedStaffDays}
            onChange={(v) => setField("allocatedStaffDays", v)}
          />
          {/* Read-only forecast (admin's estimated_completion_date); blank when not forecastable. */}
          <div className="text-sm text-gray-600">
            <span className="font-medium">完了予測日:</span>{" "}
            {estimatedCompletionDate
              ? new Date(estimatedCompletionDate).toLocaleDateString("ja-JP")
              : "—"}
          </div>
        </Section>

        <ContractSection
          contract={contract}
          organizationId={organizationId}
          customerId={customerId}
          customerName={customerName}
          isClosed={isClosed}
        />

        <PhaseConfidenceHistory
          changes={project?.phase_confidence_changes ?? NO_PHASE_CONFIDENCE_CHANGES}
        />

        <CollapsibleSection title="詳細">
          <ParentProjectField
            organizationId={organizationId}
            customerId={customerId}
            currentProjectId={id}
            selectedId={form.parentProjectId}
            selectedName={form.parentProjectName}
            onSelect={(pid, pname) => {
              setField("parentProjectId", pid ?? "");
              setField("parentProjectName", pname);
            }}
          />
          <Input
            id="p-document-folder"
            label="ドキュメントフォルダURL"
            type="url"
            value={form.documentFolderUrl}
            onChange={(v) => setField("documentFolderUrl", v)}
          />
          {/* 状態(クローズ) is read-only — closing is the admin "Close Project" action (KIPPO_PROJECT_FIELDS.md). */}
          <div className="text-sm text-gray-600">
            <span className="font-medium">状態:</span> {isClosed ? "クローズ済み" : "進行中"}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="その他">
          <Input
            id="p-slack"
            label="Slackチャンネル名"
            value={form.slackChannelName}
            onChange={(v) => setField("slackChannelName", v)}
          />
          <Input
            id="p-slack-notify"
            label="Slack通知チャンネル名"
            value={form.slackNotificationChannelName}
            onChange={(v) => setField("slackNotificationChannelName", v)}
          />
          <Input
            id="p-github"
            label="GitHubプロジェクトURL"
            type="url"
            value={form.githubProjectHtmlUrl}
            onChange={(v) => setField("githubProjectHtmlUrl", v)}
          />
          <Input
            id="p-docbase"
            label="DocBaseタグ"
            value={form.docbaseTag}
            onChange={(v) => setField("docbaseTag", v)}
          />
          <div>
            <Checkbox
              id="p-cost-report"
              label="コストレポート有効化"
              checked={form.enableCostReport}
              onChange={(v) => setField("enableCostReport", v)}
            />
            {form.enableCostReport && form.slackChannelName.trim().length === 0 && (
              <p className="mt-1 text-xs text-red-600">※ Slackチャンネル名が必要です</p>
            )}
          </div>
          {/* Read-only MTG calendar URL + dsearch tag (admin parity). */}
          <div className="text-sm text-gray-600">
            <span className="font-medium">MTG カレンダー作成 URL:</span>{" "}
            {meetingCalendarUrl ? (
              <a
                href={meetingCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                カレンダー作成
              </a>
            ) : (
              "—"
            )}
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">カレンダーの説明欄:</span>{" "}
            <code className="break-all rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-800">
              {meetingDescriptionTag || "—"}
            </code>
          </div>
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
