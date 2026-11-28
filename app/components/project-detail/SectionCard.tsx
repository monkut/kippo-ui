import type { ReactNode } from "react";
import { ChevronIcon, DeleteIcon, EditIcon } from "~/components/icons";
import type { SectionDisplay } from "./display";

type SectionCardProps = {
  title: string;
  /** Row count shown beside the title while the section is collapsed. */
  count: number;
  display: SectionDisplay;
  /** Shown beside the title (e.g. the 未対応 list). Pass null to reserve the slot with nothing
   * in it; omit for a section that has no such slot. */
  headerExtra?: ReactNode;
  /** 追加 is offered only while no create / edit form is open. */
  canAdd: boolean;
  onAdd: () => void;
  children: ReactNode;
};

/** Collapsible card for one requirement section: title, コンパクト toggle and 追加. */
export function SectionCard({
  title,
  count,
  display,
  headerExtra,
  canAdd,
  onAdd,
  children,
}: SectionCardProps) {
  const titleButton = (
    <button
      type="button"
      onClick={display.onToggleExpanded}
      className="flex items-center gap-2 text-lg font-medium text-gray-900 hover:text-gray-700"
    >
      <ChevronIcon isExpanded={display.expanded} />
      <span>{title}</span>
      {!display.expanded && (
        <span className="ml-2 text-sm font-normal text-gray-500">({count}件)</span>
      )}
    </button>
  );
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        {headerExtra === undefined ? (
          titleButton
        ) : (
          <div className="flex items-center gap-3">
            {titleButton}
            {headerExtra}
          </div>
        )}
        {display.expanded && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={display.onToggleCompact}
              className={`px-2 py-1 text-xs font-medium rounded-md ${
                display.compact
                  ? "bg-gray-200 text-gray-700"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              コンパクト
            </button>
            {canAdd && (
              <button
                type="button"
                onClick={onAdd}
                className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100"
              >
                追加
              </button>
            )}
          </div>
        )}
      </div>
      {display.expanded && <div className="p-6">{children}</div>}
    </div>
  );
}

/** 未対応 list in a section header: elements the next level does not cover yet. */
export function UnaddressedList({ displayIds }: { displayIds: string[] }) {
  if (displayIds.length === 0) return null;
  return <span className="text-xs text-red-600">未対応: {displayIds.join(", ")}</span>;
}

/** 編集 / 削除 icon buttons of a requirement row, revealed on row hover. */
export function EditDeleteButtons({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onEdit();
        }}
        className="p-1 text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
        title="編集"
      >
        <EditIcon />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onDelete();
        }}
        className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
        title="削除"
      >
        <DeleteIcon />
      </button>
    </>
  );
}
