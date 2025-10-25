import { InventoryCard } from "./inventory-card";
import type { InventoryTransfer } from "./types";
import { formatCurrency } from "./utils";

const statusColor: Record<InventoryTransfer["status"], string> = {
  staged: "text-amber-600 dark:text-amber-300",
  in_transit: "text-sky-600 dark:text-sky-300",
  received: "text-emerald-600 dark:text-emerald-300",
};

const nextStatus: Record<InventoryTransfer["status"], InventoryTransfer["status"] | null> = {
  staged: "in_transit",
  in_transit: "received",
  received: null,
};

export function TransferPipeline({
  transfers,
  onAdvance,
  onViewManifest,
}: {
  transfers: InventoryTransfer[];
  onAdvance?: (id: string, next: InventoryTransfer["status"] | null) => void;
  onViewManifest?: (id: string) => void;
}) {
  return (
    <InventoryCard
      title="Transfers & consignments"
      subtitle="Monitor inter-branch movements and vendor consignments"
      action={
        <button className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300">
          Create transfer
        </button>
      }
    >
      <div className="space-y-4">
        {transfers.map((transfer) => {
          const next = nextStatus[transfer.status];
          return (
            <div
              key={transfer.id}
              className="grid gap-4 rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 text-sm text-slate-700 shadow-sm dark:border-slate-800/70 dark:from-slate-950/60 dark:to-slate-950/80 dark:text-slate-200 sm:grid-cols-5"
            >
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">Reference</p>
                <p className="font-semibold text-slate-900 dark:text-white">{transfer.reference}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{transfer.from} → {transfer.to}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">Items</p>
                <p className="font-semibold text-slate-900 dark:text-white">{transfer.items}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">Value</p>
                <p className="font-semibold text-emerald-600 dark:text-emerald-300">{formatCurrency(transfer.value)}</p>
              </div>
              <div className="text-right sm:text-left">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">Status</p>
                <p className={`font-semibold ${statusColor[transfer.status]}`}>{transfer.status.replace("_", " ")}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{transfer.carrier}</p>
              </div>
              <div className="sm:col-span-5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Last scan {transfer.lastScan}</span>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-slate-300 px-3 py-1 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:hover:border-slate-600"
                    onClick={() => onViewManifest?.(transfer.id)}
                  >
                    Manifest
                  </button>
                  <button
                    className="rounded-full border border-sky-400/70 px-3 py-1 text-sky-600 transition hover:border-sky-500/70 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-500/60 dark:text-sky-300"
                    onClick={() => onAdvance?.(transfer.id, next)}
                    disabled={!next}
                  >
                    {next ? `Mark ${next.replace("_", " ")}` : "Completed"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </InventoryCard>
  );
}
