const peso = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

export function formatCurrency(value: number) {
  return peso.format(value);
}

export function formatPercent(value: number) {
  return percent.format(value);
}

export function trendColor(trend: "up" | "down" | "flat") {
  if (trend === "up") return "text-emerald-600 dark:text-emerald-300";
  if (trend === "down") return "text-rose-500 dark:text-rose-300";
  return "text-slate-600 dark:text-slate-400";
}
