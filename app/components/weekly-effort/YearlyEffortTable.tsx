import { memo } from "react";
import { formatHours, MONTHS_PER_YEAR, type YearlyEffortMatrix } from "~/lib/yearly-effort";

type YearlyEffortTableProps = {
  matrix: YearlyEffortMatrix;
  /** 0-based month to highlight (the current month when viewing the current year), or null. */
  highlightMonth: number | null;
};

const MONTH_INDEXES = Array.from({ length: MONTHS_PER_YEAR }, (_, m) => m);

/** Bottom rule of the sticky 月合計 row. Drawn as an inset shadow per cell because
 * table borders stay behind when a sticky <thead> scrolls (same as MonthlyAssignmentMatrix). */
const TOTALS_ROW_CELL_BORDER = "shadow-[inset_0_-2px_0_0_#d1d5db]";
const TOTAL_COL_CLASS = "border-l border-gray-200";

/** Tint a cell by its share of the busiest project-month, so heavy months read at a glance. */
function cellTintClass(hours: number, maxCellHours: number): string {
  if (hours === 0 || maxCellHours === 0) return "text-gray-300";
  const ratio = hours / maxCellHours;
  if (ratio >= 0.75) return "bg-indigo-200 text-indigo-900 font-medium";
  if (ratio >= 0.5) return "bg-indigo-100 text-indigo-900";
  if (ratio >= 0.25) return "bg-indigo-50 text-gray-800";
  return "text-gray-700";
}

function YearlyEffortTableImpl({ matrix, highlightMonth }: YearlyEffortTableProps) {
  const monthHeaderClass = (m: number) =>
    m === highlightMonth ? "text-indigo-700 font-semibold" : "text-gray-500 font-medium";

  return (
    <div className="overflow-auto max-h-[calc(100vh-18rem)]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-gray-200 text-xs">
            <th className="sticky left-0 z-20 bg-white py-2 pr-4 text-left font-medium text-gray-500">
              プロジェクト
            </th>
            {MONTH_INDEXES.map((m) => (
              <th
                key={m}
                className={`py-2 px-2 text-right whitespace-nowrap ${monthHeaderClass(m)}`}
              >
                {m + 1}月
              </th>
            ))}
            <th className={`py-2 pl-3 text-right font-medium text-gray-500 ${TOTAL_COL_CLASS}`}>
              年合計
            </th>
          </tr>
          <tr className="bg-gray-50 text-xs">
            <td
              className={`sticky left-0 z-20 bg-gray-50 py-2 pr-4 font-medium text-gray-500 ${TOTALS_ROW_CELL_BORDER}`}
            >
              月合計
            </td>
            {MONTH_INDEXES.map((m) => (
              <td
                key={m}
                className={`py-2 px-2 text-right tabular-nums font-medium ${TOTALS_ROW_CELL_BORDER} ${m === highlightMonth ? "text-indigo-700" : "text-gray-700"}`}
              >
                {formatHours(matrix.monthTotals[m])}
              </td>
            ))}
            <td
              className={`py-2 pl-3 text-right tabular-nums font-semibold text-gray-900 ${TOTALS_ROW_CELL_BORDER} ${TOTAL_COL_CLASS}`}
            >
              {formatHours(matrix.grandTotal)}
            </td>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.projectId} className="group border-b border-gray-100 last:border-0">
              <td className="sticky left-0 bg-white group-hover:bg-gray-50 py-2 pr-4 text-gray-700 min-w-[12rem] max-w-[20rem] truncate">
                <span title={row.projectName}>{row.projectName}</span>
              </td>
              {MONTH_INDEXES.map((m) => (
                <td
                  key={m}
                  className={`py-2 px-2 text-right tabular-nums ${cellTintClass(row.monthHours[m], matrix.maxCellHours)}`}
                  title={
                    row.monthHours[m] > 0
                      ? `${row.projectName} ${m + 1}月: ${formatHours(row.monthHours[m])} 時間`
                      : undefined
                  }
                >
                  {formatHours(row.monthHours[m])}
                </td>
              ))}
              <td
                className={`py-2 pl-3 text-right tabular-nums font-medium text-gray-900 group-hover:bg-gray-50 ${TOTAL_COL_CLASS}`}
              >
                {formatHours(row.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const YearlyEffortTable = memo(YearlyEffortTableImpl);
