import type { LoanQueueItem } from "./types";
import { LoansCard } from "./loans-card";
import { formatContactTimestamp, formatCurrency } from "./utils";

export function LoanQueue({
  title,
  subtitle,
  actionLabel,
  items,
  actionDisabled,
  onAction,
  toolbar,
  footer,
  selectedIds,
  onToggleSelect,
  onLogContact
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  items: LoanQueueItem[];
  actionDisabled?: boolean;
  onAction?: () => void;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onLogContact?: (item: LoanQueueItem) => void;
}) {
  const hasSelection = typeof onToggleSelect === "function";
  return (
    <LoansCard
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
        <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 text-slate-700 shadow-sm dark:border-slate-800/60 dark:from-slate-950/60 dark:to-slate-950/80 dark:text-slate-200">
          <div
            className={`grid ${
              hasSelection
                ? "grid-cols-[24px_1.3fr_1fr_1fr_0.9fr_auto]"
                : "grid-cols-[1.3fr_1fr_1fr_0.9fr_auto]"
            } gap-3 border-b border-slate-200/70 px-4 py-2 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-800/60 dark:text-slate-500`}
          >
            {hasSelection ? <span className="sr-only">Seleccionar</span> : null}
            <span>Ticket & Cliente</span>
            <span>Garantía</span>
            <span>Sucursal</span>
            <span>Monto</span>
            <span>Seguimiento</span>
          </div>
          {items.map((item) => {
            const isSelected = selectedIds?.includes(item.id);
            return (
              <div
                key={item.id}
                className={`grid ${
                  hasSelection
                    ? "grid-cols-[24px_1.3fr_1fr_1fr_0.9fr_auto]"
                    : "grid-cols-[1.3fr_1fr_1fr_0.9fr_auto]"
                } gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100/60 dark:border-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-900/60 ${
                  isSelected ? "bg-slate-100/80 dark:bg-slate-900/60" : ""
                }`}
              >
                {hasSelection ? (
                  <div className="flex items-start pt-1">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${item.ticket}`}
                      checked={isSelected ?? false}
                      onChange={() => onToggleSelect?.(item.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900"
                    />
                  </div>
                ) : null}
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900 dark:text-white">{item.ticket}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{item.customer}</span>
                </div>
                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-medium text-slate-800 dark:text-slate-200">{item.collateral}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">{item.dueDescriptor}</p>
                </div>
                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{item.branch}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase ${
                      item.risk === "high"
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                        : item.risk === "medium"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                    }`}
                  >
                    {item.risk}
                  </span>
                  {item.promiseToPay ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 dark:bg-amber-300" />
                      Promesa: {item.promiseToPay}
                    </span>
                  ) : null}
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  <div>{formatCurrency(item.principal)}</div>
                  {item.accrued ? (
                    <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">+{formatCurrency(item.accrued)} interés</span>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-slate-600 dark:text-slate-300">
                  <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] uppercase tracking-wide dark:border-slate-700">
                    {item.contactPreference}
                  </span>
                  {item.lastContactAt ? (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {item.lastContactChannel} · {formatContactTimestamp(item.lastContactAt)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Sin gestión registrada</span>
                  )}
                  {item.contactNotes ? (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{item.contactNotes}</span>
                  ) : null}
                  <button
                    className="text-[11px] font-semibold text-sky-600 transition hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200"
                    onClick={() => onLogContact?.(item)}
                  >
                    Registrar gestión
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {footer}
    </LoansCard>
  );
}
