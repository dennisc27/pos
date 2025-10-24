import type { LucideIcon } from "lucide-react";
import { Clock, Lock, ShieldCheck, Truck } from "lucide-react";
import { CashCard } from "./cash-card";
import type { SafeDropItem } from "./types";
import { formatCurrency } from "./utils";

const statusLabel: Record<SafeDropItem["status"], string> = {
  queued: "Esperando drop",
  sealed: "Sellado",
  in_transit: "En traslado",
  received: "Recibido"
};

const statusTone: Record<SafeDropItem["status"], string> = {
  queued: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  sealed: "bg-sky-500/10 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
  in_transit: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300",
  received: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
};

const statusIcon: Record<SafeDropItem["status"], LucideIcon> = {
  queued: Clock,
  sealed: Lock,
  in_transit: Truck,
  received: ShieldCheck
};

export function SafeQueue({ drops }: { drops: SafeDropItem[] }) {
  return (
    <CashCard
      title="Bóveda y depósitos"
      subtitle="Seguimiento a drops y bolsas enviadas a banco"
      action={<span>{drops.length} pendientes</span>}
    >
      <div className="space-y-4">
        {drops.map((drop) => {
          const Icon = statusIcon[drop.status];

          return (
            <div
              key={drop.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-gradient-to-r from-white via-white to-slate-50 p-4 text-xs text-slate-600 shadow-sm transition-colors dark:border-slate-800/70 dark:from-slate-950/60 dark:via-slate-950/50 dark:to-slate-900/60 dark:text-slate-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-white">Drop #{drop.dropNumber}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{drop.branch}</p>
                </div>
                <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone[drop.status]}`}>
                  <Icon className="h-4 w-4" />
                  {statusLabel[drop.status]}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <span className="block text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Monto</span>
                  <span className="text-base font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(drop.amount)}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Bolsa</span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{drop.bagId}</span>
                </div>
                <div className="space-y-1">
                  <span className="block text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Recolección
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{drop.scheduledPickup}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Escolta asignada: {drop.escort}</span>
                {drop.notes ? <span className="text-slate-600 dark:text-slate-300">Nota: {drop.notes}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </CashCard>
  );
}
