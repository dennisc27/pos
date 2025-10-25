import type { LoanActivityEvent } from "./types";
import { LoansCard } from "./loans-card";
import { formatCurrency } from "./utils";

const activityColors: Record<LoanActivityEvent["type"], string> = {
  new: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  renewal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  redemption: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  payment: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  notification: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300"
};

export function LoanActivity({ events }: { events: LoanActivityEvent[] }) {
  return (
    <LoansCard
      title="Actividad reciente"
      subtitle="Renovaciones, redenciones y avisos de las últimas horas"
    >
      <ol className="relative ml-3 flex flex-col gap-6 border-l border-slate-200 pl-6 dark:border-slate-800/60">
        {events.map((event) => (
          <li
            key={event.id}
            className="relative flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300"
          >
            <span className="absolute -left-[26px] flex h-3 w-3 items-center justify-center rounded-full border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950">
              <span className={`h-2 w-2 rounded-full ${activityColors[event.type]}`} />
            </span>
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">
              <span>{event.time}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${activityColors[event.type]}`}>
                {event.type}
              </span>
              <span>por {event.actor}</span>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{event.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{event.description}</p>
            {event.amount ? (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-300">
                {formatCurrency(event.amount)}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </LoansCard>
  );
}
