// Shared form pieces for the project-assignment modals (AddParticipantModal).
import { useEffect, useId, useMemo, useState } from "react";
import type { OrganizationMember } from "~/lib/api/generated/models";
import { projectsMembersRetrieve } from "~/lib/api/generated/projects/projects";
import { memberMatchesQuery } from "./member-search";
import { isExcludedUsername, memberDisplayName } from "./utils";

export function orderMembersForPicker(
  members: OrganizationMember[],
  effortUsernames: ReadonlySet<string>,
): OrganizationMember[] {
  const filtered = members.filter((m) => !isExcludedUsername(m.username));
  return [...filtered].sort((a, b) => {
    const aHasEffort = effortUsernames.has(a.username) ? 0 : 1;
    const bHasEffort = effortUsernames.has(b.username) ? 0 : 1;
    if (aHasEffort !== bHasEffort) return aHasEffort - bHasEffort;
    return memberDisplayName(a).localeCompare(memberDisplayName(b));
  });
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
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
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

/** Org-member picker with type-ahead search over the name (English or Japanese, as stored),
 * username and GitHub login. `value` is the selected user_id ("" = none); typing clears it until
 * an option is chosen. Keyboard: ↑ / ↓ move, Enter selects, Escape closes. */
export function UserSearchField({
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
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = useMemo(
    () => members.filter((m) => memberMatchesQuery(m, query)),
    [members, query],
  );
  const handleSelect = (member: OrganizationMember) => {
    onChange(member.user_id);
    setQuery(memberOptionLabel(member, effortUsernames));
    setIsOpen(false);
  };
  const handleInput = (text: string) => {
    setQuery(text);
    setActiveIndex(0);
    setIsOpen(true);
    if (value) onChange("");
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setIsOpen(true);
      setActiveIndex((i) => Math.min(Math.max(i + step, 0), Math.max(matches.length - 1, 0)));
      return;
    }
    if (e.key === "Enter" && isOpen && matches[activeIndex]) {
      e.preventDefault();
      handleSelect(matches[activeIndex]);
      return;
    }
    if (e.key === "Escape") setIsOpen(false);
  };

  const placeholder = isLoading
    ? "読み込み中..."
    : members.length === 0
      ? "(対象ユーザーがいません)"
      : "名前・ユーザー名・GitHub ID で検索";
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  return (
    <div className="relative">
      <label htmlFor="add-assignment-user" className="block text-sm font-medium text-gray-700 mb-1">
        ユーザー <span className="text-xs font-normal text-gray-500">(★ = 週間稼働量の登録者)</span>
      </label>
      <input
        id="add-assignment-user"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={isOpen && matches[activeIndex] ? optionId(activeIndex) : undefined}
        value={query}
        placeholder={placeholder}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onKeyDown={handleKeyDown}
        disabled={disabled || members.length === 0}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
      />
      {isOpen && !disabled && members.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg"
        >
          {matches.length === 0 && (
            <li className="px-3 py-2 text-gray-500">該当するユーザーがいません</li>
          )}
          {matches.map((member, index) => (
            <li
              key={member.user_id}
              id={optionId(index)}
              role="option"
              aria-selected={member.user_id === value}
              // mousedown, not click: selecting must happen before the input's blur closes the list.
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(member);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex cursor-pointer justify-between gap-3 px-3 py-2 ${index === activeIndex ? "bg-indigo-50" : ""}`}
            >
              <span className="text-gray-900">{memberOptionLabel(member, effortUsernames)}</span>
              <span className="shrink-0 text-xs text-gray-500">{member.username}</span>
            </li>
          ))}
        </ul>
      )}
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
