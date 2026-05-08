import { memo } from "react";
import type {
  ProjectAssignmentPattern,
  ProjectAssignmentPatternConflict,
  ProjectAssignmentPatternMember,
} from "~/lib/api/generated/models";
import { formatMonth } from "./utils";

type PatternCardProps = {
  pattern: ProjectAssignmentPattern;
  isAccepting: boolean;
  onAccept: (pattern: ProjectAssignmentPattern) => void;
};

function PatternCardImpl({ pattern, isAccepting, onAccept }: PatternCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm flex flex-col gap-3 min-w-[300px] flex-1">
      <CardHeader pattern={pattern} />
      <MembersSection members={pattern.members} />
      <ConflictsSection conflicts={pattern.conflicts} />
      <AcceptButton pattern={pattern} isAccepting={isAccepting} onAccept={onAccept} />
    </div>
  );
}

function CardHeader({ pattern }: { pattern: ProjectAssignmentPattern }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">{pattern.label}</h3>
        {pattern.infeasible && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            実行不可
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-0.5">{pattern.pattern_ids.join(" / ")}</p>
      <div className="mt-2 text-sm">
        <span className="text-gray-600">完了予測:</span>{" "}
        <span className="font-medium text-gray-900">{pattern.estimated_completion ?? "—"}</span>
      </div>
    </div>
  );
}

function MembersSection({ members }: { members: ProjectAssignmentPatternMember[] }) {
  if (members.length === 0) {
    return <p className="text-sm text-gray-500">メンバーが選定できませんでした。</p>;
  }
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">提案メンバー</h4>
      <div className="space-y-1.5">
        {members.map((member) => (
          <MemberRow key={member.user_id} member={member} />
        ))}
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: ProjectAssignmentPatternMember }) {
  const monthEntries = Object.entries(member.monthly_percentages).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return (
    <div className="text-xs">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="font-mono text-gray-700">{member.user_id.slice(0, 8)}…</span>
        {member.is_past_member && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
            既存メンバー
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {monthEntries.map(([month, pct]) => (
          <span
            key={month}
            className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] border border-dashed border-indigo-200"
          >
            {formatMonth(month)}: {pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

function ConflictsSection({ conflicts }: { conflicts: ProjectAssignmentPatternConflict[] }) {
  if (conflicts.length === 0) return null;
  return (
    <div className="space-y-1 border-t border-amber-100 pt-2">
      <h4 className="text-xs font-medium text-amber-700 uppercase tracking-wider">
        割当競合 ({conflicts.length})
      </h4>
      <ul className="text-xs text-amber-800 space-y-0.5 max-h-24 overflow-y-auto">
        {conflicts.slice(0, 5).map((conflict, idx) => (
          <li key={`${conflict.user_id}-${conflict.month}-${idx}`} className="flex gap-1">
            <span className="font-mono">{conflict.user_id.slice(0, 8)}…</span>
            <span className="text-amber-700">{formatMonth(conflict.month)}</span>
            <span className="text-amber-600 truncate">{conflict.reason}</span>
          </li>
        ))}
        {conflicts.length > 5 && <li className="text-amber-600">…他 {conflicts.length - 5} 件</li>}
      </ul>
    </div>
  );
}

function AcceptButton({
  pattern,
  isAccepting,
  onAccept,
}: {
  pattern: ProjectAssignmentPattern;
  isAccepting: boolean;
  onAccept: (pattern: ProjectAssignmentPattern) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAccept(pattern)}
      disabled={isAccepting || pattern.members.length === 0}
      className="mt-auto px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isAccepting ? "登録中..." : "このパターンを採用"}
    </button>
  );
}

export const PatternCard = memo(PatternCardImpl);
