import { useState } from "react";
import { Link } from "react-router";
import { Layout } from "~/components/layout";
import { YearlyEffortTable } from "~/components/weekly-effort/YearlyEffortTable";
import { useAuthGate } from "~/hooks/useAuthGate";
import { useYearlyEffort } from "~/hooks/useYearlyEffort";
import { formatHours } from "~/lib/yearly-effort";

const PAGE_TITLE = "KIPPO 年間稼働実績";
const PAGER_BUTTON_CLASS =
  "px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white";

export function meta() {
  return [{ title: "年間稼働実績 - Kippo" }];
}

export default function YearlyEffort() {
  const { user, authLoading } = useAuthGate();
  const now = new Date();
  const currentYear = now.getFullYear();
  const [year, setYear] = useState(currentYear);

  // Hooks above the early returns — React #310 (see weekly-effort.tsx).
  const { isLoading, error, matrix } = useYearlyEffort(year, user?.username, !!user);

  if (authLoading) {
    return (
      <Layout title={PAGE_TITLE}>
        <div className="flex justify-center items-center h-64">読み込み中...</div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  const isCurrentYear = year === currentYear;

  return (
    <Layout title={PAGE_TITLE}>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="bg-white shadow rounded-lg p-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setYear(year - 1)}
            className={PAGER_BUTTON_CLASS}
            aria-label="前の年"
          >
            ◀
          </button>
          <span className="text-lg font-semibold text-gray-900 min-w-[5rem] text-center tabular-nums">
            {year}年
          </span>
          <button
            type="button"
            onClick={() => setYear(year + 1)}
            disabled={isCurrentYear}
            className={PAGER_BUTTON_CLASS}
            aria-label="次の年"
          >
            ▶
          </button>
          {!isCurrentYear && (
            <button
              type="button"
              onClick={() => setYear(currentYear)}
              className="px-3 py-1.5 text-sm font-medium text-indigo-700 bg-white border border-indigo-300 rounded-md hover:bg-indigo-50"
            >
              今年へ戻る
            </button>
          )}
          <Link
            to="/weekly-effort"
            className="ml-auto text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            週間稼働量に戻る
          </Link>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        <section className="bg-white shadow rounded-lg p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
            <h2 className="text-lg font-medium text-gray-900">プロジェクト別 月次稼働</h2>
            {!isLoading && matrix.rows.length > 0 && (
              <span className="text-sm text-gray-500 tabular-nums whitespace-nowrap">
                年合計 {formatHours(matrix.grandTotal)} 時間
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-48 text-gray-500">読み込み中...</div>
          ) : matrix.rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              {year}年の登録済み稼働はありません。
            </div>
          ) : (
            <>
              <YearlyEffortTable
                matrix={matrix}
                highlightMonth={isCurrentYear ? now.getMonth() : null}
              />
              <p className="mt-4 text-xs text-gray-500">
                単位は時間。各週の稼働は週開始日（月曜）の月に集計しています。
              </p>
            </>
          )}
        </section>
      </div>
    </Layout>
  );
}
