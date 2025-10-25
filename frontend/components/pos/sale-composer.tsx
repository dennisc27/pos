import { Barcode, CalendarClock, MoreHorizontal, ScanLine, Trash2 } from "lucide-react";
import { CartLine, SaleSummary } from "./types";
import { PosCard } from "./pos-card";
import { formatCurrency } from "./utils";

export function SaleComposer({
  items,
  summary,
  customerName
}: {
  items: CartLine[];
  summary: SaleSummary;
  customerName: string;
}) {
  return (
    <PosCard
      title="New sale"
      subtitle="Scan or search inventory, build the cart, and collect tender without leaving the keyboard"
      action={
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-emerald-400/60 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-500/60 hover:text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:border-emerald-400/60 dark:hover:text-emerald-200">
            Start layaway
          </button>
          <button className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700">
            Hold sale
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm dark:border-slate-800/80 dark:from-slate-950/60 dark:to-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 dark:text-slate-200">
              <ScanLine className="h-4 w-4 text-sky-500 dark:text-sky-400" />
              <input
                placeholder="Scan barcode or type item name..."
                className="flex-1 bg-transparent text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-500"
              />
            </div>
            <button className="hidden items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 md:flex">
              <Barcode className="h-4 w-4" />
              Manual add
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Online</span>
              <span>{customerName}</span>
            </div>
            <div className="flex items-center gap-2 text-sky-600 dark:text-sky-300">
              <CalendarClock className="h-3.5 w-3.5" />
              <span>Cutoff: 15 min to shift close</span>
            </div>
          </div>
        </div>
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const listUnit = item.listPrice ?? item.price;
            const lineSaleTotal = Math.max(item.price, 0) * item.qty;
            const listTotal = listUnit * item.qty;
            const discount = Math.max(0, listTotal - lineSaleTotal);
            const taxRate = item.taxRate ?? 0;
            const baseAmount = lineSaleTotal / (1 + taxRate);
            const taxAmount = lineSaleTotal - baseAmount;
            const lineTotal = lineSaleTotal;
            return (
              <li
                key={item.id}
                className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800/80 dark:from-slate-950/70 dark:to-slate-950/50 dark:text-slate-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-white">{item.name}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                        {item.sku}
                      </span>
                      {item.status ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                          {item.status}
                        </span>
                      ) : null}
                    </div>
                    {item.variant ? <p className="text-xs text-slate-500 dark:text-slate-400">{item.variant}</p> : null}
                    {item.note ? <p className="text-xs text-slate-500 dark:text-slate-400">{item.note}</p> : null}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>Qty {item.qty}</span>
                      <span>Unit {formatCurrency(item.price)}</span>
                      {discount > 0 ? (
                        <span className="text-rose-500 dark:text-rose-400">Discount {formatCurrency(discount)}</span>
                      ) : null}
                      {taxAmount > 0 ? (
                        <span className="text-sky-600 dark:text-sky-300">ITBIS {formatCurrency(taxAmount)}</span>
                      ) : null}
                      <span>Sub {formatCurrency(baseAmount)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-base font-semibold text-slate-900 dark:text-white">{formatCurrency(lineTotal)}</span>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <button className="rounded-lg border border-slate-300 px-2 py-1 transition hover:border-rose-400 hover:text-rose-500 dark:border-slate-800/80 dark:hover:border-rose-500/60 dark:hover:text-rose-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button className="rounded-lg border border-slate-300 px-2 py-1 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:hover:border-slate-700 dark:hover:text-white">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 text-sm text-slate-700 shadow-sm dark:border-slate-800/80 dark:from-slate-950/60 dark:to-slate-950/80 dark:text-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Subtotal</span>
            <span>{formatCurrency(summary.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-rose-500 dark:text-rose-400">
            <span>Discounts</span>
            <span>-{formatCurrency(summary.discounts)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-sky-600 dark:text-sky-300">
            <span>ITBIS</span>
            <span>{formatCurrency(summary.tax)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 text-base font-semibold text-slate-900 dark:text-white">
            <span>Total</span>
            <span>{formatCurrency(summary.total)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Balance due</span>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-300">{formatCurrency(summary.balanceDue)}</span>
          </div>
        </div>
      </div>
    </PosCard>
  );
}
