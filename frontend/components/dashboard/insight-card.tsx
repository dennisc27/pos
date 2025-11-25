import { LucideIcon } from "lucide-react";
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

export function SparkBar({ values, labels }: { values: number[]; labels?: string[] }) {
  const maxValue = Math.max(...values, 1);

  return (
    <div className="space-y-3">
      <div className="flex h-24 items-end gap-2 rounded-2xl bg-white/70 p-3 shadow-inner ring-1 ring-slate-200/60 dark:bg-slate-900/60 dark:ring-slate-800/70">
        {values.map((value, index) => {
          const height = Math.max((value / maxValue) * 100, 12);
          return (
            <div key={`${value}-${index}`} className="flex-1">
              <div
                className="relative w-full rounded-full bg-gradient-to-t from-sky-200 to-emerald-300 shadow-sm ring-1 ring-white/80 dark:from-slate-800 dark:to-emerald-700 dark:ring-slate-700"
                style={{ height: `${height}%` }}
              />
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
