import type { EngagementPlay, LoyaltyLedgerEntry } from "./types";
import { formatPoints } from "./utils";

const impactStyles: Record<EngagementPlay["impact"], string> = {
  high: "text-emerald-600 dark:text-emerald-300",
  medium: "text-amber-600 dark:text-amber-300",
  low: "text-slate-500 dark:text-slate-400"
};

const channelLabels: Record<EngagementPlay["channel"], string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
  call: "Llamada"
};

export function LoyaltyLedger({
  ledger,
  plays
}: {
  ledger: LoyaltyLedgerEntry[];
  plays: EngagementPlay[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Puntos recientes</h3>
          <button className="text-xs font-medium text-sky-600 transition hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200">
            Ver todas las transacciones
          </button>
        </div>
        <div className="grid gap-2">
          {ledger.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/30 dark:text-slate-300"
            >
              <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{entry.date}</span>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{entry.description}</p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Origen: {entry.source}</span>
              </div>
              <div className="text-right">
                <div className={`text-sm font-semibold ${entry.points >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-500 dark:text-rose-300"}`}>
                  {entry.points >= 0 ? "+" : ""}
                  {formatPoints(entry.points)} pts
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500">Balance: {formatPoints(entry.balance)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Acciones recomendadas</h3>
          <button className="text-xs font-medium text-sky-600 transition hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200">
            Ver playbook
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {plays.map((play) => (
            <div
              key={play.id}
              className="flex flex-col gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/30 dark:text-slate-300"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{play.title}</p>
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${impactStyles[play.impact]}`}>
                  Impacto {play.impact === "high" ? "alto" : play.impact === "medium" ? "medio" : "bajo"}
                </span>
              </div>
              <p className="text-[12px] leading-5 text-slate-600 dark:text-slate-300">{play.description}</p>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800/70">
                  {channelLabels[play.channel]}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800/70">Due: {play.due}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800/70">Responsable: {play.owner}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
