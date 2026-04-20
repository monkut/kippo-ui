import { useState } from "react";
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
  if (costs === undefined || costs.length === 0) {
    return null;
  }

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

  const formatValue = (n: number) => formatCurrency(n, currency);

  return (
    <div className="pt-4 border-t border-gray-200">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Sparkline points={points} formatValue={formatValue} />
        <div className="flex gap-4">
          <CostStat label="今月" value={formatValue(currentMonth.total)} />
          <CostStat label="累計" value={formatValue(cumulative)} />
        </div>
      </div>
      <div className="text-xs text-gray-400 mt-1">インフラコスト</div>
    </div>
  );
}

function CostStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-700">{value}</div>
    </div>
  );
}

const TOOLTIP_HALF_WIDTH = 40;

interface SparklineProps {
  points: CostPoint[];
  formatValue: (value: number) => string;
  width?: number;
  height?: number;
}

function Sparkline({ points, formatValue, width = 120, height = 32 }: SparklineProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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

  const values = points.map((p) => p.total);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p.total - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const path = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const last = coords[coords.length - 1];

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round(x / stepX)));
    if (idx !== hoverIndex) setHoverIndex(idx);
  };

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const hoverCoord = hoverIndex !== null ? coords[hoverIndex] : null;

  return (
    <div className="relative inline-block">
      <svg
        width={width}
        height={height}
        aria-label="月次コスト推移"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
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
        {hoverCoord && (
          <circle
            cx={hoverCoord[0]}
            cy={hoverCoord[1]}
            r={3}
            fill="#4f46e5"
            stroke="#fff"
            strokeWidth={1}
          />
        )}
      </svg>
      {hoverPoint && hoverCoord && (
        <div
          className="absolute z-10 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg pointer-events-none whitespace-nowrap text-center"
          style={{
            left: Math.max(TOOLTIP_HALF_WIDTH, Math.min(width - TOOLTIP_HALF_WIDTH, hoverCoord[0])),
            bottom: height + 4,
            transform: "translateX(-50%)",
          }}
        >
          <div>{hoverPoint.month}</div>
          <div className="font-semibold">{formatValue(hoverPoint.total)}</div>
        </div>
      )}
    </div>
  );
}
