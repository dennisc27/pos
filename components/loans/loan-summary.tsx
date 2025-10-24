import type { LoanSummaryMetric } from "./types";

export function LoanSummary({ metrics }: { metrics: LoanSummaryMetric[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="flex flex-col gap-1 rounded-2xl border border-slate-800/70 bg-slate-950/80 px-4 py-3"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase tracking-wide text-[10px] text-slate-500">
              {metric.label}
            </span>
            {metric.change ? (
              <span
                className={`flex items-center gap-1 text-[11px] font-medium ${
                  metric.change.direction === "up" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                <span>{metric.change.direction === "up" ? "▲" : "▼"}</span>
                {metric.change.label}
              </span>
            ) : null}
          </div>
          <span className={`text-lg font-semibold ${metric.accent ?? "text-white"}`}>
            {metric.value}
          </span>
        </div>
      ))}
    </section>
  );
}
