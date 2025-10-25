import type { ReactNode } from "react";

import { InventoryCard } from "./inventory-card";
import type { InventoryItem } from "./types";
import { formatCurrency, formatQuantity } from "./utils";

export function ItemsGrid({
  items,
  toolbar,
  selectedIds,
  onToggleSelect,
  onStatusChange,
  onRequestTransfer,
}: {
  items: InventoryItem[];
  toolbar?: ReactNode;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onStatusChange?: (id: string, status: InventoryItem["status"]) => void;
  onRequestTransfer?: (id: string) => void;
}) {
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const totalValue = items.reduce((sum, item) => sum + item.retail * item.qty, 0);
  const online = items.filter((item) => item.channel !== "Storefront").length;
  const hasSelection = typeof onToggleSelect === "function";
  const hasActions = hasSelection || typeof onStatusChange === "function" || typeof onRequestTransfer === "function";

  return (
    <InventoryCard
      title="Items on hand"
      subtitle="Live snapshot of salable, serialized, and specialty inventory across the branch"
      action={
        <button className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300">
          Export CSV
        </button>
      }
    >
      <div className="space-y-4">
        {toolbar}
        <div className="grid gap-4 rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 text-xs text-slate-600 shadow-sm dark:border-slate-800/60 dark:from-slate-950/60 dark:to-slate-950/80 dark:text-slate-300 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">SKUs tracked</p>
            <p className="text-base font-semibold text-slate-900 dark:text-white">{items.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">Units on hand</p>
            <p className="text-base font-semibold text-slate-900 dark:text-white">{formatQuantity(totalQty)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">Retail value</p>
            <p className="text-base font-semibold text-emerald-600 dark:text-emerald-300">{formatCurrency(totalValue)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/60">
            {online} listed online
          </span>
          <span className="rounded-full border border-amber-400/60 bg-amber-50 px-3 py-1 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            {items.filter((item) => item.agedDays > 90).length} aged &gt; 90 days
          </span>
          <span className="rounded-full border border-sky-400/60 bg-sky-50 px-3 py-1 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200">
            {items.filter((item) => item.status === "pending_transfer").length} staging for transfer
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">
                {hasSelection ? <th className="py-2 pr-2 text-left">Sel.</th> : null}
                <th className="py-2 pr-4 text-left">SKU</th>
                <th className="py-2 pr-4 text-left">Item</th>
                <th className="py-2 pr-4 text-left">Location</th>
                <th className="py-2 pr-4 text-left">Channel</th>
                <th className="py-2 pr-4 text-right">Qty</th>
                <th className="py-2 pr-4 text-right">WAC</th>
                <th className="py-2 pr-4 text-right">Retail</th>
                <th className="py-2 text-right">Aging</th>
                {hasActions ? <th className="py-2 pl-2 text-right">Acciones</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-900/80 dark:text-slate-200">
              {items.map((item) => {
                const isSelected = selectedIds?.includes(item.id) ?? false;
                const nextStatus = item.status === "hold" ? "available" : "hold";

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-100 dark:hover:bg-slate-900/60 ${
                      isSelected ? "bg-slate-100/80 dark:bg-slate-900/60" : ""
                    }`}
                  >
                    {hasSelection ? (
                      <td className="py-3 pr-2 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${item.sku}`}
                          checked={isSelected}
                          onChange={() => onToggleSelect?.(item.id)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900"
                        />
                      </td>
                    ) : null}
                    <td className="py-3 pr-4 align-top font-mono text-xs text-slate-500 dark:text-slate-400">{item.sku}</td>
                    <td className="py-3 pr-4 align-top">
                      <div className="flex flex-col text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">{item.description}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{item.category}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 align-top text-sm text-slate-600 dark:text-slate-300">
                      <div className="flex flex-col">
                        <span>{item.location.name}</span>
                        <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">{item.location.kind}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 align-top text-sm text-slate-600 dark:text-slate-300">{item.channel}</td>
                    <td className="py-3 pr-4 align-top text-right text-sm">
                      {formatQuantity(item.qty)} {item.uom}
                    </td>
                    <td className="py-3 pr-4 align-top text-right text-sm text-slate-600 dark:text-slate-300">{formatCurrency(item.wac)}</td>
                    <td className="py-3 pr-4 align-top text-right text-sm text-emerald-600 dark:text-emerald-300">
                      {formatCurrency(item.retail)}
                    </td>
                    <td className="py-3 align-top text-right text-sm text-slate-500 dark:text-slate-400">{item.agedDays} days</td>
                    {hasActions ? (
                      <td className="py-3 pl-2 align-top">
                        <div className="flex flex-wrap justify-end gap-2 text-[11px]">
                          {typeof onStatusChange === "function" ? (
                            <button
                              onClick={() => onStatusChange(item.id, nextStatus)}
                              className="rounded-full border border-slate-300 px-2.5 py-1 text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300"
                            >
                              {nextStatus === "hold" ? "Poner en hold" : "Liberar"}
                            </button>
                          ) : null}
                          {typeof onRequestTransfer === "function" ? (
                            <button
                              onClick={() => onRequestTransfer(item.id)}
                              className="rounded-full border border-sky-400/70 px-2.5 py-1 text-sky-600 transition hover:border-sky-500/70 hover:text-sky-700 dark:border-sky-500/60 dark:text-sky-300"
                            >
                              Preparar traslado
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </InventoryCard>
  );
}
