import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuthGate } from "~/hooks/useAuthGate";
import { Layout } from "~/components/layout";
import { PHASE_OPTIONS } from "~/components/project-form/fields";
import { organizationsMembersRetrieve } from "~/lib/api/generated/organizations/organizations";
import { projectCategoriesList } from "~/lib/api/generated/project-categories/project-categories";
import {
  projectsContractCreate,
  projectsContractDestroy,
  projectsContractList,
  projectsContractPartialUpdate,
  projectsForecastRetrieve,
  projectsList,
  projectsPartialUpdate,
  projectsRetrieve,
} from "~/lib/api/generated/projects/projects";
import { apiErrorMessage, throwOnError } from "~/lib/api/api-error";
import { readList } from "~/lib/api/read-list";
import { formatProjectWithCustomer } from "~/lib/format-project";
import type {
  BillingTypeEnum,
  KippoProject,
  KippoProjectContract,
  KippoProjectContractRequest,
  KippoProjectOrganizationCategory,
  OrganizationMember,
  PatchedKippoProjectRequest,
  PhaseEnum,
  PricingBasisEnum,
} from "~/lib/api/generated/models";

// In-SPA KippoProject record edit (kippo#42 — replaces linking out to the Django admin). Covers the
// project's own fields grouped per KIPPO_PROJECT_FIELDS.md / kippo#41; organization + customer are
// shown read-only, and the contract / assignment inlines remain separate features (future work).
export function meta() {
  return [{ title: "プロジェクト編集 - Kippo" }];
}

