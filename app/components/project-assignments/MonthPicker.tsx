import { memo } from "react";
import { addMonths, firstOfMonth, formatMonth } from "./utils";

type MonthPickerProps = {
  month: string; // first-of-month ISO date "YYYY-MM-01"
  onChange: (month: string) => void;
};

function MonthPickerImpl({ month, onChange }: MonthPickerProps) {
  const currentMonth = firstOfMonth(new Date());
  const isCurrentMonth = month === currentMonth;

  return (
    <div className="bg-white shadow rounded-lg p-4 flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(addMonths(month, -1))}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
        aria-label="前の月"
      >
        ◀
      </button>
      <span className="text-lg font-semibold text-gray-900 min-w-[7rem] text-center">
        {formatMonth(month)}
      </span>
      <button
        type="button"
        onClick={() => onChange(addMonths(month, 1))}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
        aria-label="次の月"
      >
        ▶
      </button>
      {!isCurrentMonth && (
        <button
          type="button"
          onClick={() => onChange(currentMonth)}
          className="ml-auto px-3 py-1.5 text-sm font-medium text-indigo-700 bg-white border border-indigo-300 rounded-md hover:bg-indigo-50"
        >
          今月へ戻る
        </button>
      )}
    </div>
  );
}

export const MonthPicker = memo(MonthPickerImpl);
