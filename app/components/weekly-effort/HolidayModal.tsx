import { useEffect, useState } from "react";
import {
  personalHolidaysCreate,
  personalHolidaysList,
} from "~/lib/api/generated/personal-holidays/personal-holidays";
import { publicHolidaysList } from "~/lib/api/generated/public-holidays/public-holidays";
import type { PersonalHoliday, PublicHoliday } from "~/lib/api/generated/models";
import { HolidayCalendar } from "./HolidayCalendar";

type HolidayModalProps = {
  open: boolean;
  initialDate: string;
  onClose: () => void;
  onHolidayCreated: () => void;
};

export function HolidayModal({ open, initialDate, onClose, onHolidayCreated }: HolidayModalProps) {
  const [holidayDate, setHolidayDate] = useState(initialDate);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [isSubmittingHoliday, setIsSubmittingHoliday] = useState(false);
  const [holidayError, setHolidayError] = useState("");
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [existingPersonalHolidays, setExistingPersonalHolidays] = useState<PersonalHoliday[]>([]);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);

  const fetchHolidaysForMonth = async (dateStr: string) => {
    setIsLoadingHolidays(true);
    try {
      const date = new Date(`${dateStr}T00:00:00`);
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const dayGte = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, "0")}-01`;
      const dayLte = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

      const [personalRes, publicRes] = await Promise.all([
        personalHolidaysList({ day_gte: dayGte, day_lte: dayLte }),
        publicHolidaysList({ day_gte: dayGte, day_lte: dayLte }),
      ]);

      if (personalRes.data?.results) {
        setExistingPersonalHolidays(personalRes.data.results);
      }
      if (publicRes.data?.results) {
        setPublicHolidays(publicRes.data.results);
      }
    } catch {
      // Failed to fetch holidays, continue without them
    } finally {
      setIsLoadingHolidays(false);
    }
  };

  useEffect(() => {
    if (open) {
      setHolidayDate(initialDate);
      setIsHalfDay(false);
      setHolidayError("");
      setExistingPersonalHolidays([]);
      setPublicHolidays([]);
      fetchHolidaysForMonth(initialDate);
    }
  }, [open, initialDate]);

  const handleDateSelect = (date: string) => {
    setHolidayDate(date);
    const newMonth = date.substring(0, 7);
    const currentMonth = holidayDate.substring(0, 7);
    if (newMonth !== currentMonth) {
      fetchHolidaysForMonth(date);
    }
  };

  const handleSubmitHoliday = async () => {
    setIsSubmittingHoliday(true);
    setHolidayError("");

    try {
      await personalHolidaysCreate({
        day: holidayDate,
        is_half: isHalfDay,
      });
      onClose();
      onHolidayCreated();
    } catch {
      setHolidayError("休日の登録に失敗しました");
    } finally {
      setIsSubmittingHoliday(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-25" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">個人休日を追加</h3>

          {holidayError && (
            <div className="mb-4 rounded-md bg-red-50 p-3">
              <div className="text-sm text-red-800">{holidayError}</div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">日付を選択</label>
              {isLoadingHolidays ? (
                <div className="text-center py-4 text-gray-500">読み込み中...</div>
              ) : (
                <HolidayCalendar
                  selectedDate={holidayDate}
                  onDateSelect={handleDateSelect}
                  personalHolidays={existingPersonalHolidays}
                  publicHolidays={publicHolidays}
                  disabled={isSubmittingHoliday}
                />
              )}
            </div>

            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-red-100 border border-red-300" />
                <span className="text-gray-600">祝日</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-purple-100 border border-purple-300" />
                <span className="text-gray-600">個人休日</span>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is-half-day"
                checked={isHalfDay}
                onChange={(e) => setIsHalfDay(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                disabled={isSubmittingHoliday}
              />
              <label htmlFor="is-half-day" className="ml-2 block text-sm text-gray-700">
                半休
              </label>
            </div>
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isSubmittingHoliday}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSubmitHoliday}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmittingHoliday}
            >
              {isSubmittingHoliday ? "登録中..." : "登録"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
