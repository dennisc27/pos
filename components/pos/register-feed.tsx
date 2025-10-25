import type { ComponentType } from "react";
import { ArrowDownToLine, ArrowUpToLine, Clock3, Coins, Receipt } from "lucide-react";
import { PosCard } from "./pos-card";
import { RegisterEvent } from "./types";
import { formatCurrency } from "./utils";

const eventIcon: Record<RegisterEvent["type"], ComponentType<{ className?: string }>> = {
  sale: Receipt,
  paid_in: ArrowDownToLine,
  paid_out: ArrowUpToLine,
  drop: Coins,
  refund: Clock3
};

const eventBadge: Record<RegisterEvent["type"], string> = {
  sale: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  paid_in: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  paid_out: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  drop: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  refund: "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300"
};

export function RegisterFeed({ events }: { events: RegisterEvent[] }) {
  return (
    <PosCard
      title="Register feed"
      subtitle="Live stream of cash drawer activity synced across tills"
      action={
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Realtime
        </span>
      }
    >
      <ol className="space-y-4">
        {events.map((event) => {
          const Icon = eventIcon[event.type];
          return (
            <li key={event.id} className="flex gap-3">
              <div className="mt-1">
                <Icon className="h-4 w-4 text-slate-500 dark:text-slate-500" />
              </div>
              <div className="flex-1 rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 text-slate-600 shadow-sm transition dark:border-slate-800/80 dark:from-slate-950/70 dark:to-slate-950/50 dark:text-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{event.time}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${eventBadge[event.type]}`}>
                      {event.type.replace("_", " ")}
                    </span>
                  </div>
                  <span>by {event.clerk}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{event.description}</p>
                {event.amount ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-800/60 dark:bg-slate-950/60 dark:text-slate-300">
                    <Coins className="h-3.5 w-3.5 text-amber-500 dark:text-amber-300" />
                    <span>{formatCurrency(event.amount)}</span>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </PosCard>
  );
}
