import type { CashSummaryMetric } from "./types";

export function CashSummary({ metrics }: { metrics: CashSummaryMetric[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="flex flex-col gap-1 rounded-2xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 px-4 py-3 text-slate-700 shadow-sm transition-colors dark:border-slate-800/70 dark:from-slate-950/70 dark:to-slate-950/50 dark:text-slate-200"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="uppercase tracking-wide text-[10px] text-slate-500 dark:text-slate-500">
              {metric.label}
            </span>
            {metric.change ? (
              <span
                className={`flex items-center gap-1 text-[11px] font-medium ${
                  metric.change.direction === "up"
                    ? "text-emerald-600 dark:text-emerald-300"
                    : metric.change.direction === "down"
                      ? "text-rose-500 dark:text-rose-300"
                      : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <span>
                  {metric.change.direction === "up"
                    ? "▲"
                    : metric.change.direction === "down"
                      ? "▼"
                      : "■"}
                </span>
                {metric.change.label}
              </span>
            ) : null}
          </div>
          <span
            className={`text-lg font-semibold text-slate-900 dark:text-white ${metric.accent ? `${metric.accent}` : ""}`}
          >
            {metric.value}
          </span>
        </div>
      ))}
    </section>
  );
}
