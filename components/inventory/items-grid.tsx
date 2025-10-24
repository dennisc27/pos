import { InventoryCard } from "./inventory-card";
import type { InventoryItem } from "./types";
import { formatCurrency, formatQuantity } from "./utils";

export function ItemsGrid({ items }: { items: InventoryItem[] }) {
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const totalValue = items.reduce((sum, item) => sum + item.retail * item.qty, 0);
  const online = items.filter((item) => item.channel !== "Storefront").length;

  return (
    <InventoryCard
      title="Items on hand"
      subtitle="Live snapshot of salable, serialized, and specialty inventory across the branch"
      action={<button className="rounded-full border border-slate-700 px-3 py-1 text-xs">Export CSV</button>}
    >
      <div className="grid gap-4 rounded-xl border border-slate-800/60 bg-slate-950/60 p-4 text-xs text-slate-300 sm:grid-cols-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">SKUs tracked</p>
          <p className="text-base font-semibold text-white">{items.length}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Units on hand</p>
          <p className="text-base font-semibold text-white">{formatQuantity(totalQty)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Retail value</p>
          <p className="text-base font-semibold text-emerald-400">{formatCurrency(totalValue)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
        <span className="rounded-full border border-slate-800/80 bg-slate-900/60 px-3 py-1">{online} listed online</span>
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1">
          {items.filter((item) => item.agedDays > 90).length} aged &gt; 90 days
        </span>
        <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1">
          {items.filter((item) => item.status === "pending_transfer").length} staging for transfer
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4 text-left">SKU</th>
              <th className="py-2 pr-4 text-left">Item</th>
              <th className="py-2 pr-4 text-left">Location</th>
              <th className="py-2 pr-4 text-left">Channel</th>
              <th className="py-2 pr-4 text-right">Qty</th>
              <th className="py-2 pr-4 text-right">WAC</th>
              <th className="py-2 pr-4 text-right">Retail</th>
              <th className="py-2 text-right">Aging</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/80 text-slate-200">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-900/60">
                <td className="py-3 pr-4 font-mono text-xs text-slate-400">{item.sku}</td>
                <td className="py-3 pr-4">
                  <div className="flex flex-col text-sm">
                    <span className="font-medium text-white">{item.description}</span>
                    <span className="text-[11px] text-slate-400">{item.category}</span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-sm text-slate-300">
                  <div className="flex flex-col">
                    <span>{item.location.name}</span>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">{item.location.kind}</span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-sm text-slate-300">{item.channel}</td>
                <td className="py-3 pr-4 text-right text-sm">
                  {formatQuantity(item.qty)} {item.uom}
                </td>
                <td className="py-3 pr-4 text-right text-sm text-slate-300">{formatCurrency(item.wac)}</td>
                <td className="py-3 pr-4 text-right text-sm text-emerald-300">
                  {formatCurrency(item.retail)}
                </td>
                <td className="py-3 text-right text-sm text-slate-400">{item.agedDays} days</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </InventoryCard>
  );
}
