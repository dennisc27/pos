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
        <button className="rounded-lg border border-slate-800/80 bg-slate-900 px-3 py-1 font-medium text-xs text-slate-200 hover:border-slate-700">
          Hold sale
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900 px-3 py-2 text-sm text-slate-200">
              <ScanLine className="h-4 w-4 text-sky-400" />
              <input
                placeholder="Scan barcode or type item name..."
                className="flex-1 bg-transparent placeholder:text-slate-500 focus:outline-none"
              />
            </div>
            <button className="hidden items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-700 hover:text-white md:flex">
              <Barcode className="h-4 w-4" />
              Manual add
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-400">Online</span>
              <span>{customerName}</span>
            </div>
            <div className="flex items-center gap-2 text-sky-300">
              <CalendarClock className="h-3.5 w-3.5" />
              <span>Cutoff: 15 min to shift close</span>
            </div>
          </div>
        </div>
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const lineSubtotal = item.qty * item.price;
            const discount = item.discount ?? 0;
            const taxRate = item.taxRate ?? 0;
            const taxAmount = (lineSubtotal - discount) * taxRate;
            const lineTotal = lineSubtotal - discount + taxAmount;
            return (
              <li
                key={item.id}
                className="rounded-xl border border-slate-800/80 bg-slate-950/70 px-4 py-3 text-sm text-slate-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">{item.name}</span>
                      <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                        {item.sku}
                      </span>
                      {item.status ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-400">
                          {item.status}
                        </span>
                      ) : null}
                    </div>
                    {item.variant ? <p className="text-xs text-slate-400">{item.variant}</p> : null}
                    {item.note ? <p className="text-xs text-slate-500">{item.note}</p> : null}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>Qty {item.qty}</span>
                      <span>Unit {formatCurrency(item.price)}</span>
                      {discount > 0 ? <span className="text-rose-400">Discount {formatCurrency(discount)}</span> : null}
                      {taxAmount > 0 ? <span className="text-sky-300">ITBIS {formatCurrency(taxAmount)}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-base font-semibold text-white">{formatCurrency(lineTotal)}</span>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <button className="rounded-lg border border-slate-800/80 px-2 py-1 transition hover:border-rose-500/60 hover:text-rose-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button className="rounded-lg border border-slate-800/80 px-2 py-1 transition hover:border-slate-700 hover:text-white">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-2 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 text-sm text-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Subtotal</span>
            <span>{formatCurrency(summary.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-rose-400">
            <span>Discounts</span>
            <span>-{formatCurrency(summary.discounts)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-sky-300">
            <span>ITBIS</span>
            <span>{formatCurrency(summary.tax)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 text-base font-semibold text-white">
            <span>Total</span>
            <span>{formatCurrency(summary.total)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Balance due</span>
            <span className="text-sm font-medium text-emerald-400">{formatCurrency(summary.balanceDue)}</span>
          </div>
        </div>
      </div>
    </PosCard>
  );
}
