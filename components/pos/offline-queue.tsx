import { CloudOff, RotateCcw } from "lucide-react";
import { PosCard } from "./pos-card";
import { QueuedSale } from "./types";
import { formatCurrency } from "./utils";

const statusColor: Record<QueuedSale["status"], string> = {
  waiting: "text-amber-300",
  retrying: "text-sky-300",
  synced: "text-emerald-300"
};

export function OfflineQueue({ queue }: { queue: QueuedSale[] }) {
  return (
    <PosCard
      title="Offline queue"
      subtitle="Transactions captured during outages waiting for sync"
      action={
        <button className="inline-flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-200 hover:border-slate-700 hover:text-white">
          <RotateCcw className="h-3.5 w-3.5" />
          Retry all
        </button>
      }
    >
      <div className="space-y-3 text-xs text-slate-300">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-800/60 bg-slate-950/70 px-4 py-6 text-center text-slate-400">
            <CloudOff className="h-6 w-6 text-slate-600" />
            <p>No offline tickets</p>
          </div>
        ) : (
          queue.map((ticket) => (
            <div key={ticket.id} className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
                <span>{ticket.receipt}</span>
                <span className={statusColor[ticket.status]}>{ticket.status}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-slate-200">
                <span>{ticket.customer}</span>
                <span className="font-semibold">{formatCurrency(ticket.amount)}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{ticket.reason}</p>
            </div>
          ))
        )}
      </div>
    </PosCard>
  );
}
