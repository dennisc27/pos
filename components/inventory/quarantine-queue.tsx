import { InventoryCard } from "./inventory-card";
import type { QuarantineItem } from "./types";

export function QuarantineQueue({
  items,
  onResolve,
  onEscalate,
}: {
  items: QuarantineItem[];
  onResolve?: (id: string) => void;
  onEscalate?: (id: string) => void;
}) {
  return (
    <InventoryCard
      title="Quarantine & verification"
      subtitle="Handle holds for authenticity checks, repairs, or compliance flags"
      action={
        <button className="rounded-full border border-rose-400/60 px-3 py-1 text-xs font-medium text-rose-600 transition hover:border-rose-500/70 hover:text-rose-500 dark:border-rose-500/60 dark:text-rose-300">
          Release item
        </button>
      }
    >
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-rose-200/60 bg-rose-50 p-4 text-slate-700 shadow-sm dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-slate-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.description}</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">SKU {item.sku}</p>
              </div>
              <span className="rounded-full border border-rose-300 px-3 py-1 text-[11px] uppercase tracking-wide text-rose-600 dark:border-rose-500/40 dark:text-rose-200">
                {item.reason}
              </span>
            </div>
            <div className="mt-3 grid gap-3 text-xs text-slate-600 dark:text-slate-200 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-200/70">Since</p>
                <p>{item.since}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-200/70">Assigned to</p>
                <p>{item.assignedTo}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-200/70">Next action</p>
                <p>{item.nextAction}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-rose-600 dark:text-rose-300">
              <button
                className="rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-white/60 dark:border-rose-500/40 dark:bg-rose-500/20 dark:text-rose-200"
                onClick={() => onResolve?.(item.id)}
              >
                Liberar hold
              </button>
              <button
                className="rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-white/60 dark:border-rose-500/40 dark:bg-rose-500/20 dark:text-rose-200"
                onClick={() => onEscalate?.(item.id)}
              >
                Escalar revisión
              </button>
            </div>
          </div>
        ))}
        <button className="w-full rounded-xl border border-slate-300 bg-white py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-300">
          View quarantine log
        </button>
      </div>
    </InventoryCard>
  );
}
