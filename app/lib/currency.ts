// Shared JPY formatter. `¥1,234,567`, or "-" for empty / non-numeric input.
export function formatJpy(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "number" ? value : Number(value);
  return Number.isNaN(n) ? "-" : `¥${n.toLocaleString("ja-JP")}`;
}
