// Shared form pieces for the project-assignment modals (AddParticipantModal).
import { useEffect, useState } from "react";
import type { OrganizationMember } from "~/lib/api/generated/models";
import { projectsMembersRetrieve } from "~/lib/api/generated/projects/projects";
import { EXCLUDED_USERNAMES, memberDisplayName } from "./utils";

export function orderMembersForPicker(
  members: OrganizationMember[],
  effortUsernames: ReadonlySet<string>,
): OrganizationMember[] {
  const filtered = members.filter((m) => !EXCLUDED_USERNAMES.has(m.username));
  return [...filtered].sort((a, b) => {
    const aHasEffort = effortUsernames.has(a.username) ? 0 : 1;
    const bHasEffort = effortUsernames.has(b.username) ? 0 : 1;
    if (aHasEffort !== bHasEffort) return aHasEffort - bHasEffort;
    return memberDisplayName(a).localeCompare(memberDisplayName(b));
  });
}

export function useDefaultUserSelection(
  open: boolean,
  members: OrganizationMember[],
  userId: string,
  setUserId: (v: string) => void,
) {
  useEffect(() => {
    if (open && members.length > 0 && !userId) {
      setUserId(members[0].user_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, members]);
}

async function fetchOrgMembers(
  projectId: string,
): Promise<{ members: OrganizationMember[]; error: string }> {
  try {
    const response = await projectsMembersRetrieve(projectId);
    if (response.status === 200) {
      return { members: response.data.members ?? [], error: "" };
    }
    return { members: [], error: "組織メンバーの取得に失敗しました" };
  } catch {
    return { members: [], error: "組織メンバーの取得に失敗しました" };
  }
}

export function useOrgMembers(open: boolean, projectId: string) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    if (!open) return;
    setIsLoadingMembers(true);
    setFetchError("");
    setMembers([]);
    let cancelled = false;
    (async () => {
      const result = await fetchOrgMembers(projectId);
      if (cancelled) return;
      setMembers(result.members);
      setFetchError(result.error);
      setIsLoadingMembers(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  return { members, isLoadingMembers, fetchError };
}

export function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="fixed inset-0 bg-black bg-opacity-25 cursor-default"
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{message}</div>;
}

function memberOptionLabel(
  member: OrganizationMember,
  effortUsernames: ReadonlySet<string>,
): string {
  const prefix = effortUsernames.has(member.username) ? "★ " : "";
  return `${prefix}${memberDisplayName(member)}`;
}

export function UserSelectField({
  value,
  onChange,
  members,
  effortUsernames,
  disabled,
  isLoading,
}: {
  value: string;
  onChange: (v: string) => void;
  members: OrganizationMember[];
  effortUsernames: ReadonlySet<string>;
  disabled: boolean;
  isLoading: boolean;
}) {
  return (
    <div>
      <label htmlFor="add-assignment-user" className="block text-sm font-medium text-gray-700 mb-1">
        ユーザー <span className="text-xs font-normal text-gray-500">(★ = 週間稼働量の登録者)</span>
      </label>
      <select
        id="add-assignment-user"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || members.length === 0}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
      >
        {isLoading && <option value="">読み込み中...</option>}
        {!isLoading && members.length === 0 && <option value="">(対象ユーザーがいません)</option>}
        {members.map((member) => (
          <option key={member.user_id} value={member.user_id}>
            {memberOptionLabel(member, effortUsernames)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PercentageField({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label htmlFor="add-assignment-pct" className="block text-sm font-medium text-gray-700 mb-1">
        割当 (%)
      </label>
      <input
        id="add-assignment-pct"
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        disabled={disabled}
        className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

export function ModalActions({
  onCancel,
  onSubmit,
  isSaving,
  submitDisabled,
  submitLabel,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  submitDisabled?: boolean;
  submitLabel: string;
}) {
  return (
    <div className="mt-6 flex gap-3 justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSaving}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
      >
        キャンセル
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSaving || submitDisabled}
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? "保存中..." : submitLabel}
      </button>
    </div>
  );
}
