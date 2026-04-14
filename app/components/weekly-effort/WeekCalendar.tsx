import { memo, useMemo } from "react";
import type { PersonalHoliday, PublicHoliday } from "~/lib/api/generated/models";
import { formatDateStr } from "./utils";

type WeekCalendarProps = {
  weekStart: string;
  onWeekSelect: (date: string) => void;
  personalHolidays?: PersonalHoliday[];
  publicHolidays?: PublicHoliday[];
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

// Calendar component to display the month with selected week highlighted
// Weeks start on Sunday to match standard calendar display
function WeekCalendarImpl({
  weekStart,
  onWeekSelect,
  personalHolidays = [],
  publicHolidays = [],
}: WeekCalendarProps) {
  const { year, month, weeks } = useMemo(() => {
    const selectedDate = new Date(weekStart);
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();

    const firstDayOfMonth = new Date(y, m, 1);
    const lastDayOfMonth = new Date(y, m + 1, 0);

    const startDate = new Date(firstDayOfMonth);
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const endDate = new Date(lastDayOfMonth);
    const lastDayOfWeek = endDate.getDay();
    const daysToSaturday = lastDayOfWeek === 6 ? 0 : 6 - lastDayOfWeek;
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
  }, [weekStart]);

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

  const isInSelectedWeek = (date: Date): boolean => {
    const dateStr = formatDateStr(date);
    const weekStartDate = new Date(`${weekStart}T00:00:00`);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    return dateStr >= formatDateStr(weekStartDate) && dateStr <= formatDateStr(weekEndDate);
  };

  const getMondayOfWeek = (date: Date): string => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? 1 : day === 1 ? 0 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split("T")[0];
  };

  return (
    <div className="bg-white rounded-lg">
      <div className="text-center font-medium text-gray-900 mb-3">
        {year}年 {monthNames[month]}
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
        {weeks.map((week, weekIdx) => {
          const weekMonday = getMondayOfWeek(week[1]);
          const isSelectedWeek = isInSelectedWeek(week[1]);

          return (
            <button
              key={weekIdx}
              type="button"
              onClick={() => onWeekSelect(weekMonday)}
              className={`grid grid-cols-7 gap-1 w-full rounded-md transition-colors ${
                isSelectedWeek ? "bg-indigo-100 ring-2 ring-indigo-500" : "hover:bg-gray-50"
              }`}
            >
              {week.map((date, dayIdx) => {
                const isCurrentMonth = date.getMonth() === month;
                const isToday = date.toDateString() === new Date().toDateString();
                const dateStr = formatDateStr(date);
                const isPublicHoliday = publicHolidayDates.has(dateStr);
                const isPersonalHoliday = personalHolidayDates.has(dateStr);
                const holidayName = publicHolidayNames.get(dateStr);

                let textClass = "text-gray-700";
                let bgClass = "";

                if (!isCurrentMonth) {
                  textClass = "text-gray-300";
                } else if (isPublicHoliday) {
                  textClass = "text-red-700 font-medium";
                  bgClass = "bg-red-100 rounded";
                } else if (isPersonalHoliday) {
                  textClass = "text-purple-700 font-medium";
                  bgClass = "bg-purple-100 rounded";
                } else if (isToday) {
                  textClass = "font-bold text-indigo-600";
                } else if (dayIdx === 0) {
                  textClass = "text-red-600";
                } else if (dayIdx === 6) {
                  textClass = "text-blue-600";
                }

                return (
                  <div
                    key={dayIdx}
                    className={`text-center text-sm py-1.5 ${textClass} ${bgClass}`}
                    title={holidayName || undefined}
                  >
                    {date.getDate()}
                  </div>
                );
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const WeekCalendar = memo(WeekCalendarImpl);
