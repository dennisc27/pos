import type { EngagementReminder, UpsellInsight } from "./types";
import { LayawaysCard } from "./layaways-card";

export function EngagementCenter({
  reminders,
  insights
}: {
  reminders: EngagementReminder[];
  insights: UpsellInsight[];
}) {
  return (
    <LayawaysCard
      title="Seguimiento automático"
      subtitle="Recordatorios, notas y oportunidades de valor"
      action={<button className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300">Programar campaña</button>}
    >
      <div className="space-y-6">
        <section className="space-y-3">
          <header className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">
            <span>Recordatorios</span>
            <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
              {reminders.length} activos
            </span>
          </header>
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 px-4 py-3 text-xs text-slate-600 shadow-sm dark:border-slate-800/70 dark:from-slate-950/70 dark:to-slate-950/60 dark:text-slate-300"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {reminder.customer}
                    <span className="ml-2 rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                      {reminder.planNumber}
                    </span>
                  </p>
                  <p className="text-[12px] leading-5 text-slate-600 dark:text-slate-300">{reminder.message}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                    {reminder.channel} · {reminder.scheduledFor}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                    reminder.status === "sent"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : reminder.status === "scheduled"
                        ? "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                  }`}
                >
                  {reminder.status}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-3">
          <header className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">Oportunidades</header>
          <div className="grid gap-3">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-4 text-sm text-slate-700 shadow-sm dark:border-slate-800/70 dark:from-slate-950/70 dark:to-slate-950/60 dark:text-slate-200"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">{insight.title}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                      insight.impact === "high"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : insight.impact === "medium"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-500/10 dark:text-slate-200"
                    }`}
                  >
                    {insight.impact}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">{insight.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </LayawaysCard>
  );
}
