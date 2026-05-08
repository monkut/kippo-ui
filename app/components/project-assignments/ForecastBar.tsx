import { memo } from "react";
import type { ProjectForecastResponse } from "~/lib/api/generated/models";

type ForecastBarProps = {
  forecast: ProjectForecastResponse | null;
  forecastError: string;
};

function ForecastBarImpl({ forecast, forecastError }: ForecastBarProps) {
  if (forecastError) {
    return (
      <section className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-4">
        <div className="text-sm font-medium text-amber-800">完了予測</div>
        <div className="text-sm text-amber-700 mt-1">{forecastError}</div>
      </section>
    );
  }

  if (!forecast) {
    return (
      <section className="bg-white shadow rounded-lg p-4">
        <div className="text-sm font-medium text-gray-500">完了予測</div>
        <div className="text-sm text-gray-400 mt-1">読み込み中...</div>
      </section>
    );
  }

  return (
    <section className="bg-white shadow rounded-lg p-6">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            完了予測日
          </div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">
            {forecast.estimated_completion_date ?? "—"}
          </div>
        </div>
        {forecast.target_date && (
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              目標終了日
            </div>
            <div className="text-lg font-medium text-gray-700 mt-1">{forecast.target_date}</div>
          </div>
        )}
        <DeltaBadge delta={forecast.delta_from_target_date_days} />
      </div>
      {!forecast.estimated_completion_date && (
        <p className="text-xs text-gray-500 mt-3">
          将来の月次割当が登録されていないため、完了日を予測できません。
        </p>
      )}
    </section>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta === 0) {
    return <Badge tone="green">予定通り</Badge>;
  }
  if (delta > 0) {
    return <Badge tone="red">{delta}日遅れ</Badge>;
  }
  return <Badge tone="green">{-delta}日前倒し</Badge>;
}

function Badge({ tone, children }: { tone: "green" | "red"; children: React.ReactNode }) {
  const palette = tone === "green" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${palette}`}
    >
      {children}
    </span>
  );
}

export const ForecastBar = memo(ForecastBarImpl);
