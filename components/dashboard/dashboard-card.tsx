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
        "flex flex-col gap-4 rounded-2xl border border-slate-800/60 bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-6",
        className
      )}
    >
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}
