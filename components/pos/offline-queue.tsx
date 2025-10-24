import { CloudOff, RotateCcw } from "lucide-react";
import { PosCard } from "./pos-card";
import { QueuedSale } from "./types";
import { formatCurrency } from "./utils";

const statusColor: Record<QueuedSale["status"], string> = {
  waiting: "text-amber-600 dark:text-amber-300",
  retrying: "text-sky-600 dark:text-sky-300",
  synced: "text-emerald-600 dark:text-emerald-300"
};

export function OfflineQueue({ queue }: { queue: QueuedSale[] }) {
  return (
    <PosCard
      title="Offline queue"
      subtitle="Transactions captured during outages waiting for sync"
      action={
        <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-white">
          <RotateCcw className="h-3.5 w-3.5" />
          Retry all
        </button>
      }
    >
      <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-slate-500 shadow-sm dark:border-slate-800/60 dark:bg-slate-950/70 dark:text-slate-400">
            <CloudOff className="h-6 w-6 text-slate-400 dark:text-slate-600" />
            <p>No offline tickets</p>
          </div>
        ) : (
          queue.map((ticket) => (
            <div
              key={ticket.id}
              className="rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 text-slate-700 shadow-sm dark:border-slate-800/80 dark:from-slate-950/70 dark:to-slate-950/50 dark:text-slate-200"
            >
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <span>{ticket.receipt}</span>
                <span className={statusColor[ticket.status]}>{ticket.status}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-slate-700 dark:text-slate-200">
                <span>{ticket.customer}</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(ticket.amount)}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{ticket.reason}</p>
            </div>
          ))
        )}
      </div>
    </PosCard>
  );
}
