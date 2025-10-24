import type { ComponentType } from "react";
import { CreditCard, DollarSign, Gift, HandCoins, Landmark } from "lucide-react";
import { SaleSummary, TenderBreakdown } from "./types";
import { PosCard } from "./pos-card";
import { formatCurrency } from "./utils";

const tenderIcons: Record<TenderBreakdown["method"], ComponentType<{ className?: string }>> = {
  cash: DollarSign,
  card: CreditCard,
  transfer: Landmark,
  store_credit: HandCoins,
  gift: Gift
};

export function TenderPanel({
  summary,
  tenders
}: {
  summary: SaleSummary;
  tenders: TenderBreakdown[];
}) {
  const tenderTotal = tenders.reduce((sum, tender) => sum + tender.amount, 0);
  const remaining = summary.total - tenderTotal;

  return (
    <PosCard
      title="Tender"
      subtitle="Split payments, capture approvals, and keep audit trails aligned with the drawer"
      action={
        <span className="font-medium text-emerald-600 dark:text-emerald-300">
          {remaining <= 0 ? "Paid in full" : "Awaiting payment"}
        </span>
      }
      className="sticky top-24"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 text-sm text-slate-700 shadow-sm dark:border-slate-800/80 dark:from-slate-950/60 dark:to-slate-950/80 dark:text-slate-200">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span>Total due</span>
            <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(summary.total)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Tendered</span>
            <span>{formatCurrency(tenderTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-300">
            <span>Remaining</span>
            <span>{formatCurrency(Math.max(remaining, 0))}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {tenders.map((tender) => {
            const Icon = tenderIcons[tender.method];
            return (
              <div
                key={tender.method + tender.reference}
                className="flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 text-xs text-slate-600 shadow-sm dark:border-slate-800/80 dark:from-slate-950/70 dark:to-slate-950/50 dark:text-slate-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-100">
                    <Icon className="h-4 w-4 text-sky-500 dark:text-sky-300" />
                    <span className="font-medium">{tender.label}</span>
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                    {tender.status === "pending" ? "Pending" : tender.status === "offline" ? "Offline" : "Captured"}
                  </span>
                </div>
                <div className="text-lg font-semibold text-slate-900 dark:text-white">{formatCurrency(tender.amount)}</div>
                {tender.reference ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800/60 dark:bg-slate-950/70 dark:text-slate-400">
                    Ref: <span className="font-mono text-slate-600 dark:text-slate-300">{tender.reference}</span>
                  </div>
                ) : null}
                <button className="mt-auto rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-white">
                  Adjust amount
                </button>
              </div>
            );
          })}
        </div>
        <button className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-600">
          Add tender line
        </button>
      </div>
    </PosCard>
  );
}
