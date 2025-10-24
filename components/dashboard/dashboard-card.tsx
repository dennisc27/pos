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
        "flex flex-col gap-4 rounded-2xl border bg-gradient-to-b p-6 transition-colors",
        "from-white to-slate-100 border-slate-200/70 text-slate-900 shadow-sm",
        "dark:border-slate-800/60 dark:from-slate-900/80 dark:to-slate-950/80 dark:text-slate-100",
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
