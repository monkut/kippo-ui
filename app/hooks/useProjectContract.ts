import { useCallback, useEffect, useRef, useState } from "react";
import { apiErrorMessage, throwOnError } from "~/lib/api/api-error";
import type {
  BillingTypeEnum,
  KippoProjectContract,
  KippoProjectContractRequest,
  PricingBasisEnum,
} from "~/lib/api/generated/models";
import {
  projectsContractCreate,
  projectsContractDestroy,
  projectsContractList,
  projectsContractPartialUpdate,
} from "~/lib/api/generated/projects/projects";
import { readList } from "~/lib/api/read-list";

/** Contract form values, as the inputs hold them. */
export type ContractForm = {
  billingType: BillingTypeEnum;
  pricingBasis: PricingBasisEnum;
  totalAmount: string;
  // 月額 (kippo#46) — provisional monthly amount, only meaningful for effort + monthly contracts
  // (the backend rejects it elsewhere). Manually entered; blank bills logged actuals directly.
  estimatedMonthly: string;
  startDate: string;
  endDate: string;
  note: string;
  // 請求先 (billed_to) — the billed customer; defaults to the project's customer server-side,
  // editable to a different customer in the project's org. Empty id = unset.
  billedToId: string;
  billedToName: string | null;
};

const EMPTY_CONTRACT_FORM: ContractForm = {
  billingType: "delivery",
  pricingBasis: "fixed",
  totalAmount: "",
  estimatedMonthly: "",
  startDate: "",
  endDate: "",
  note: "",
  billedToId: "",
  billedToName: null,
};

const contractFormFromContract = (contract: KippoProjectContract): ContractForm => ({
  billingType: contract.billing_type ?? "delivery",
  pricingBasis: contract.pricing_basis ?? "fixed",
  totalAmount: contract.total_amount ?? "",
  estimatedMonthly: contract.estimated_monthly_amount ?? "",
  startDate: contract.start_date ?? "",
  endDate: contract.end_date ?? "",
  note: contract.note ?? "",
  billedToId: contract.billed_to ?? "",
  billedToName: contract.billed_to_name ?? null,
});

export function buildContractRequest(form: ContractForm): KippoProjectContractRequest {
  const isEffortMonthly = form.pricingBasis === "effort" && form.billingType === "monthly";
  return {
    billing_type: form.billingType,
    pricing_basis: form.pricingBasis,
    // fixed pricing requires a total; effort pricing treats it as an optional cap (blank → null).
    total_amount: form.totalAmount.trim() === "" ? null : form.totalAmount.trim(),
    // 月額 only for effort + monthly; always send null otherwise so switching pricing away clears
    // any stored value (the serializer validates against the stored value on PATCH → would 400).
    estimated_monthly_amount:
      isEffortMonthly && form.estimatedMonthly.trim() !== "" ? form.estimatedMonthly.trim() : null,
    // blank period is auto-filled from the project's start_date/target_date server-side.
    start_date: form.startDate || null,
    end_date: form.endDate || null,
    note: form.note.trim(),
    // 請求先: null on create → server defaults it to the project's customer; on update null clears it.
    billed_to: form.billedToId || null,
  };
}

type UseProjectContractOptions = {
  projectId: string;
  /** Load the contract only once the viewer is signed in. */
  enabled: boolean;
  /** The saved contract now owns the project period (synced server-side). */
  onSaved: (contract: KippoProjectContract) => void;
  onDeleted: () => void;
};

export type ProjectContract = {
  /** null = the project has no contract (yet). */
  contractId: number | null;
  form: ContractForm;
  setField: <K extends keyof ContractForm>(key: K, value: ContractForm[K]) => void;
  /** The create form is revealed (only relevant while there is no contract). */
  showForm: boolean;
  /** Reveal the create form, seeding 請求先 so the server-side default is visible. */
  openForm: (billedTo: { id: string; name: string | null }) => void;
  closeForm: () => void;
  confirmDelete: boolean;
  setConfirmDelete: (value: boolean) => void;
  saving: boolean;
  error: string;
  // 月額 only applies to effort (実績) + monthly (月額) contracts (mirrors the model/serializer).
  isEffortMonthly: boolean;
  // Validation mirrors the serializer (start<=end; total_amount required for fixed pricing).
  dateRangeInvalid: boolean;
  totalRequired: boolean;
  saveDisabled: boolean;
  save: () => Promise<void>;
  remove: () => Promise<void>;
};

/** The project's contract (契約, kippo#31) — OneToOne with the project, edited through its own
 * nested REST resource with a dedicated save, independent of the project patch. */
export function useProjectContract({
  projectId,
  enabled,
  onSaved,
  onDeleted,
}: UseProjectContractOptions): ProjectContract {
  const [contractId, setContractId] = useState<number | null>(null);
  const [form, setForm] = useState<ContractForm>(EMPTY_CONTRACT_FORM);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const callbacksRef = useRef({ onSaved, onDeleted });
  callbacksRef.current = { onSaved, onDeleted };

  const applyContract = useCallback((contract: KippoProjectContract) => {
    setContractId(contract.id);
    setForm(contractFormFromContract(contract));
  }, []);

  // Load the contract — OneToOne, so the list holds at most one.
  useEffect(() => {
    if (!enabled || !projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await projectsContractList(projectId);
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
  }, [enabled, projectId, applyContract]);

  const setField = useCallback(
    <K extends keyof ContractForm>(key: K, value: ContractForm[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const openForm = useCallback((billedTo: { id: string; name: string | null }) => {
    setForm((prev) => ({ ...prev, billedToId: billedTo.id, billedToName: billedTo.name }));
    setShowForm(true);
  }, []);
  const closeForm = useCallback(() => setShowForm(false), []);

  const save = useCallback(async () => {
    setSaving(true);
    setError("");
    const body = buildContractRequest(form);
    try {
      const response = throwOnError(
        contractId == null
          ? await projectsContractCreate(projectId, body)
          : await projectsContractPartialUpdate(projectId, contractId, body),
      );
      applyContract(response.data);
      callbacksRef.current.onSaved(response.data);
      setShowForm(false);
    } catch (err) {
      setError(apiErrorMessage(err) ?? "契約の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [projectId, contractId, form, applyContract]);

  const remove = useCallback(async () => {
    if (contractId == null) return;
    setSaving(true);
    setError("");
    try {
      throwOnError(await projectsContractDestroy(projectId, contractId));
      setContractId(null);
      callbacksRef.current.onDeleted();
      setConfirmDelete(false);
      setShowForm(false);
      setForm(EMPTY_CONTRACT_FORM);
    } catch (err) {
      setError(apiErrorMessage(err) ?? "契約の削除に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [projectId, contractId]);

  const isEffortMonthly = form.pricingBasis === "effort" && form.billingType === "monthly";
  const dateRangeInvalid =
    form.startDate !== "" && form.endDate !== "" && form.startDate > form.endDate;
  const totalRequired = form.pricingBasis === "fixed" && form.totalAmount.trim() === "";

  return {
    contractId,
    form,
    setField,
    showForm,
    openForm,
    closeForm,
    confirmDelete,
    setConfirmDelete,
    saving,
    error,
    isEffortMonthly,
    dateRangeInvalid,
    totalRequired,
    saveDisabled: saving || dateRangeInvalid || totalRequired,
    save,
    remove,
  };
}
