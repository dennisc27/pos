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
  up: "text-emerald-400",
  down: "text-rose-400",
  flat: "text-slate-400"
};

export function MetricList({ metrics }: { metrics: Metric[] }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 shadow-inner"
        >
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {metric.label}
          </dt>
          <dd className="mt-2 flex items-baseline gap-2 text-2xl font-semibold text-white">
            <span className={metric.emphasis ? "text-sky-400" : undefined}>{metric.value}</span>
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
