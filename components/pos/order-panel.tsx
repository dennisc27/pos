import { CalendarClock, CreditCard, MoreHorizontal, Trash2, UserCircle2 } from "lucide-react";
import { PosCard } from "./pos-card";
import { formatCurrency } from "./utils";
import type { CartLine, SaleSummary, TenderBreakdown } from "./types";

export function OrderPanel({
  items,
  summary,
  tenders,
  customerName,
  ticketId
}: {
  items: CartLine[];
  summary: SaleSummary;
  tenders: TenderBreakdown[];
  customerName: string;
  ticketId: string;
}) {
  return (
    <PosCard
      title="New order"
      subtitle="Review products in the cart, apply payments, and complete the sale"
      className="h-full"
      action={
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
            Ticket {ticketId}
          </span>
          <CalendarClock className="h-4 w-4 text-sky-300" />
          <span>15 min to cutoff</span>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/70 px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-slate-200">
            <UserCircle2 className="h-5 w-5 text-slate-400" />
            <div className="leading-tight">
              <p className="font-medium text-white">{customerName}</p>
              <p className="text-xs text-slate-500">Walk-in customer</p>
            </div>
          </div>
          <button className="rounded-lg border border-slate-800/80 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-700 hover:text-slate-100">
            Change
          </button>
        </div>
        <div className="space-y-3">
          {items.map((item) => {
            const lineSubtotal = item.qty * item.price;
            const discount = item.discount ?? 0;
            const taxRate = item.taxRate ?? 0;
            const taxAmount = (lineSubtotal - discount) * taxRate;
            const lineTotal = lineSubtotal - discount + taxAmount;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800/80 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">{item.name}</span>
                      <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                        {item.sku}
                      </span>
                      {item.status ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                          {item.status}
                        </span>
                      ) : null}
                    </div>
                    {item.variant ? <p className="text-xs text-slate-400">{item.variant}</p> : null}
                    {item.note ? <p className="text-xs text-slate-500">{item.note}</p> : null}
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <span className="text-sm font-semibold text-white">{formatCurrency(lineTotal)}</span>
                    <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-500">
                      <span>Qty {item.qty}</span>
                      <span>Unit {formatCurrency(item.price)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    {discount > 0 ? <span className="text-rose-400">Disc {formatCurrency(discount)}</span> : null}
                    {taxAmount > 0 ? <span className="text-sky-300">ITBIS {formatCurrency(taxAmount)}</span> : null}
                    <span className="text-slate-500">Balance {formatCurrency(lineTotal)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="rounded-lg border border-slate-800/80 px-2 py-1 transition hover:border-rose-500/60 hover:text-rose-300">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button className="rounded-lg border border-slate-800/80 px-2 py-1 transition hover:border-slate-700 hover:text-white">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 text-sm text-slate-200">
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
            <span>Grand total</span>
            <span>{formatCurrency(summary.total)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Balance due</span>
            <span className="text-sm font-medium text-emerald-400">{formatCurrency(summary.balanceDue)}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
            <span>Payment method</span>
            <button className="text-sky-300 hover:text-sky-200">Add method</button>
          </div>
          <div className="space-y-2">
            {tenders.map((tender) => (
              <div
                key={tender.method}
                className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/70 px-3 py-3 text-sm text-slate-200"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-slate-500" />
                  <div className="leading-tight">
                    <p className="font-medium text-white">{tender.label}</p>
                    <p className="text-xs text-slate-500">
                      {tender.status === "captured"
                        ? "Captured"
                        : tender.status === "pending"
                          ? "Awaiting confirmation"
                          : "Offline authorization"}
                      {tender.reference ? ` · ${tender.reference}` : ""}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-white">{formatCurrency(tender.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="flex-1 rounded-lg border border-slate-800/80 bg-slate-950/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-700 hover:text-white">
            Hold
          </button>
          <button className="flex-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-300 transition hover:border-rose-400/70 hover:text-rose-200">
            Void
          </button>
          <button className="flex-1 rounded-lg border border-sky-500/60 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-400/80 hover:text-white">
            Payment
          </button>
        </div>
      </div>
    </PosCard>
  );
}
