import { InventoryCard } from "./inventory-card";
import type { ValueMetric } from "./types";
import { formatCurrency, trendAccent } from "./utils";

export function ValueSnapshot({ metrics }: { metrics: ValueMetric[] }) {
  return (
    <InventoryCard
      title="Inventory valuation"
      subtitle="Weighted average cost vs retail with online share"
      action={<button className="rounded-full border border-slate-700 px-3 py-1 text-xs">Export report</button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(metric.amount, metric.currency)}</p>
            {metric.trend ? (
              <p className={`text-xs ${trendAccent(metric.trend.direction)}`}>{metric.trend.label}</p>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-slate-800/70 bg-slate-900/40 p-4 text-xs text-slate-300">
        <p className="font-semibold text-white">Channel mix</p>
        <ul className="mt-3 space-y-2">
          <li className="flex items-center justify-between">
            <span>Storefront</span>
            <span className="text-slate-100">62%</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Digital listings (eBay/Amazon)</span>
            <span className="text-slate-100">21%</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Wholesale & consignments</span>
            <span className="text-slate-100">11%</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Pawn forfeitures staged</span>
            <span className="text-slate-100">6%</span>
          </li>
        </ul>
      </div>
    </InventoryCard>
  );
}
