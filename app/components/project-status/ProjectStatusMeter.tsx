import type { ProjectProgressStatusInline } from "~/lib/api/generated";

// Threshold for "exceeding expected" status (same as backend PROJECT_STATUS_REPORT_EXCEEDING_THRESHOLD)
// TODO: read the meter level from the API (projectstatus_display.level) once the kippo release
// that adds it is out, and drop this mirrored constant (kiconiaworks/kippo#78).
export const EXCEEDING_THRESHOLD = 15;

/**
 * Bar fill for the 稼働状況 meter: consumed effort over max(予算, consumed) — i.e. the budget
 * ratio, capped at 100% once the project goes over budget.
 *
 * Mirrors the admin's `<meter value=current_effort_hours max=max(allocated, current)>`
 * (KippoProjectBaseAdmin.get_projectstatus_display). Returns 0 when nothing is logged.
 */
export function meterFillPercentage(
  currentEffortHours: number | null | undefined,
  allocatedEffortHours: number,
): number {
  const current = currentEffortHours ?? 0;
  if (current <= 0) return 0;
  const max = Math.max(allocatedEffortHours, current);
  return (current / max) * 100;
}

/** Marker appended to a 予算 value derived from a 納品/固定 contract rather than entered as 割当人日. */
export const ESTIMATED_MARKER = "*";

/**
 * Tooltip for the 予算 legend value.
 *
 * A project with no 割当人日 but a 納品/固定 contract gets its budget estimated from the contract
 * amount (kippo: KippoProject.estimated_allocated_effort_hours), so the derivation the tooltip
 * names has to follow which of the two produced the number. The estimated text leads with the
 * same ESTIMATED_MARKER shown beside the value, so hovering explains what the marker means.
 */
export function allocatedEffortHoursTitle(isEstimated: boolean | undefined): string {
  if (isEstimated) {
    return (
      `${ESTIMATED_MARKER} 予算(見積): 割当人日が未入力のため、納品/固定契約の契約金額から算出した推定値です` +
      "（契約金額 ÷ 人日単価 × 1日の稼働時間）"
    );
  }
  return "予算: プロジェクト全体の予算工数（割当人日 × 1日の稼働時間）";
}

interface ProjectStatusMeterProps {
  status: ProjectProgressStatusInline | null;
}

export function ProjectStatusMeter({ status }: ProjectStatusMeterProps) {
  if (!status) {
    return <div className="text-gray-400">-</div>;
  }

  const {
    current_effort_hours,
    expected_effort_hours,
    allocated_effort_hours,
    is_estimated_allocated_effort_hours,
    difference_percentage,
  } = status;

  // If no expected hours, just show the current hours
  if (!expected_effort_hours || !allocated_effort_hours) {
    if (current_effort_hours) {
      return <div className="text-2xl font-semibold text-gray-600">{current_effort_hours}h</div>;
    }
    return <div className="text-gray-400">-</div>;
  }

  // Determine color based on difference percentage
  const getTextColor = () => {
    if (difference_percentage === null || difference_percentage === undefined) {
      return "text-gray-600";
    }
    if (difference_percentage > EXCEEDING_THRESHOLD) return "text-red-600";
    if (difference_percentage > 0) return "text-yellow-600";
    return "text-green-600";
  };

  // Get background color for meter (matches text color)
  const getMeterColor = () => {
    if (difference_percentage === null || difference_percentage === undefined) {
      return "bg-gray-400";
    }
    if (difference_percentage > EXCEEDING_THRESHOLD) return "bg-red-500";
    if (difference_percentage > 0) return "bg-yellow-500";
    return "bg-green-500";
  };

  const formatDifferencePercentage = () => {
    if (difference_percentage === null || difference_percentage === undefined) {
      return null;
    }
    const sign = difference_percentage > 0 ? "+" : "";
    return `${sign}${Math.round(difference_percentage)}%`;
  };

  return (
    <div className="space-y-2">
      {/* Hours display */}
      <div className={`text-2xl font-semibold ${getTextColor()}`}>{current_effort_hours ?? 0}h</div>

      {/* Difference percentage */}
      {formatDifferencePercentage() && (
        <div className={`text-sm ${getTextColor()}`}>{formatDifferencePercentage()}</div>
      )}

      {/* Progress bar — consumed effort, matching the admin's
          <meter value=current max=max(allocated, current)>. Because max grows to current once
          effort exceeds 予算, the fill is effectively min(current/予算, 1): an over-budget project
          renders the same full bar as one exactly on budget. What distinguishes the two is the
          colour and the ±% above, both driven by difference_percentage (effort vs. SCHEDULE) —
          not by this fill, whose denominator is the budget. */}
      <div className="flex justify-center">
        <div
          className={`w-48 h-6 bg-gray-200 rounded-full overflow-hidden ${
            is_estimated_allocated_effort_hours ? "border border-dashed border-gray-400" : ""
          }`}
        >
          <div
            className={`h-full ${getMeterColor()} transition-all duration-300`}
            style={{
              width: `${meterFillPercentage(current_effort_hours, allocated_effort_hours)}%`,
            }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="text-xs text-gray-500">
        <span title="予定: 現在日までに消化されているべき工数（線形進捗に基づく）">
          {Math.round(expected_effort_hours)}h
        </span>
        {" / "}
        <span
          className={is_estimated_allocated_effort_hours ? "cursor-help" : undefined}
          title={allocatedEffortHoursTitle(is_estimated_allocated_effort_hours)}
        >
          {allocated_effort_hours}h
          {is_estimated_allocated_effort_hours ? (
            /* <abbr> carries the explanation to assistive tech and on keyboard focus, not only
               to a mouse hover; tabIndex makes the marker reachable without a pointer. */
            <abbr
              tabIndex={0}
              className="font-semibold text-gray-600 no-underline"
              title={allocatedEffortHoursTitle(true)}
            >
              <sup>{ESTIMATED_MARKER}</sup>
            </abbr>
          ) : null}
        </span>
      </div>
    </div>
  );
}
