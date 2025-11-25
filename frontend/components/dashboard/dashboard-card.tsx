import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashboardCard({
  title,
  subtitle,
  children,
  className
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-white/90 p-4 shadow-lg ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-xl sm:p-6",
        "dark:border-slate-800/60 dark:bg-slate-900/70 dark:ring-slate-800/70",
        className
      )}
    >
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
        {subtitle ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
