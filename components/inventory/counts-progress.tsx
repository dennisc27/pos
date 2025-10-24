import { InventoryCard } from "./inventory-card";
import type { CountSession } from "./types";

const statusBadge: Record<CountSession["status"], string> = {
  scheduled: "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300",
  in_progress: "border-sky-400/70 text-sky-600 dark:border-sky-500/60 dark:text-sky-300",
  reconciling: "border-amber-400/70 text-amber-600 dark:border-amber-500/60 dark:text-amber-300",
  posted: "border-emerald-400/70 text-emerald-600 dark:border-emerald-500/60 dark:text-emerald-300"
};

const typeLabel: Record<CountSession["type"], string> = {
  cycle: "Cycle count",
  full: "Full inventory",
  blind: "Blind count"
};

export function CountsProgress({ sessions }: { sessions: CountSession[] }) {
  return (
    <InventoryCard
      title="Counts & adjustments"
      subtitle="Track blind counts through reconciliation and locking adjustments"
      action={
        <button className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600">
          Schedule count
        </button>
      }
    >
      <div className="space-y-4">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="space-y-3 rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 text-slate-700 shadow-sm dark:border-slate-800/70 dark:from-slate-950/60 dark:to-slate-950/80 dark:text-slate-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{session.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {typeLabel[session.type]} · {session.scope}
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide ${statusBadge[session.status]}`}>
                {session.status.replace("_", " ")}
              </span>
            </div>
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-900">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                  style={{ width: `${Math.min(100, session.progress)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Counted {session.counted}/{session.expected} items
                </span>
                <span>{session.progress}% complete</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Scheduled {session.scheduledFor}</span>
              <button className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600">
                Reconciliation
              </button>
            </div>
          </div>
        ))}
      </div>
    </InventoryCard>
  );
}
