import type { LoanActivityEvent } from "./types";
import { LoansCard } from "./loans-card";
import { formatCurrency } from "./utils";

const activityColors: Record<LoanActivityEvent["type"], string> = {
  new: "bg-sky-500/20 text-sky-300",
  renewal: "bg-emerald-500/20 text-emerald-300",
  redemption: "bg-amber-500/20 text-amber-300",
  payment: "bg-indigo-500/20 text-indigo-300",
  notification: "bg-slate-500/20 text-slate-300"
};

export function LoanActivity({ events }: { events: LoanActivityEvent[] }) {
  return (
    <LoansCard
      title="Actividad reciente"
      subtitle="Renovaciones, redenciones y avisos de las últimas horas"
    >
      <ol className="relative ml-3 flex flex-col gap-6 border-l border-slate-800/60 pl-6">
        {events.map((event) => (
          <li key={event.id} className="relative flex flex-col gap-1 text-sm text-slate-300">
            <span className="absolute -left-[26px] flex h-3 w-3 items-center justify-center rounded-full border border-slate-700 bg-slate-950">
              <span className={`h-2 w-2 rounded-full ${activityColors[event.type]}`} />
            </span>
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <span>{event.time}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${activityColors[event.type]}`}>
                {event.type}
              </span>
              <span>por {event.actor}</span>
            </div>
            <p className="text-sm font-semibold text-white">{event.title}</p>
            <p className="text-xs text-slate-400">{event.description}</p>
            {event.amount ? (
              <p className="text-xs font-medium text-emerald-300">
                {formatCurrency(event.amount)}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </LoansCard>
  );
}
