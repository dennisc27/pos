export function DashboardSectionSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm transition-colors dark:border-slate-800/60 dark:bg-slate-900/60">
      <div className="h-4 w-2/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-6 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
