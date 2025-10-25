import { InventoryCard } from "./inventory-card";
import type { ValueMetric } from "./types";
import { formatCurrency, trendAccent } from "./utils";

export function ValueSnapshot({ metrics }: { metrics: ValueMetric[] }) {
  return (
    <InventoryCard
      title="Inventory valuation"
      subtitle="Weighted average cost vs retail with online share"
      action={
        <button className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300">
          Export report
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 text-slate-700 shadow-sm dark:border-slate-800/60 dark:from-slate-950/60 dark:to-slate-950/80 dark:text-slate-200"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {formatCurrency(metric.amount, metric.currency)}
            </p>
            {metric.trend ? (
              <p className={`text-xs ${trendAccent(metric.trend.direction)}`}>{metric.trend.label}</p>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 text-xs text-slate-600 shadow-sm dark:border-slate-800/70 dark:from-slate-950/60 dark:to-slate-950/80 dark:text-slate-300">
        <p className="font-semibold text-slate-900 dark:text-white">Channel mix</p>
        <ul className="mt-3 space-y-2">
          <li className="flex items-center justify-between text-slate-700 dark:text-slate-200">
            <span>Storefront</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">62%</span>
          </li>
          <li className="flex items-center justify-between text-slate-700 dark:text-slate-200">
            <span>Digital listings (eBay/Amazon)</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">21%</span>
          </li>
          <li className="flex items-center justify-between text-slate-700 dark:text-slate-200">
            <span>Wholesale & consignments</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">11%</span>
          </li>
          <li className="flex items-center justify-between text-slate-700 dark:text-slate-200">
            <span>Pawn forfeitures staged</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">6%</span>
          </li>
        </ul>
      </div>
    </InventoryCard>
  );
}
