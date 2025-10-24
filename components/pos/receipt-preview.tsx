import { Printer, QrCode } from "lucide-react";
import { CartLine, SaleSummary, TenderBreakdown } from "./types";
import { PosCard } from "./pos-card";
import { formatCurrency } from "./utils";

export function ReceiptPreview({
  items,
  summary,
  tenders
}: {
  items: CartLine[];
  summary: SaleSummary;
  tenders: TenderBreakdown[];
}) {
  return (
    <PosCard
      title="Receipt preview"
      subtitle="Confirm the fiscal receipt before printing or sending via WhatsApp"
      action={
        <button className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-white">
          <Printer className="h-3.5 w-3.5" />
          Print & kick drawer
        </button>
      }
    >
      <div className="space-y-4 rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 text-xs text-slate-600 shadow-sm dark:border-slate-800/80 dark:from-slate-950/60 dark:to-slate-950/80 dark:text-slate-300">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span>Receipt #R-20451</span>
          <span>Branch: Santo Domingo</span>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-slate-700 dark:text-slate-200">{item.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-500">
                  {item.qty} x {formatCurrency(item.price)} {item.discount ? `(-${formatCurrency(item.discount)})` : ""}
                </p>
              </div>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {formatCurrency(item.qty * item.price - (item.discount ?? 0))}
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-1 pt-2">
          <div className="flex items-center justify-between">
            <span>Subtotal (incl. ITBIS)</span>
            <span>{formatCurrency(summary.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-rose-500 dark:text-rose-300">
            <span>Discounts</span>
            <span>-{formatCurrency(summary.discounts)}</span>
          </div>
          <div className="flex items-center justify-between text-sky-600 dark:text-sky-300">
            <span>ITBIS included</span>
            <span>{formatCurrency(summary.tax)}</span>
          </div>
          <div className="flex items-center justify-between pt-1 text-sm font-semibold text-slate-900 dark:text-white">
            <span>Total</span>
            <span>{formatCurrency(summary.total)}</span>
          </div>
        </div>
        <div className="space-y-1 pt-2">
          {tenders.map((tender) => (
            <div key={tender.id} className="flex items-center justify-between text-slate-700 dark:text-slate-200">
              <span>{tender.label}</span>
              <span>{formatCurrency(tender.amount)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-[11px] text-slate-500 dark:border-slate-800/60 dark:text-slate-500">
          <span>Attended by Maria P.</span>
          <span>Customer copy</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-[11px] text-slate-600 transition dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-slate-400">
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-200">Whatsapp send</p>
            <p className="text-slate-500 dark:text-slate-400">829-555-0101</p>
          </div>
          <QrCode className="h-12 w-12 text-slate-500 dark:text-slate-600" />
        </div>
      </div>
    </PosCard>
  );
}
