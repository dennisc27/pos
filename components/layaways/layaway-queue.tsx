import type { LayawayPlan } from "./types";
import { LayawaysCard } from "./layaways-card";
import { formatContactTimestamp, formatCurrency, statusBadgeColor } from "./utils";

export function LayawayQueue({
  title,
  subtitle,
  plans,
  actionLabel,
  actionDisabled,
  onAction,
  toolbar,
  footer,
  selectedIds,
  onToggleSelect,
  onToggleAutopay,
  onLogContact
}: {
  title: string;
  subtitle?: string;
  plans: LayawayPlan[];
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleAutopay?: (plan: LayawayPlan) => void;
  onLogContact?: (plan: LayawayPlan) => void;
}) {
  const hasSelection = typeof onToggleSelect === "function";
  return (
    <LayawaysCard
      title={title}
      subtitle={subtitle}
      action={
        actionLabel ? (
          <button
            onClick={onAction}
            disabled={actionDisabled}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
          >
            {actionLabel}
          </button>
        ) : null
      }
    >
      <div className="space-y-3">
        {toolbar}
        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 text-slate-700 shadow-sm dark:border-slate-800/70 dark:from-slate-950/70 dark:to-slate-950/80 dark:text-slate-200">
          <div
            className={`grid ${
              hasSelection
                ? "grid-cols-[24px_1.3fr_1fr_0.9fr_0.9fr_0.8fr_auto]"
                : "grid-cols-[1.3fr_1fr_0.9fr_0.9fr_0.8fr_auto]"
            } gap-4 border-b border-slate-200/70 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-800/60 dark:text-slate-500`}
          >
            {hasSelection ? <span className="sr-only">Seleccionar</span> : null}
            <span>Plan & Cliente</span>
            <span>Artículo</span>
            <span>Saldo</span>
            <span>Próximo pago</span>
            <span>Contacto</span>
            <span>Estado</span>
          </div>
          {plans.map((plan) => {
            const isSelected = selectedIds?.includes(plan.id);
            return (
              <div
                key={plan.id}
                className={`grid ${
                  hasSelection
                    ? "grid-cols-[24px_1.3fr_1fr_0.9fr_0.9fr_0.8fr_auto]"
                    : "grid-cols-[1.3fr_1fr_0.9fr_0.9fr_0.8fr_auto]"
                } items-center gap-4 border-t border-slate-100 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100/60 dark:border-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-900/60 ${
                  isSelected ? "bg-slate-100/80 dark:bg-slate-900/60" : ""
                }`}
              >
                {hasSelection ? (
                  <div className="flex items-start pt-1">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${plan.planNumber}`}
                      checked={isSelected ?? false}
                      onChange={() => onToggleSelect?.(plan.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900"
                    />
                  </div>
                ) : null}
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
                  <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400">Depósito: {formatCurrency(plan.deposit)}</p>
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
                  <button
                    onClick={() => onToggleAutopay?.(plan)}
                    className={`rounded-full border border-slate-300 px-2 py-0.5 text-[11px] uppercase tracking-wide transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:hover:border-slate-500 ${
                      plan.autopay ? "text-emerald-600 dark:text-emerald-300" : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {plan.autopay ? "AutoCobro" : "Activar AutoCobro"}
                  </button>
                  <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                    {plan.contactPreference}
                  </span>
                  {plan.lastContactAt ? (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {plan.lastContactChannel} · {formatContactTimestamp(plan.lastContactAt)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Sin gestión registrada</span>
                  )}
                  {plan.contactNotes ? (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{plan.contactNotes}</span>
                  ) : null}
                  <button
                    className="text-[11px] font-semibold text-sky-600 transition hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200"
                    onClick={() => onLogContact?.(plan)}
                  >
                    Registrar gestión
                  </button>
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
            );
          })}
        </div>
      </div>
      {footer}
    </LayawaysCard>
  );
}
