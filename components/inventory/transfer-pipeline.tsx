import { InventoryCard } from "./inventory-card";
import type { InventoryTransfer } from "./types";
import { formatCurrency } from "./utils";

const statusColor: Record<InventoryTransfer["status"], string> = {
  staged: "text-amber-300",
  in_transit: "text-sky-300",
  received: "text-emerald-300"
};

export function TransferPipeline({ transfers }: { transfers: InventoryTransfer[] }) {
  return (
    <InventoryCard
      title="Transfers & consignments"
      subtitle="Monitor inter-branch movements and vendor consignments"
      action={<button className="rounded-full border border-slate-700 px-3 py-1 text-xs">Create transfer</button>}
    >
      <div className="space-y-4">
        {transfers.map((transfer) => (
          <div
            key={transfer.id}
            className="grid gap-4 rounded-xl border border-slate-800/70 bg-slate-950/60 p-4 text-sm text-slate-200 sm:grid-cols-5"
          >
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Reference</p>
              <p className="font-semibold text-white">{transfer.reference}</p>
              <p className="text-xs text-slate-400">{transfer.from} → {transfer.to}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Items</p>
              <p className="font-semibold text-white">{transfer.items}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Value</p>
              <p className="font-semibold text-emerald-300">{formatCurrency(transfer.value)}</p>
            </div>
            <div className="text-right sm:text-left">
              <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
              <p className={`font-semibold ${statusColor[transfer.status]}`}>{transfer.status.replace("_", " ")}</p>
              <p className="text-xs text-slate-400">{transfer.carrier}</p>
            </div>
            <div className="sm:col-span-5 flex items-center justify-between text-xs text-slate-400">
              <span>Last scan {transfer.lastScan}</span>
              <button className="rounded-full border border-slate-700 px-3 py-1">Manifest</button>
            </div>
          </div>
        ))}
      </div>
    </InventoryCard>
  );
}
