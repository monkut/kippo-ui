import { monthlyCostsList, type ProjectMonthlyCost } from "~/lib/api/generated";

export type { ProjectMonthlyCost };

export async function fetchAllMonthlyCostsForProject(
  projectId: string,
): Promise<ProjectMonthlyCost[]> {
  const rows: ProjectMonthlyCost[] = [];
  let page = 1;
  while (true) {
    try {
      const resp = await monthlyCostsList({ project: projectId, page });
      if (resp.data?.results) rows.push(...resp.data.results);
      if (!resp.data?.next) break;
      page += 1;
    } catch {
      break;
    }
  }
  return rows;
}

interface InfraCostDisplayProps {
  costs: ProjectMonthlyCost[] | undefined;
}

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

interface CostPoint {
  month: string;
  total: number;
}

function aggregateMonthTotals(costs: ProjectMonthlyCost[]): CostPoint[] {
  const monthTotals = new Map<string, number>();
  for (const row of costs) {
    if (!row.month) continue;
    monthTotals.set(row.month, (monthTotals.get(row.month) ?? 0) + Number(row.cost));
  }
  return Array.from(monthTotals.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function InfraCostDisplay({ costs }: InfraCostDisplayProps) {
  if (costs === undefined) {
    return null;
  }
  if (costs.length === 0) {
    return (
      <div className="pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          インフラコスト: <span className="text-gray-400">-</span>
        </div>
      </div>
    );
  }

  // Mixed-currency check - fail loud per issue spec
  const currencies = new Set(costs.map((c) => c.currency || "USD"));
  if (currencies.size > 1) {
    return (
      <div className="pt-4 border-t border-gray-200">
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
          ⚠ インフラコスト: 通貨が混在しているため合計を表示できません (
          {Array.from(currencies).join(", ")})
        </div>
      </div>
    );
  }

  const currency = costs[0].currency || "USD";
  const points = aggregateMonthTotals(costs);

  if (points.length === 0) {
    return null;
  }

  const cumulative = points.reduce((sum, p) => sum + p.total, 0);
  const currentMonth = points[points.length - 1];

  return (
    <div className="pt-4 border-t border-gray-200">
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <div className="text-left">
          <div className="text-xs text-gray-500">今月</div>
          <div className="text-sm font-semibold text-gray-700">
            {formatCurrency(currentMonth.total, currency)}
          </div>
        </div>
        <Sparkline points={points.map((p) => p.total)} />
        <div className="text-left">
          <div className="text-xs text-gray-500">累計</div>
          <div className="text-sm font-semibold text-gray-700">
            {formatCurrency(cumulative, currency)}
          </div>
        </div>
      </div>
      <div className="text-xs text-gray-400 mt-1">インフラコスト</div>
    </div>
  );
}

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
}

function Sparkline({ points, width = 120, height = 32 }: SparklineProps) {
  if (points.length === 0) {
    return null;
  }
  if (points.length === 1) {
    return (
      <svg width={width} height={height} aria-label="月次コスト推移">
        <title>月次コスト推移</title>
        <circle cx={width / 2} cy={height / 2} r={3} fill="#4f46e5" />
      </svg>
    );
  }

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);

  const coords = points.map((value, i) => {
    const x = i * stepX;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const path = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const last = coords[coords.length - 1];

  return (
    <svg width={width} height={height} aria-label="月次コスト推移">
      <title>月次コスト推移</title>
      <path
        d={path}
        fill="none"
        stroke="#4f46e5"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2} fill="#4f46e5" />
    </svg>
  );
}
