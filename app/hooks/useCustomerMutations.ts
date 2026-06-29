import { useCallback, useState } from "react";
import { customersCreate, customersUpdate } from "~/lib/api/generated/customers/customers";
import type { KippoCustomerRequest } from "~/lib/api/generated/models";

// Create/update mutations for KippoCustomer, mirroring the admin's customer add/change
// (kippo#42). Each call refreshes the list and reports a Japanese error on failure.
export type CustomerMutations = {
  isSaving: boolean;
  createCustomer: (payload: KippoCustomerRequest) => Promise<boolean>;
  updateCustomer: (id: string, payload: KippoCustomerRequest) => Promise<boolean>;
};

function useWrap(refresh: () => Promise<void>, setHookError: (err: string) => void) {
  const [isSaving, setIsSaving] = useState(false);
  const wrap = useCallback(
    async <T>(operation: () => Promise<T>, errorMessage: string): Promise<boolean> => {
      setIsSaving(true);
      setHookError("");
      try {
        await operation();
        await refresh();
        return true;
      } catch {
        setHookError(errorMessage);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [refresh, setHookError],
  );
  return { isSaving, wrap };
}

export function useCustomerMutations(
  refresh: () => Promise<void>,
  setHookError: (err: string) => void,
): CustomerMutations {
  const { isSaving, wrap } = useWrap(refresh, setHookError);

  const createCustomer = useCallback(
    (payload: KippoCustomerRequest) =>
      wrap(() => customersCreate(payload), "顧客の作成に失敗しました"),
    [wrap],
  );

  const updateCustomer = useCallback(
    (id: string, payload: KippoCustomerRequest) =>
      wrap(() => customersUpdate(id, payload), "顧客の更新に失敗しました"),
    [wrap],
  );

  return { isSaving, createCustomer, updateCustomer };
}