export default function ProjectEdit() {
  const { id = "" } = useParams();
  const { user, authLoading } = useAuthGate();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const [organizationId, setOrganizationId] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState<string | null>(null);
  // customer_document_url is the linked customer's contract-folder URL (read-only; kippo#51 / T04).
  // Customer itself is intentionally immutable after creation, so this is display-only.
  const [customerDocumentUrl, setCustomerDocumentUrl] = useState<string | null>(null);
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
  const [enableCostReport, setEnableCostReport] = useState(false);
  // parent_project (親プロジェクト) — optional upsell parent; name-searched picker. Backend rejects a
  // cross-org or self-referencing parent. parentProjectName is the read-only label for the selection.
  const [parentProjectId, setParentProjectId] = useState("");
  const [parentProjectName, setParentProjectName] = useState<string | null>(null);
  // is_closed is read-only here: per KIPPO_PROJECT_FIELDS.md it (and display_in_project_report) are
  // managed by the admin "Close Project" action, not edited directly (that would skip actual_date /
  // closed_datetime / status-comment side effects).
  const [isClosed, setIsClosed] = useState(false);
  // Once a contract exists its period is the single source of the project dates (synced server-side);
  // the backend rejects a changed start_date/target_date. billing_types is contract-derived, so a
  // non-empty list is an early proxy for "has a contract" before the contract record itself loads.
  const [billingTypesPresent, setBillingTypesPresent] = useState(false);
  // 完了予測日 — read-only forecast from GET /projects/:id/forecast/ (null when no future
  // assignments to project from). Mirrors the admin's estimated_completion_date display.
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState<string | null>(null);
  // MTG カレンダー作成 URL + dsearch tag — read-only (admin parity).
  const [meetingCalendarUrl, setMeetingCalendarUrl] = useState("");
  const [meetingDescriptionTag, setMeetingDescriptionTag] = useState("");

  // Contract (契約, kippo#31) — OneToOne with the project (admin's KippoProjectContractInline). Its
  // period is the single source of the project's start/target dates (synced server-side). contractId
  // null = no contract yet; showContractForm reveals the create form when none exists.
  const [contractId, setContractId] = useState<number | null>(null);
  const [showContractForm, setShowContractForm] = useState(false);
  const [confirmDeleteContract, setConfirmDeleteContract] = useState(false);
  const [contractSaving, setContractSaving] = useState(false);
  const [contractError, setContractError] = useState("");
  const [billingType, setBillingType] = useState<BillingTypeEnum>("delivery");
  const [pricingBasis, setPricingBasis] = useState<PricingBasisEnum>("fixed");
  const [contractTotalAmount, setContractTotalAmount] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [contractNote, setContractNote] = useState("");

  // A loaded contract is authoritative; billing_types covers the window before it loads. Derived (not
  // stored) so a project re-fetch can't clobber it back to false after a contract is created in-page.
  const hasContract = contractId !== null || billingTypesPresent;

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
        setCustomerId(p.customer ?? "");
        setCustomerName(p.customer_name);
        setCustomerDocumentUrl(p.customer_document_url ?? null);
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
        setEnableCostReport(p.enable_cost_report ?? false);
        setParentProjectId(p.parent_project ?? "");
        setParentProjectName(p.parent_project_name ?? null);
        setMeetingCalendarUrl(p.meeting_calendar_url ?? "");
        setMeetingDescriptionTag(p.meeting_description_tag ?? "");
        setIsClosed(p.is_closed ?? false);
        setBillingTypesPresent((p.billing_types ?? []).length > 0);
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
        setCategories(
          readList<KippoProjectOrganizationCategory>(categoryRes.data).filter(
            (c) => c.organization == null,
          ),
        );
      } catch {
        // pickers just stay empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const applyContract = useCallback((c: KippoProjectContract) => {
    setContractId(c.id);
    setBillingType(c.billing_type ?? "delivery");
    setPricingBasis(c.pricing_basis ?? "fixed");
    setContractTotalAmount(c.total_amount ?? "");
    setContractStartDate(c.start_date ?? "");
    setContractEndDate(c.end_date ?? "");
    setContractNote(c.note ?? "");
  }, []);

  // Load the project's contract (kippo#31) — OneToOne, so the list holds at most one. Its presence
  // reconciles hasContract (the project's own dates become contract-managed once a contract exists).
  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await projectsContractList(id);
        if (cancelled) return;
        const contract = readList<KippoProjectContract>(response.data)[0];
        if (contract) applyContract(contract);
      } catch {
        // no contract / no access — leave the "契約を追加" flow available
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, id, applyContract]);

  const handleSaveContract = useCallback(async () => {
    setContractSaving(true);
    setContractError("");
    const body: KippoProjectContractRequest = {
      billing_type: billingType,
      pricing_basis: pricingBasis,
      // fixed pricing requires a total; effort pricing treats it as an optional cap (blank → null).
      total_amount: contractTotalAmount.trim() === "" ? null : contractTotalAmount.trim(),
      // blank period is auto-filled from the project's start_date/target_date server-side.
      start_date: contractStartDate || null,
      end_date: contractEndDate || null,
      note: contractNote.trim(),
    };
    try {
      const response = throwOnError(
        contractId == null
          ? await projectsContractCreate(id, body)
          : await projectsContractPartialUpdate(id, contractId, body),
      );
      const saved = response.data;
      applyContract(saved);
      // The contract now owns the project period (synced server-side) — mirror the dates onto the
      // project fields; hasContract (derived from contractId) locks them + omits them from the patch.
      setStartDate(saved.start_date ?? "");
      setTargetDate(saved.end_date ?? "");
      setShowContractForm(false);
    } catch (error) {
      setContractError(apiErrorMessage(error) ?? "契約の保存に失敗しました");
    } finally {
      setContractSaving(false);
    }
  }, [
    id,
    contractId,
    billingType,
    pricingBasis,
    contractTotalAmount,
    contractStartDate,
    contractEndDate,
    contractNote,
    applyContract,
  ]);

  const handleDeleteContract = useCallback(async () => {
    if (contractId == null) return;
    setContractSaving(true);
    setContractError("");
    try {
      throwOnError(await projectsContractDestroy(id, contractId));
      // Contract gone — the project's own dates become editable again (billing_types clears too).
      setContractId(null);
      setBillingTypesPresent(false);
      setConfirmDeleteContract(false);
      setShowContractForm(false);
      setBillingType("delivery");
      setPricingBasis("fixed");
      setContractTotalAmount("");
      setContractStartDate("");
      setContractEndDate("");
      setContractNote("");
    } catch (error) {
      setContractError(apiErrorMessage(error) ?? "契約の削除に失敗しました");
    } finally {
      setContractSaving(false);
    }
  }, [id, contractId]);

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
      // contract-managed dates are omitted (not just echoed) — the contract period is the write path
      ...(hasContract ? {} : { start_date: startDate || null, target_date: targetDate || null }),
      allocated_staff_days: allocated === "" ? null : Number.parseInt(allocated, 10),
      document_folder_url: documentFolderUrl.trim(),
      docbase_tag: docbaseTag.trim(),
      slack_channel_name: slackChannelName.trim(),
      slack_notification_channel_name: slackNotificationChannelName.trim(),
      github_project_html_url: githubProjectHtmlUrl.trim(),
      enable_cost_report: enableCostReport,
      parent_project: parentProjectId || null,
    };
    try {
      // custom-fetch resolves (does not throw) on 4xx, so a 400 would otherwise navigate away as if
      // saved — throwOnError turns it into a catch, and apiErrorMessage surfaces the field detail
      // (e.g. the contract-period phase gate) instead of a generic banner.
      throwOnError(await projectsPartialUpdate(id, patch));
      navigate(-1);
    } catch (error) {
      setError(apiErrorMessage(error) ?? "プロジェクトの更新に失敗しました");
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
    hasContract,
    startDate,
    targetDate,
    allocatedStaffDays,
    documentFolderUrl,
    docbaseTag,
    slackChannelName,
    slackNotificationChannelName,
    githubProjectHtmlUrl,
    enableCostReport,
    parentProjectId,
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

  // Contract validation mirrors the serializer (start<=end; total_amount required for fixed pricing).
  const contractDateRangeInvalid =
    contractStartDate !== "" && contractEndDate !== "" && contractStartDate > contractEndDate;
  const contractTotalRequired = pricingBasis === "fixed" && contractTotalAmount.trim() === "";
  const contractSaveDisabled = contractSaving || contractDateRangeInvalid || contractTotalRequired;

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
            <span className="font-medium">組織:</span> {organizationName}
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
            disabled={hasContract}
          />
          <Input
            id="p-target"
            label="完了予定日"
            type="date"
            value={targetDate}
            onChange={setTargetDate}
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

        {/* 契約 (kippo#31) — the admin's KippoProjectContractInline, edited via its own nested REST
            resource (POST/PATCH/DELETE) with a dedicated save so it stays independent of the project
            patch. Once saved, its period drives the project's (locked) start/target dates. */}
        <Section title="契約">
          {contractError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{contractError}</div>
          )}
          {/* Closed project: the backend refuses contract writes (admin's LockWhenProjectClosedInline
              parity), so the section is read-only. */}
          {isClosed && (
            <p className="text-xs text-gray-500">
              ※ プロジェクトはクローズ済みのため、契約は編集できません
            </p>
          )}
          {contractId == null && !showContractForm ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">契約が登録されていません</p>
              {!isClosed && (
                <button
                  type="button"
                  onClick={() => setShowContractForm(true)}
                  className="text-sm text-indigo-600 hover:text-indigo-500"
                >
                  ＋ 契約を追加
                </button>
              )}
            </div>
          ) : (
            <>
              <Select
                id="c-billing-type"
                label="請求方法"
                value={billingType}
                onChange={(v) => setBillingType(v as BillingTypeEnum)}
                disabled={isClosed}
              >
                <option value="delivery">納品</option>
                <option value="monthly">月額</option>
              </Select>
              <Select
                id="c-pricing-basis"
                label="料金体系"
                value={pricingBasis}
                onChange={(v) => setPricingBasis(v as PricingBasisEnum)}
                disabled={isClosed}
              >
                <option value="fixed">固定</option>
                <option value="effort">実績</option>
              </Select>
              <div>
                <Input
                  id="c-total-amount"
                  label={pricingBasis === "fixed" ? "契約金額(円)" : "契約金額(上限・任意)"}
                  type="number"
                  step={1}
                  value={contractTotalAmount}
                  onChange={setContractTotalAmount}
                  disabled={isClosed}
                />
                {contractTotalRequired && (
                  <p className="mt-1 text-xs text-red-600">※ 固定料金の場合、契約金額は必須です</p>
                )}
                {pricingBasis === "effort" && (
                  <p className="mt-1 text-xs text-gray-500">
                    ※ 実績料金では契約金額は上限(任意)。空欄可
                  </p>
                )}
              </div>
              <Input
                id="c-start"
                label="契約開始日"
                type="date"
                value={contractStartDate}
                onChange={setContractStartDate}
                disabled={isClosed}
              />
              <Input
                id="c-end"
                label="契約終了日"
                type="date"
                value={contractEndDate}
                onChange={setContractEndDate}
                disabled={isClosed}
              />
              {contractDateRangeInvalid && (
                <p className="text-xs text-red-600">※ 契約開始日は契約終了日以前にしてください</p>
              )}
              <p className="text-xs text-gray-500">
                ※ 契約期間を空欄にすると、プロジェクトの開始日・完了予定日から自動設定されます
              </p>
              <Input
                id="c-note"
                label="備考"
                value={contractNote}
                onChange={setContractNote}
                maxLength={255}
                disabled={isClosed}
              />
              {!isClosed && (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    {contractId != null &&
                      (confirmDeleteContract ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-red-700">削除しますか？</span>
                          <button
                            type="button"
                            onClick={handleDeleteContract}
                            disabled={contractSaving}
                            className="text-red-600 hover:underline disabled:opacity-50"
                          >
                            はい
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteContract(false)}
                            className="text-gray-500 hover:underline"
                          >
                            いいえ
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteContract(true)}
                          className="text-sm text-red-600 hover:text-red-500"
                        >
                          契約を削除
                        </button>
                      ))}
                  </div>
                  <div className="flex items-center gap-3">
                    {contractId == null && (
                      <button
                        type="button"
                        onClick={() => setShowContractForm(false)}
                        disabled={contractSaving}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        キャンセル
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveContract}
                      disabled={contractSaveDisabled}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {contractSaving ? "保存中..." : "契約を保存"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Section>

        <CollapsibleSection title="詳細">
          <ParentProjectField
            organizationId={organizationId}
            customerId={customerId}
            currentProjectId={id}
            selectedId={parentProjectId}
            selectedName={parentProjectName}
            onSelect={(pid, pname) => {
              setParentProjectId(pid ?? "");
              setParentProjectName(pname);
            }}
          />
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
        </CollapsibleSection>

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
          <div>
            <Checkbox
              id="p-cost-report"
              label="コストレポート有効化"
              checked={enableCostReport}
              onChange={setEnableCostReport}
            />
            {enableCostReport && slackChannelName.trim().length === 0 && (
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

// Optional parent_project picker with project-name search. Queries the org-scoped project list
// (projectsList?search=) and limits candidates to the SAME KippoCustomer as the project being
// edited (upsell parents share a customer), excluding the project itself. Falls back to the same
// organization when the project has no customer. The backend rejects a cross-org / self parent.
function ParentProjectField({
  organizationId,
  customerId,
  currentProjectId,
  selectedId,
  selectedName,
  onSelect,
}: {
  organizationId: string;
  customerId: string;
  currentProjectId: string;
  selectedId: string;
  selectedName: string | null;
  onSelect: (id: string | null, name: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; name: string; customer_name: string | null }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Fetch whenever the field is open (focused) — even with an empty query — so focusing shows the
    // full candidate list; typing then narrows it. Scope to the project's customer server-side
    // (?customer=); without a customer, fall back to a client-side org filter (the list is already
    // org-scoped to the user's memberships).
    if (!open) return;
    const q = query.trim();
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const response = await projectsList({
          page_size: 50,
          ...(q ? { search: q } : {}),
          ...(customerId ? { customer: customerId } : {}),
        });
        if (cancelled) return;
        const items = readList<KippoProject>(response.data)
          .filter(
            (p) => p.id !== currentProjectId && (customerId || p.organization === organizationId),
          )
          .map((p) => ({ id: p.id, name: p.name, customer_name: p.customer_name }));
        setResults(items);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, query, organizationId, customerId, currentProjectId]);

  return (
    <div>
      <span className="block text-sm font-medium text-gray-700 mb-1">親プロジェクト</span>
      {selectedId ? (
        <div className="flex items-center gap-2 text-sm text-gray-800">
          <span>{selectedName || selectedId}</span>
          <button
            type="button"
            onClick={() => onSelect(null, null)}
            className="text-xs text-indigo-600 hover:underline"
          >
            クリア
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            // Delay close so a click on a result (which blurs the input) still registers.
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="プロジェクト名で検索..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {open && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
              {loading ? (
                <p className="px-3 py-2 text-sm text-gray-500">検索中...</p>
              ) : results.length > 0 ? (
                <ul>
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(r.id, r.name);
                          setQuery("");
                          setOpen(false);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
                      >
                        {formatProjectWithCustomer(r.name, r.customer_name)}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-2 text-sm text-gray-500">
                  この顧客に関連するプロジェクトがありません
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
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

// Collapsible section (native <details>) — starts collapsed so secondary config is tucked away
// after creation (kippo#42 / KIPPO_PROJECT_FIELDS.md). The disclosure arrow rotates with the
// open state (tracked in React so the icon reflects expand/collapse).
function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="bg-white shadow rounded-lg p-6"
    >
      <summary className="flex cursor-pointer select-none items-center gap-2 text-lg font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
        <span className={`text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
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
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "date" | "url" | "number";
  maxLength?: number;
  step?: number;
  disabled?: boolean;
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
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
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
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
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
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
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

function Checkbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-gray-700">
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
