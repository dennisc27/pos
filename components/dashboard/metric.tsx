export type Metric = {
  label: string;
  value: string;
  trend?: {
    label: string;
    direction: "up" | "down" | "flat";
  };
  emphasis?: boolean;
};

const trendColor: Record<NonNullable<Metric["trend"]>["direction"], string> = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-rose-600 dark:text-rose-400",
  flat: "text-slate-500 dark:text-slate-400"
};

export function MetricList({ metrics }: { metrics: Metric[] }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-xl border border-slate-200/70 bg-white/70 p-4 shadow-inner transition-colors dark:border-slate-800/60 dark:bg-slate-900/60"
        >
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {metric.label}
          </dt>
          <dd className="mt-2 flex items-baseline gap-2 text-2xl font-semibold text-slate-900 dark:text-white">
            <span
              className={
                metric.emphasis ? "text-sky-600 dark:text-sky-400" : undefined
              }
            >
              {metric.value}
            </span>
            {metric.trend ? (
              <span className={`text-xs font-medium ${trendColor[metric.trend.direction]}`}>
                {metric.trend.label}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
