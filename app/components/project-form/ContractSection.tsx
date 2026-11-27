import type { ProjectContract } from "~/hooks/useProjectContract";
import type { BillingTypeEnum, PricingBasisEnum } from "~/lib/api/generated/models";
import { BilledToField } from "./BilledToField";
import { Input, Section, Select } from "./PageFields";

type ContractSectionProps = {
  contract: ProjectContract;
  organizationId: string;
  /** The project's customer: the default 請求先. */
  customerId: string;
  customerName: string | null;
  /** Closed project: the backend refuses contract writes (admin's LockWhenProjectClosedInline
   * parity), so the section is read-only. */
  isClosed: boolean;
};

/** 契約 (kippo#31) — the admin's KippoProjectContractInline, edited via its own nested REST
 * resource (POST/PATCH/DELETE) with a dedicated save so it stays independent of the project
 * patch. Once saved, its period drives the project's (locked) start/target dates. */
export function ContractSection({
  contract,
  organizationId,
  customerId,
  customerName,
  isClosed,
}: ContractSectionProps) {
  const { form, setField } = contract;
  return (
    <Section title="契約">
      {contract.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{contract.error}</div>
      )}
      {isClosed && (
        <p className="text-xs text-gray-500">
          ※ プロジェクトはクローズ済みのため、契約は編集できません
        </p>
      )}
      {contract.contractId == null && !contract.showForm ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">契約が登録されていません</p>
          {!isClosed && (
            <button
              type="button"
              onClick={() => contract.openForm({ id: customerId, name: customerName })}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              ＋ 契約を追加
            </button>
          )}
        </div>
      ) : (
        <>
          <BilledToField
            organizationId={organizationId}
            projectCustomerId={customerId}
            projectCustomerName={customerName}
            billedToId={form.billedToId}
            billedToName={form.billedToName}
            onSelect={(c) => {
              setField("billedToId", c?.id ?? "");
              setField("billedToName", c?.name ?? null);
            }}
            disabled={isClosed}
          />
          <Select
            id="c-billing-type"
            label="請求方法"
            value={form.billingType}
            onChange={(v) => setField("billingType", v as BillingTypeEnum)}
            disabled={isClosed}
          >
            <option value="delivery">納品</option>
            <option value="monthly">月額</option>
          </Select>
          <Select
            id="c-pricing-basis"
            label="料金体系"
            value={form.pricingBasis}
            onChange={(v) => setField("pricingBasis", v as PricingBasisEnum)}
            disabled={isClosed}
          >
            <option value="fixed">固定</option>
            <option value="effort">実績</option>
          </Select>
          <div>
            <Input
              id="c-total-amount"
              label={form.pricingBasis === "fixed" ? "契約金額(円)" : "契約金額(上限・任意)"}
              type="number"
              step={1}
              value={form.totalAmount}
              onChange={(v) => setField("totalAmount", v)}
              disabled={isClosed}
            />
            {contract.totalRequired && (
              <p className="mt-1 text-xs text-red-600">※ 固定料金の場合、契約金額は必須です</p>
            )}
            {form.pricingBasis === "effort" && (
              <p className="mt-1 text-xs text-gray-500">
                ※ 実績料金では契約金額は上限(任意)。空欄可
              </p>
            )}
          </div>
          {/* 月額 (kippo#46) — only for 実績(effort) + 月額(monthly). Provisional monthly amount
              billed up front, then trued-up to actuals server-side. Blank bills actuals directly. */}
          {contract.isEffortMonthly && (
            <div>
              <Input
                id="c-estimated-monthly"
                label="月額(円・任意)"
                type="number"
                step={1}
                value={form.estimatedMonthly}
                onChange={(v) => setField("estimatedMonthly", v)}
                disabled={isClosed}
              />
              <p className="mt-1 text-xs text-gray-500">
                ※ 実績+月額の暫定月額。各月これで仮請求し、後で実績に調整。空欄は実績を直接請求
              </p>
            </div>
          )}
          <Input
            id="c-start"
            label="契約開始日"
            type="date"
            value={form.startDate}
            onChange={(v) => setField("startDate", v)}
            disabled={isClosed}
          />
          <Input
            id="c-end"
            label="契約終了日"
            type="date"
            value={form.endDate}
            onChange={(v) => setField("endDate", v)}
            disabled={isClosed}
          />
          {contract.dateRangeInvalid && (
            <p className="text-xs text-red-600">※ 契約開始日は契約終了日以前にしてください</p>
          )}
          <p className="text-xs text-gray-500">
            ※ 契約期間を空欄にすると、プロジェクトの開始日・完了予定日から自動設定されます
          </p>
          <Input
            id="c-note"
            label="備考"
            value={form.note}
            onChange={(v) => setField("note", v)}
            maxLength={255}
            disabled={isClosed}
          />
          {!isClosed && <ContractActions contract={contract} />}
        </>
      )}
    </Section>
  );
}

/** 契約を削除 (with inline confirmation) on the left, キャンセル / 契約を保存 on the right. */
function ContractActions({ contract }: { contract: ProjectContract }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        {contract.contractId != null &&
          (contract.confirmDelete ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-red-700">削除しますか？</span>
              <button
                type="button"
                onClick={contract.remove}
                disabled={contract.saving}
                className="text-red-600 hover:underline disabled:opacity-50"
              >
                はい
              </button>
              <button
                type="button"
                onClick={() => contract.setConfirmDelete(false)}
                className="text-gray-500 hover:underline"
              >
                いいえ
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => contract.setConfirmDelete(true)}
              className="text-sm text-red-600 hover:text-red-500"
            >
              契約を削除
            </button>
          ))}
      </div>
      <div className="flex items-center gap-3">
        {contract.contractId == null && (
          <button
            type="button"
            onClick={contract.closeForm}
            disabled={contract.saving}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
        )}
        <button
          type="button"
          onClick={contract.save}
          disabled={contract.saveDisabled}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {contract.saving ? "保存中..." : "契約を保存"}
        </button>
      </div>
    </div>
  );
}
