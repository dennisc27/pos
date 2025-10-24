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
        "flex flex-col gap-5 rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/70 to-slate-950/90 p-6",
        className
      )}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0 text-xs text-slate-300">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}
