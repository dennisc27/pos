import type { SettingsTab } from "./types";

const statusTokens: Record<SettingsTab["status"], { label: string; className: string }> = {
  ok: { label: "Completo", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" },
  review: { label: "Revisar", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" },
  setup: { label: "Pendiente", className: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300" }
};

export function SettingsOverview({ tabs }: { tabs: SettingsTab[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tabs.map((tab) => (
        <article
          key={tab.id}
          className="flex flex-col gap-3 rounded-xl border border-slate-200/60 bg-white/80 p-4 shadow-sm transition-colors dark:border-slate-800/60 dark:bg-slate-900/40"
        >
          <header className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{tab.name}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{tab.description}</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${statusTokens[tab.status].className}`}
            >
              {statusTokens[tab.status].label}
            </span>
          </header>
          <footer className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Responsable · {tab.owner}</span>
            <button className="text-sky-600 transition hover:text-sky-500 dark:text-sky-300">
              Abrir
            </button>
          </footer>
        </article>
      ))}
    </div>
  );
}
