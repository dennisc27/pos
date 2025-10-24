import type { RenewalCandidate } from "./types";
import { LoansCard } from "./loans-card";
import { formatCurrency, formatPercent } from "./utils";

export function RenewalTargets({
  candidates
}: {
  candidates: RenewalCandidate[];
}) {
  return (
    <LoansCard
      title="Renovaciones prioritarias"
      subtitle="Clientes con alta probabilidad de renovar en los próximos 3 días"
    >
      <ul className="flex flex-col gap-3">
        {candidates.map((candidate) => (
          <li
            key={candidate.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 px-4 py-3 text-slate-700 shadow-sm dark:border-slate-800/60 dark:from-slate-950/60 dark:to-slate-950/80 dark:text-slate-200"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {candidate.customer}
                <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">{candidate.ticket}</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Vence {candidate.maturity}</p>
              <p className="text-xs text-slate-500 dark:text-slate-300">Último contacto: {candidate.lastAction}</p>
            </div>
            <div className="flex flex-col items-end gap-1 text-right text-xs text-slate-600 dark:text-slate-300">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(candidate.outstanding)}</span>
              <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] uppercase tracking-wide dark:border-slate-700">
                {candidate.channel}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-300">Prob. {formatPercent(candidate.probability)}</span>
              <button className="text-[11px] font-semibold text-sky-600 transition hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200">
                Programar recordatorio
              </button>
            </div>
          </li>
        ))}
      </ul>
    </LoansCard>
  );
}
