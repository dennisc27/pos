import { InventoryCard } from "./inventory-card";
import type { CountSession } from "./types";

const statusBadge: Record<CountSession["status"], string> = {
  scheduled: "border-slate-700 text-slate-300",
  in_progress: "border-sky-500/60 text-sky-300",
  reconciling: "border-amber-500/60 text-amber-300",
  posted: "border-emerald-500/60 text-emerald-300"
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
      action={<button className="rounded-full border border-slate-700 px-3 py-1 text-xs">Schedule count</button>}
    >
      <div className="space-y-4">
        {sessions.map((session) => (
          <div key={session.id} className="space-y-3 rounded-xl border border-slate-800/70 bg-slate-950/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{session.name}</p>
                <p className="text-xs text-slate-400">{typeLabel[session.type]} · {session.scope}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide ${statusBadge[session.status]}`}>
                {session.status.replace("_", " ")}
              </span>
            </div>
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                  style={{ width: `${Math.min(100, session.progress)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-400">
                <span>
                  Counted {session.counted}/{session.expected} items
                </span>
                <span>{session.progress}% complete</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Scheduled {session.scheduledFor}</span>
              <button className="rounded-full border border-slate-700 px-3 py-1">Reconciliation</button>
            </div>
          </div>
        ))}
      </div>
    </InventoryCard>
  );
}
