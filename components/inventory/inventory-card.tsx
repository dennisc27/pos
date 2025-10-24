import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function InventoryCard({
  title,
  subtitle,
  action,
  className,
  children
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-2xl border bg-gradient-to-b p-6 transition-colors",
        "from-white to-slate-100 border-slate-200/70 text-slate-900 shadow-sm",
        "dark:border-slate-800/70 dark:from-slate-900/70 dark:to-slate-950/90 dark:text-slate-100",
        className
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          {subtitle ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {action ? (
          <div className="shrink-0 text-xs text-slate-600 dark:text-slate-300">{action}</div>
        ) : null}
      </header>
      {children}
    </section>
  );
}
