import { memo, useMemo } from "react";
import type { PersonalHoliday, PublicHoliday } from "~/lib/api/generated/models";
import { formatDateStr } from "./utils";

type HolidayCalendarProps = {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  personalHolidays: PersonalHoliday[];
  publicHolidays: PublicHoliday[];
  disabled?: boolean;
};

const monthNames = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

// Calendar component for holiday selection with existing holidays highlighted
function HolidayCalendarImpl({
  selectedDate,
  onDateSelect,
  personalHolidays,
  publicHolidays,
  disabled,
}: HolidayCalendarProps) {
  const { year, month, weeks } = useMemo(() => {
    const date = new Date(`${selectedDate}T00:00:00`);
    const y = date.getFullYear();
    const m = date.getMonth();

    const firstDayOfMonth = new Date(y, m, 1);
    const lastDayOfMonth = new Date(y, m + 1, 0);

    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const endDate = new Date(lastDayOfMonth);
    const daysToSaturday = endDate.getDay() === 6 ? 0 : 6 - endDate.getDay();
    endDate.setDate(endDate.getDate() + daysToSaturday);

    const dates: Date[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const weekGroups: Date[][] = [];
    for (let i = 0; i < dates.length; i += 7) {
      weekGroups.push(dates.slice(i, i + 7));
    }

    return { year: y, month: m, weeks: weekGroups };
  }, [selectedDate]);

  const personalHolidayDates = useMemo(
    () => new Set(personalHolidays.map((h) => h.day)),
    [personalHolidays],
  );
  const publicHolidayDates = useMemo(
    () => new Set(publicHolidays.map((h) => h.day)),
    [publicHolidays],
  );
  const publicHolidayNames = useMemo(
    () => new Map(publicHolidays.map((h) => [h.day, h.name])),
    [publicHolidays],
  );

  const navigateMonth = (delta: number) => {
    const newDate = new Date(year, month + delta, 1);
    onDateSelect(formatDateStr(newDate));
  };

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => navigateMonth(-1)}
          className="p-1 hover:bg-gray-200 rounded"
          disabled={disabled}
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <title>前月</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <span className="font-medium text-gray-900">
          {year}年 {monthNames[month]}
        </span>
        <button
          type="button"
          onClick={() => navigateMonth(1)}
          className="p-1 hover:bg-gray-200 rounded"
          disabled={disabled}
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <title>次月</title>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((day, idx) => (
          <div
            key={day}
            className={`text-center text-xs font-medium py-1 ${
              idx === 0 ? "text-red-600" : idx === 6 ? "text-blue-600" : "text-gray-500"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 gap-1">
            {week.map((day) => {
              const dateStr = formatDateStr(day);
              const isCurrentMonth = day.getMonth() === month;
              const isSelected = dateStr === selectedDate;
              const isPersonalHoliday = personalHolidayDates.has(dateStr);
              const isPublicHoliday = publicHolidayDates.has(dateStr);
              const publicHolidayName = publicHolidayNames.get(dateStr);
              const dayOfWeek = day.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              let bgClass = "bg-white hover:bg-gray-100";
              let textClass = isCurrentMonth ? "text-gray-900" : "text-gray-300";

              if (isPublicHoliday && isCurrentMonth) {
                bgClass = "bg-red-100 hover:bg-red-200";
                textClass = "text-red-700";
              } else if (isPersonalHoliday && isCurrentMonth) {
                bgClass = "bg-purple-100 hover:bg-purple-200";
                textClass = "text-purple-700";
              } else if (isWeekend && isCurrentMonth) {
                textClass = dayOfWeek === 0 ? "text-red-500" : "text-blue-500";
              }

              if (isSelected) {
                bgClass = "bg-amber-500 hover:bg-amber-600";
                textClass = "text-white font-bold";
              }

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => onDateSelect(dateStr)}
                  disabled={disabled}
                  title={publicHolidayName || undefined}
                  className={`p-2 text-sm rounded ${bgClass} ${textClass} disabled:opacity-50`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 text-center text-sm text-gray-600">
        選択日: <span className="font-medium text-gray-900">{selectedDate}</span>
      </div>
    </div>
  );
}

export const HolidayCalendar = memo(HolidayCalendarImpl);
