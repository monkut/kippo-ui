import { memo } from "react";
import type {
  ProjectAssignmentPattern,
  ProjectAssignmentPatternConflict,
  ProjectAssignmentPatternMember,
} from "~/lib/api/generated/models";
import { formatMonth } from "./utils";

type PatternCardProps = {
  pattern: ProjectAssignmentPattern;
  memberLookup: Map<string, string>;
  targetDate: string | null;
  isAccepting: boolean;
  onAccept: (pattern: ProjectAssignmentPattern) => void;
};

function PatternCardImpl({
  pattern,
  memberLookup,
  targetDate,
  isAccepting,
  onAccept,
}: PatternCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm flex flex-col gap-3 min-w-[320px] flex-1">
      <CardHeader pattern={pattern} targetDate={targetDate} />
      <MembersSection members={pattern.members} memberLookup={memberLookup} />
      <ConflictsSection conflicts={pattern.conflicts} memberLookup={memberLookup} />
      <AcceptButton pattern={pattern} isAccepting={isAccepting} onAccept={onAccept} />
    </div>
  );
}

function infeasibilityReason(
  pattern: ProjectAssignmentPattern,
  targetDate: string | null,
): string | null {
  if (!pattern.infeasible) return null;
  if (!pattern.estimated_completion) return "完了予測ができません";
  if (targetDate && pattern.estimated_completion > targetDate) {
    return `目標期日 (${targetDate}) を超過します — 予測 ${pattern.estimated_completion}`;
  }
  return "目標期日を超過します";
}

function CardHeader({
  pattern,
  targetDate,
}: {
  pattern: ProjectAssignmentPattern;
  targetDate: string | null;
}) {
  const reason = infeasibilityReason(pattern, targetDate);
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900">{pattern.label}</h3>
      <p className="text-xs text-gray-500 mt-0.5">{pattern.pattern_ids.join(" / ")}</p>
      <div className="mt-2 text-sm">
        <span className="text-gray-600">完了予測:</span>{" "}
        <span
          className={`font-medium ${reason ? "text-amber-700 underline decoration-dotted" : "text-gray-900"}`}
          title={reason ?? undefined}
        >
          {pattern.estimated_completion ?? "—"}
        </span>
      </div>
    </div>
  );
}

function lookupDisplayName(userId: string, memberLookup: Map<string, string>): string {
  return memberLookup.get(userId) ?? `${userId.slice(0, 8)}…`;
}

function MembersSection({
  members,
  memberLookup,
}: {
  members: ProjectAssignmentPatternMember[];
  memberLookup: Map<string, string>;
}) {
  if (members.length === 0) {
    return <p className="text-sm text-gray-500">メンバーが選定できませんでした。</p>;
  }
  const hasPastMember = members.some((m) => m.is_past_member);
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">提案メンバー</h4>
      <div className="space-y-1.5">
        {members.map((member) => (
          <MemberRow
            key={member.user_id}
            member={member}
            displayName={lookupDisplayName(member.user_id, memberLookup)}
          />
        ))}
      </div>
      {hasPastMember && <PastMemberLegend />}
    </div>
  );
}

function MemberRow({
  member,
  displayName,
}: {
  member: ProjectAssignmentPatternMember;
  displayName: string;
}) {
  const monthEntries = Object.entries(member.monthly_percentages).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const rowClassName = member.is_past_member
    ? "rounded-md p-1.5 bg-emerald-50 border border-emerald-100"
    : "rounded-md p-1.5";
  return (
    <div className={`text-xs ${rowClassName}`}>
      <div
        className={`font-medium mb-1 ${member.is_past_member ? "text-emerald-900" : "text-gray-900"}`}
      >
        {displayName}
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

function PastMemberLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 pt-1">
      <span className="inline-block w-3 h-3 rounded bg-emerald-50 border border-emerald-100" />
      既存メンバー
    </div>
  );
}

function ConflictsSection({
  conflicts,
  memberLookup,
}: {
  conflicts: ProjectAssignmentPatternConflict[];
  memberLookup: Map<string, string>;
}) {
  if (conflicts.length === 0) return null;
  return (
    <div className="space-y-1 border-t border-amber-100 pt-2">
      <h4 className="text-xs font-medium text-amber-700 uppercase tracking-wider">
        割当競合 ({conflicts.length})
      </h4>
      <ul className="text-xs text-amber-800 space-y-0.5 max-h-24 overflow-y-auto">
        {conflicts.slice(0, 5).map((conflict, idx) => (
          <li key={`${conflict.user_id}-${conflict.month}-${idx}`} className="flex gap-1">
            <span className="font-medium">{lookupDisplayName(conflict.user_id, memberLookup)}</span>
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
