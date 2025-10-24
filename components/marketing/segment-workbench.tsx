import type { SegmentRecord } from "./types";

export function SegmentWorkbench({ segments }: { segments: SegmentRecord[] }) {
  return (
    <div className="space-y-3">
      {segments.map((segment) => (
        <article
          key={segment.id}
          className="rounded-xl border border-slate-200/60 bg-white/80 p-4 shadow-sm transition-colors dark:border-slate-800/60 dark:bg-slate-900/40"
        >
          <header className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{segment.name}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                segment.growth.direction === "up"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                  : segment.growth.direction === "down"
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
              }`}
            >
              {segment.growth.label}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Última sync {segment.lastSync}</span>
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {segment.size.toLocaleString()} contactos
            </span>
          </header>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            {segment.traits.map((trait) => (
              <span
                key={trait}
                className="rounded-full bg-slate-50 px-2 py-1 dark:bg-slate-900/60"
              >
                {trait}
              </span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
