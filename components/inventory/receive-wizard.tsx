import { InventoryCard } from "./inventory-card";
import type { ReceivingShipment } from "./types";
import { formatCurrency } from "./utils";

const statusLabel: Record<ReceivingShipment["status"], string> = {
  unpacked: "Awaiting count",
  counting: "Counting in progress",
  tagging: "Tagging & photography",
  ready: "Ready to floor"
};

export function ReceiveWizard({ shipments }: { shipments: ReceivingShipment[] }) {
  return (
    <InventoryCard
      title="Receiving queue"
      subtitle="Follow the intake workflow with photos, cost assignments, and barcode printing"
      action={<button className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs text-emerald-300">Start intake</button>}
    >
      <div className="space-y-4">
        {shipments.map((shipment) => (
          <div
            key={shipment.id}
            className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-4 shadow-inner shadow-slate-900/40"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{shipment.vendor}</p>
                <p className="text-xs text-slate-400">ETA {shipment.eta}</p>
              </div>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] uppercase tracking-wide text-slate-300">
                {statusLabel[shipment.status]}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-300">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Items</dt>
                <dd className="text-sm text-white">{shipment.items}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Value</dt>
                <dd className="text-sm text-emerald-300">{formatCurrency(shipment.value)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Photos pending</dt>
                <dd className="text-sm text-white">{shipment.photosRequired}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">Workflow step</dt>
                <dd className="text-sm text-white">{shipment.status === "ready" ? "Post to floor" : "Assign to team"}</dd>
              </div>
            </dl>
            <div className="mt-4 flex gap-2 text-[11px] text-slate-400">
              <button className="rounded-full border border-slate-700 px-3 py-1">Checklist</button>
              <button className="rounded-full border border-slate-700 px-3 py-1">Print tags</button>
              <button className="rounded-full border border-slate-700 px-3 py-1">Upload photos</button>
            </div>
          </div>
        ))}
      </div>
    </InventoryCard>
  );
}
