import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type InsightStatProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  emphasis?: boolean;
  helper?: string;
};

export function InsightStat({ label, value, helper, icon: Icon, emphasis }: InsightStatProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-4 py-3 shadow-inner backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-900/60">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-white/70 dark:text-slate-300/80">{label}</p>
        <p
          className={cn(
            "text-lg font-semibold text-white drop-shadow-sm dark:text-slate-50",
            emphasis && "text-emerald-200 dark:text-emerald-300"
          )}
        >
          {value}
        </p>
        {helper ? <p className="text-xs text-white/70 dark:text-slate-300/70">{helper}</p> : null}
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white shadow-inner ring-1 ring-white/30 dark:bg-slate-800/70 dark:text-slate-100 dark:ring-slate-700">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
    </div>
  );
}

export function InsightCard({
  title,
  description,
  children,
  adornment,
  className
}: {
  title: string;
  description?: string;
  children: ReactNode;
  adornment?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-xl transition hover:shadow-2xl",
        "dark:border-slate-800/70 dark:bg-slate-900/70",
        className
      )}
    >
      <div className="absolute inset-0 opacity-50 blur-3xl" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-200 via-sky-200 to-indigo-200 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950" />
      </div>
      <div className="relative flex flex-col gap-3">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300/80">{title}</p>
            {description ? (
              <p className="text-sm text-slate-600 dark:text-slate-300/90">{description}</p>
            ) : null}
          </div>
          {adornment}
        </header>
        <div className="relative z-[1]">{children}</div>
      </div>
    </section>
  );
}

type SparkBarProps = {
  values: number[];
  labels?: string[];
  previousValues?: number[];
  formatValue?: (value: number, index: number) => string;
  showTrends?: boolean;
};

function getPerformanceColor(value: number, previousValue: number | undefined, threshold: { good: number; warning: number } = { good: 10, warning: -10 }): string {
  if (previousValue === undefined || previousValue === 0) {
    return value > 0 ? "from-emerald-200 to-emerald-400" : "from-slate-200 to-slate-400";
  }
  
  const percentChange = ((value - previousValue) / previousValue) * 100;
  
  if (percentChange >= threshold.good) {
    return "from-emerald-200 to-emerald-500";
  } else if (percentChange <= threshold.warning) {
    return "from-red-200 to-red-400";
  } else {
    return "from-amber-200 to-amber-400";
  }
}

function calculatePercentChange(current: number, previous: number | undefined): { percent: number; direction: "up" | "down" | "flat" } {
  if (previous === undefined || previous === 0) {
    return { percent: 0, direction: current > 0 ? "up" : "flat" };
  }
  
  const percent = ((current - previous) / previous) * 100;
  
  if (Math.abs(percent) < 0.1) {
    return { percent: 0, direction: "flat" };
  }
  
  return {
    percent: Math.abs(percent),
    direction: percent > 0 ? "up" : "down"
  };
}

export function SparkBar({ values, labels, previousValues, formatValue, showTrends = true }: SparkBarProps) {
  // Calculate max value, ensuring at least 1 for proper scaling
  const maxValue = Math.max(...values.filter(v => !isNaN(v) && isFinite(v)), 1);
  const hasData = values.some(v => v > 0);

  const defaultFormatValue = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  return (
    <div className="space-y-3">
      <div className="flex h-32 items-end gap-2 rounded-2xl bg-white/70 p-3 shadow-inner ring-1 ring-slate-200/60 dark:bg-slate-900/60 dark:ring-slate-800/70">
        {values.map((value, index) => {
          // Calculate height percentage, with minimum 8% for visibility when value > 0
          const rawHeight = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const height = value > 0 ? Math.max(rawHeight, 8) : 0;
          const previousValue = previousValues?.[index];
          const colorClass = getPerformanceColor(value, previousValue);
          const trend = calculatePercentChange(value, previousValue);
          const formattedValue = formatValue ? formatValue(value, index) : defaultFormatValue(value);
          
          return (
            <div key={`${value}-${index}`} className="flex-1 flex flex-col items-center gap-1">
              {/* Value label and trend */}
              <div className="flex flex-col items-center gap-0.5 min-h-[2.5rem]">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {formattedValue}
                </div>
                {showTrends && previousValue !== undefined && previousValue !== value && (
                  <div className={cn(
                    "flex items-center gap-0.5 text-[10px] font-medium",
                    trend.direction === "up" && "text-emerald-600 dark:text-emerald-400",
                    trend.direction === "down" && "text-red-600 dark:text-red-400",
                    trend.direction === "flat" && "text-slate-500"
                  )}>
                    {trend.direction === "up" && <TrendingUp className="h-3 w-3" />}
                    {trend.direction === "down" && <TrendingDown className="h-3 w-3" />}
                    {trend.percent > 0 && `${trend.percent.toFixed(0)}%`}
                  </div>
                )}
              </div>
              
              {/* Bar */}
              {value > 0 || !hasData ? (
                <div
                  className={cn(
                    "relative w-full rounded-full shadow-sm ring-1 ring-white/80 dark:ring-slate-700 transition-all bg-gradient-to-t",
                    colorClass
                  )}
                style={{ height: `${height}%` }}
                  title={`${formattedValue}${previousValue !== undefined ? ` (${trend.direction === "up" ? "+" : ""}${trend.percent.toFixed(1)}% vs previous)` : ""}`}
                />
              ) : (
                <div
                  className="relative w-full rounded-full bg-slate-200/50 dark:bg-slate-800/50"
                  style={{ height: '4px' }}
                  title="0"
              />
              )}
            </div>
          );
        })}
      </div>
      {labels ? (
        <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-300/80">
          {labels.map((label) => (
            <span key={label} className="truncate text-center">
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
