import { InventoryCard } from "./inventory-card";
import type { QuarantineItem } from "./types";

export function QuarantineQueue({ items }: { items: QuarantineItem[] }) {
  return (
    <InventoryCard
      title="Quarantine & verification"
      subtitle="Handle holds for authenticity checks, repairs, or compliance flags"
      action={<button className="rounded-full border border-rose-500/60 px-3 py-1 text-xs text-rose-300">Release item</button>}
    >
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{item.description}</p>
                <p className="text-xs text-slate-300">SKU {item.sku}</p>
              </div>
              <span className="rounded-full border border-rose-500/40 px-3 py-1 text-[11px] uppercase tracking-wide text-rose-200">
                {item.reason}
              </span>
            </div>
            <div className="mt-3 grid gap-3 text-xs text-slate-200 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-200/70">Since</p>
                <p>{item.since}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-200/70">Assigned to</p>
                <p>{item.assignedTo}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-200/70">Next action</p>
                <p>{item.nextAction}</p>
              </div>
            </div>
          </div>
        ))}
        <button className="w-full rounded-xl border border-slate-800/70 bg-slate-950/60 py-2 text-sm text-slate-300">
          View quarantine log
        </button>
      </div>
    </InventoryCard>
  );
}
