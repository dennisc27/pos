import type { LayawayPlan } from "./types";
import { LayawaysCard } from "./layaways-card";
import { formatCurrency, statusBadgeColor } from "./utils";

export function LayawayQueue({
  title,
  subtitle,
  plans,
  actionLabel
}: {
  title: string;
  subtitle?: string;
  plans: LayawayPlan[];
  actionLabel?: string;
}) {
  return (
    <LayawaysCard
      title={title}
      subtitle={subtitle}
      action={
        actionLabel ? (
          <button className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300">
            {actionLabel}
          </button>
        ) : null
      }
    >
      <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 text-slate-700 shadow-sm dark:border-slate-800/70 dark:from-slate-950/70 dark:to-slate-950/80 dark:text-slate-200">
        <div className="grid grid-cols-[1.3fr_1fr_0.9fr_0.9fr_0.8fr_auto] gap-4 border-b border-slate-200/70 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-800/60 dark:text-slate-500">
          <span>Plan & Cliente</span>
          <span>Artículo</span>
          <span>Saldo</span>
          <span>Próximo pago</span>
          <span>Contacto</span>
          <span>Estado</span>
        </div>
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="grid grid-cols-[1.3fr_1fr_0.9fr_0.9fr_0.8fr_auto] items-center gap-4 border-t border-slate-100 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100/60 dark:border-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-900/60"
          >
            <div className="space-y-1">
              <span className="font-semibold text-slate-900 dark:text-white">{plan.planNumber}</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">{plan.customer}</p>
            </div>
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-medium text-slate-800 dark:text-slate-200">{plan.item}</p>
              <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">{plan.branch}</p>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {formatCurrency(plan.balance)}
              <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400">Deposito: {formatCurrency(plan.deposit)}</p>
            </div>
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatCurrency(plan.nextPaymentAmount)}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                {plan.nextPaymentDate}
              </span>
              {plan.promiseToPay ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 dark:bg-amber-300" />
                  Promesa: {plan.promiseToPay}
                </span>
              ) : null}
            </div>
            <div className="flex flex-col items-start gap-1 text-xs text-slate-600 dark:text-slate-300">
              <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] uppercase tracking-wide dark:border-slate-700">
                {plan.contactPreference}
              </span>
              <span
                className={`text-[11px] font-medium uppercase tracking-wide ${
                  plan.autopay
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {plan.autopay ? "AutoCobro" : "Manual"}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeColor(plan.status)}`}
              >
                {plan.status}
              </span>
              <button className="text-[11px] font-semibold text-sky-600 transition hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200">
                Ver plan
              </button>
            </div>
          </div>
        ))}
      </div>
    </LayawaysCard>
  );
}
