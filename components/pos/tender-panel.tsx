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
      action={<span className="text-emerald-400">{remaining <= 0 ? "Paid in full" : "Awaiting payment"}</span>}
      className="sticky top-24"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 text-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span>Total due</span>
            <span className="font-semibold text-white">{formatCurrency(summary.total)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Tendered</span>
            <span>{formatCurrency(tenderTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-amber-300">
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
                className="flex flex-col gap-2 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 text-xs text-slate-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-100">
                    <Icon className="h-4 w-4 text-sky-300" />
                    <span className="font-medium">{tender.label}</span>
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-slate-500">
                    {tender.status === "pending" ? "Pending" : tender.status === "offline" ? "Offline" : "Captured"}
                  </span>
                </div>
                <div className="text-lg font-semibold text-white">{formatCurrency(tender.amount)}</div>
                {tender.reference ? (
                  <div className="rounded-lg border border-slate-800/60 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-400">
                    Ref: <span className="font-mono text-slate-300">{tender.reference}</span>
                  </div>
                ) : null}
                <button className="mt-auto rounded-lg border border-slate-800/80 px-3 py-2 text-[11px] font-medium text-slate-200 transition hover:border-slate-700 hover:text-white">
                  Adjust amount
                </button>
              </div>
            );
          })}
        </div>
        <button className="rounded-xl border border-dashed border-slate-700/80 bg-slate-950/60 px-4 py-3 text-xs font-medium text-slate-200 hover:border-slate-600">
          Add tender line
        </button>
      </div>
    </PosCard>
  );
}
