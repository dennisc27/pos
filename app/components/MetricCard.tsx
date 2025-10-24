import { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string;
  trendLabel?: string;
  trendDirection?: "up" | "down" | "flat";
  icon: ReactNode;
  footer?: ReactNode;
  accentColor?: string;
}

const trendIconMap: Record<NonNullable<MetricCardProps["trendDirection"]>, string> = {
  up: "▲",
  down: "▼",
  flat: "■"
};

export function MetricCard({
  title,
  value,
  trendLabel,
  trendDirection = "flat",
  icon,
  footer,
  accentColor = "from-brand/40 to-brand-dark/30"
}: MetricCardProps) {
  return (
    <article className="glass-panel grid-card-shadow relative flex flex-col gap-4 rounded-2xl p-6">
      <div
        className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r ${accentColor}`}
        aria-hidden
      />
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900/70 text-2xl">
          {icon}
        </span>
      </header>
      {trendLabel ? (
        <p className="text-sm text-slate-400">
          <span
            className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
              trendDirection === "up"
                ? "bg-success/20 text-success"
                : trendDirection === "down"
                  ? "bg-danger/20 text-danger"
                  : "bg-slate-700 text-slate-300"
            }`}
          >
            {trendIconMap[trendDirection]}
          </span>
          {trendLabel}
        </p>
      ) : null}
      {footer ? <footer className="mt-auto text-xs text-slate-500">{footer}</footer> : null}
    </article>
  );
}
