import { RepairsCard } from "./repairs-card";
import type { RepairsSummaryMetric } from "./types";

export function RepairsSummary({ metrics }: { metrics: RepairsSummaryMetric[] }) {
  return (
    <RepairsCard
      title="Estado del taller"
      subtitle="Rendimiento, SLA y satisfacción de los trabajos en curso"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm transition-colors dark:border-slate-800/70 dark:from-slate-950/60 dark:to-slate-950/80"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {metric.label}
            </p>
            <p className={`mt-2 text-xl font-semibold text-slate-900 dark:text-white ${metric.accent ?? ""}`}>
              {metric.value}
            </p>
            {metric.change ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {metric.change.direction === "up"
                  ? "▲"
                  : metric.change.direction === "down"
                    ? "▼"
                    : "•"}{" "}
                {metric.change.label}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </RepairsCard>
  );
}
