import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Equal, Shield } from "lucide-react";
import { CashCard } from "./cash-card";
import type { DrawerStatus } from "./types";
import { formatCurrency } from "./utils";

const statusLabel: Record<DrawerStatus["status"], string> = {
  ok: "En balance",
  attention: "Atención",
  review: "Revisión urgente",
};

const statusIcon: Record<DrawerStatus["status"], LucideIcon> = {
  ok: Shield,
  attention: AlertTriangle,
  review: AlertTriangle,
};

const statusColor: Record<DrawerStatus["status"], string> = {
  ok: "text-emerald-600 dark:text-emerald-300",
  attention: "text-amber-600 dark:text-amber-300",
  review: "text-rose-600 dark:text-rose-300",
};

export function DrawerHealth({
  drawers,
  onInvestigate,
  onRecount,
}: {
  drawers: DrawerStatus[];
  onInvestigate?: (id: string) => void;
  onRecount?: (id: string) => void;
}) {
  return (
    <CashCard
      title="Salud de gavetas"
      subtitle="Conteos declarados vs. esperado por terminal"
      action={<span>{drawers.length} gavetas monitoreadas</span>}
    >
      <div className="space-y-4">
        {drawers.map((drawer) => {
          const variance = drawer.variance;
          const varianceIcon =
            variance === 0 ? (
              <Equal className="h-4 w-4" />
            ) : variance > 0 ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            );

          const Icon = statusIcon[drawer.status];

          return (
            <div
              key={drawer.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-gradient-to-r from-white via-white to-slate-50 p-4 text-sm text-slate-600 shadow-sm transition-colors dark:border-slate-800/70 dark:from-slate-950/60 dark:via-slate-950/50 dark:to-slate-900/60 dark:text-slate-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {drawer.branch}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{drawer.register}</p>
                </div>
                <div className={`flex items-center gap-2 text-xs font-semibold ${statusColor[drawer.status]}`}>
                  <Icon className="h-4 w-4" />
                  <span>{statusLabel[drawer.status]}</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Esperado</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(drawer.expected)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Declarado</p>
                  <button
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300"
                    onClick={() => onRecount?.(drawer.id)}
                  >
                    {formatCurrency(drawer.counted)}
                  </button>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Variación</p>
                  <div className={`flex items-center gap-2 font-semibold ${variance === 0 ? "text-slate-600 dark:text-slate-200" : variance > 0 ? "text-amber-600 dark:text-amber-300" : "text-rose-600 dark:text-rose-300"}`}>
                    {varianceIcon}
                    <span>{formatCurrency(variance)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Último conteo: {drawer.lastCount}</span>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300"
                    onClick={() => onRecount?.(drawer.id)}
                  >
                    Solicitar reconteo
                  </button>
                  {drawer.status !== "ok" ? (
                    <button
                      className="rounded-full border border-transparent bg-rose-500/10 px-3 py-1 font-medium text-rose-600 transition-colors hover:bg-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                      onClick={() => onInvestigate?.(drawer.id)}
                    >
                      Abrir investigación
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </CashCard>
  );
}
