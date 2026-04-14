import { memo } from "react";

type MissingWeeksPanelProps = {
  missingWeeks: string[];
  onWeekSelect: (week: string) => void;
};

function MissingWeeksPanelImpl({ missingWeeks, onWeekSelect }: MissingWeeksPanelProps) {
  if (missingWeeks.length === 0) return null;

  return (
    <section className="bg-white shadow rounded-lg p-6 border-l-4 border-amber-400">
      <h2 className="text-lg font-medium text-gray-900 mb-4">
        未入力の週
        <span className="ml-2 text-sm font-normal text-amber-600">({missingWeeks.length}件)</span>
      </h2>
      <div className="flex flex-wrap gap-2">
        {missingWeeks.map((week) => (
          <button
            key={week}
            type="button"
            onClick={() => onWeekSelect(week)}
            className="px-3 py-1.5 text-sm bg-amber-50 text-amber-800 rounded-md hover:bg-amber-100 border border-amber-200"
          >
            {week}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-3">
        週開始日をクリックすると、その週の入力フォームに移動します
      </p>
    </section>
  );
}

export const MissingWeeksPanel = memo(MissingWeeksPanelImpl);
