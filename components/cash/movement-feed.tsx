import type { LucideIcon } from "lucide-react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CircleDollarSign,
  HandCoins,
  Landmark,
  RefreshCcw,
} from "lucide-react";
import { CashCard } from "./cash-card";
import type { CashMovement } from "./types";
import { formatCurrency } from "./utils";

const typeConfig: Record<
  CashMovement["type"],
  { label: string; tone: string; icon: LucideIcon }
> = {
  sale_cash: {
    label: "Venta",
    tone: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    icon: CircleDollarSign,
  },
  refund_cash: {
    label: "Reembolso",
    tone: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
    icon: RefreshCcw,
  },
  drop: {
    label: "Drop a bóveda",
    tone: "bg-sky-500/10 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
    icon: ArrowDownCircle,
  },
  paid_in: {
    label: "Paid-in",
    tone: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
    icon: Landmark,
  },
  paid_out: {
    label: "Paid-out",
    tone: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300",
    icon: ArrowUpCircle,
  },
  adjustment: {
    label: "Ajuste",
    tone: "bg-slate-500/10 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300",
    icon: HandCoins,
  },
};

export function MovementFeed({
  movements,
  onCreate,
  onFlag,
}: {
  movements: CashMovement[];
  onCreate?: () => void;
  onFlag?: (id: string) => void;
}) {
  return (
    <CashCard
      title="Movimientos de efectivo"
      subtitle="Registro en tiempo real de ventas, drops y ajustes"
      action={
        <button
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300"
          onClick={onCreate}
        >
          Registrar movimiento
        </button>
      }
    >
      <div className="space-y-4">
        {movements.map((movement) => {
          const config = typeConfig[movement.type];
          const Icon = config.icon;

          return (
            <div
              key={movement.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-white/70 p-4 shadow-sm transition-colors dark:border-slate-800/60 dark:bg-slate-900/60"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${config.tone}`}>
                    <Icon className="h-4 w-4" />
                    {config.label}
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {formatCurrency(movement.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{movement.time}</span>
                  <span className="hidden text-slate-400 sm:inline">•</span>
                  <span className="font-medium text-slate-600 dark:text-slate-300">{movement.branch}</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{movement.description}</p>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Registrado por {movement.user}</span>
                <div className="flex items-center gap-2">
                  {movement.reference ? <span>Ref: {movement.reference}</span> : null}
                  <button
                    className="rounded-full border border-slate-300 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300"
                    onClick={() => onFlag?.(movement.id)}
                  >
                    Revisar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </CashCard>
  );
}
