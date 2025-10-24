import type { ShiftPolicy } from "./types";

export function ShiftPolicies({ policies }: { policies: ShiftPolicy[] }) {
  return (
    <div className="space-y-3">
      {policies.map((policy) => (
        <article
          key={policy.id}
          className="rounded-xl border border-slate-200/60 bg-white/80 p-4 shadow-sm transition-colors dark:border-slate-800/60 dark:bg-slate-900/40"
        >
          <header className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{policy.name}</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Actualizado {policy.lastUpdated}</span>
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {policy.requirement}
            </span>
          </header>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{policy.description}</p>
        </article>
      ))}
    </div>
  );
}
