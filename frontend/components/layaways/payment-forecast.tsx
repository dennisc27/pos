import type { PaymentScheduleItem } from "./types";
import { LayawaysCard } from "./layaways-card";
import { channelPillColor, formatCurrency } from "./utils";

export function PaymentForecast({
  items,
  onUpdateStatus,
  onQueueReminder
}: {
  items: PaymentScheduleItem[];
  onUpdateStatus?: (id: string, status: PaymentScheduleItem["status"], note?: string) => void;
  onQueueReminder?: (id: string) => void;
}) {
  return (
    <LayawaysCard
      title="Cobros programados"
      subtitle="Próximas cuotas y modalidad de cobro"
    >
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-4 text-sm text-slate-700 shadow-sm dark:border-slate-800/70 dark:from-slate-950/70 dark:to-slate-950/50 dark:text-slate-200"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">
                  {item.dueDate}
                </span>
                <span className="text-base font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(item.amount)}
                </span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${channelPillColor(item.channel)}`}
              >
                {item.channel === "auto" ? "Automático" : item.channel}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
              <div>
                <span className="font-medium text-slate-900 dark:text-white">{item.customer}</span>
                <span className="ml-2 rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                  {item.planNumber}
                </span>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                      item.status === "completed"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : item.status === "processing"
                          ? "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                          : item.status === "overdue"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                            : "bg-slate-200 text-slate-700 dark:bg-slate-500/10 dark:text-slate-200"
                    }`}
                  >
                    {item.status}
                  </span>
                  {item.notes ? (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{item.notes}</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-end gap-2 text-[11px]">
                  {onUpdateStatus ? (
                    <>
                      <button
                        onClick={() => onUpdateStatus(item.id, "completed")}
                        className="rounded-full border border-slate-300 px-2 py-0.5 font-semibold text-emerald-600 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:text-emerald-300"
                      >
                        Marcar cobrado
                      </button>
                      {item.status !== "overdue" ? (
                        <button
                          onClick={() => onUpdateStatus(item.id, "overdue")}
                          className="rounded-full border border-slate-300 px-2 py-0.5 font-semibold text-amber-600 transition hover:border-amber-400 hover:text-amber-700 dark:border-slate-700 dark:text-amber-300"
                        >
                          Marcar atrasado
                        </button>
                      ) : (
                        <button
                          onClick={() => onUpdateStatus(item.id, "scheduled")}
                          className="rounded-full border border-slate-300 px-2 py-0.5 font-semibold text-sky-600 transition hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:text-sky-300"
                        >
                          Reprogramar
                        </button>
                      )}
                    </>
                  ) : null}
                  {onQueueReminder ? (
                    <button
                      onClick={() => onQueueReminder(item.id)}
                      className="rounded-full border border-slate-300 px-2 py-0.5 font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300"
                    >
                      Recordatorio
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </LayawaysCard>
  );
}
