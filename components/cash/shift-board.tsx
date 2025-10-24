import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { CashCard } from "./cash-card";
import type { ShiftSnapshot } from "./types";
import { formatCurrency } from "./utils";

const statusStyles: Record<ShiftSnapshot["status"], string> = {
  open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  closing: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  balanced: "bg-slate-200 text-slate-700 dark:bg-slate-500/10 dark:text-slate-200"
};

const statusLabel: Record<ShiftSnapshot["status"], string> = {
  open: "En curso",
  closing: "Cierre en progreso",
  balanced: "Cuadrado"
};

export function ShiftBoard({ shifts }: { shifts: ShiftSnapshot[] }) {
  return (
    <CashCard
      title="Turnos de caja"
      subtitle="Supervisa aperturas, recuentos intermedios y cierres por sucursal"
      action={<span>{shifts.length} activos hoy</span>}
    >
      <div className="space-y-5">
        {shifts.map((shift) => {
          const variance = shift.variance ?? (shift.counted ? shift.counted - shift.expected : undefined);
          const varianceColor =
            variance === undefined
              ? "text-slate-500 dark:text-slate-400"
              : variance === 0
                ? "text-emerald-600 dark:text-emerald-300"
                : variance > 0
                  ? "text-amber-600 dark:text-amber-300"
                  : "text-rose-500 dark:text-rose-300";

          return (
            <div
              key={shift.id}
              className="rounded-xl border border-slate-200/70 bg-white/70 p-4 shadow-sm transition-colors dark:border-slate-800/60 dark:bg-slate-900/60"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                    <span>{shift.branch}</span>
                    <span className="text-slate-400">•</span>
                    <span>{shift.register}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyles[shift.status]}`}>
                      {statusLabel[shift.status]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {`Cajero: ${shift.clerk} · Apertura ${shift.openedAt}`}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Último movimiento · {shift.lastMovement}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Esperado
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(shift.expected)}
                    </span>
                  </div>
                  {shift.counted !== undefined ? (
                    <div className="space-y-1">
                      <span className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Conteo parcial
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(shift.counted)}
                      </span>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <span className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Variación
                    </span>
                    <span className={`font-semibold ${varianceColor}`}>
                      {variance === undefined ? "Pendiente" : formatCurrency(variance)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {shift.tasks.map((task) => (
                  <div
                    key={task.label}
                    className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-gradient-to-r from-white via-white to-slate-50 px-3 py-2 text-xs text-slate-600 transition-colors dark:border-slate-800/70 dark:from-slate-950/50 dark:via-slate-950/40 dark:to-slate-900/60 dark:text-slate-300"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : shift.status === "closing" ? (
                      <Clock className="h-4 w-4 text-sky-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="leading-snug">{task.label}</span>
                  </div>
                ))}
              </div>
              {shift.nextAction ? (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-sky-400/60 bg-sky-50/70 px-3 py-2 text-xs text-sky-700 transition-colors dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Próximo paso:</span>
                  <span>{shift.nextAction}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </CashCard>
  );
}
