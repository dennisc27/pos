import type { LoanQueueItem } from "./types";
import { LoansCard } from "./loans-card";
import { formatCurrency } from "./utils";

export function LoanQueue({
  title,
  subtitle,
  actionLabel,
  items
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  items: LoanQueueItem[];
}) {
  return (
    <LoansCard
      title={title}
      subtitle={subtitle}
      action={actionLabel ? <button className="rounded-full border border-slate-700 px-3 py-1">{actionLabel}</button> : null}
    >
      <div className="overflow-hidden rounded-xl border border-slate-800/60 bg-slate-900/40">
        <div className="grid grid-cols-[1.3fr_1fr_1fr_0.9fr_auto] gap-3 border-b border-slate-800/60 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-500">
          <span>Ticket & Cliente</span>
          <span>Garantía</span>
          <span>Sucursal</span>
          <span>Monto</span>
          <span>Seguimiento</span>
        </div>
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1.3fr_1fr_1fr_0.9fr_auto] gap-3 border-t border-slate-800/60 px-4 py-3 text-sm text-slate-200"
          >
            <div className="flex flex-col">
              <span className="font-medium text-white">{item.ticket}</span>
              <span className="text-xs text-slate-400">{item.customer}</span>
            </div>
            <div className="space-y-1 text-xs text-slate-300">
              <p className="font-medium text-slate-200">{item.collateral}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{item.dueDescriptor}</p>
            </div>
            <div className="text-xs text-slate-300">
              <span className="font-medium text-slate-200">{item.branch}</span>
              <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase ${
                item.risk === "high"
                  ? "bg-rose-500/10 text-rose-300"
                  : item.risk === "medium"
                  ? "bg-amber-500/10 text-amber-300"
                  : "bg-emerald-500/10 text-emerald-300"
              }`}>
                {item.risk}
              </span>
            </div>
            <div className="text-sm font-semibold text-white">
              <div>{formatCurrency(item.principal)}</div>
              {item.accrued ? (
                <span className="text-[11px] font-normal text-slate-400">+{formatCurrency(item.accrued)} interés</span>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1 text-xs text-slate-300">
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] uppercase tracking-wide">
                {item.contactPreference}
              </span>
              <button className="text-[11px] font-semibold text-sky-300 hover:text-sky-200">
                Registrar gestión
              </button>
            </div>
          </div>
        ))}
      </div>
    </LoansCard>
  );
}
