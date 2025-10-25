import type { NotificationPreference } from "./types";

export function NotificationPreferences({ preferences }: { preferences: NotificationPreference[] }) {
  return (
    <div className="space-y-3">
      {preferences.map((preference) => (
        <article
          key={preference.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/60 bg-white/80 p-4 shadow-sm transition-colors dark:border-slate-800/60 dark:bg-slate-900/40"
        >
          <div className="flex-1 min-w-[200px]">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{preference.channel}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{preference.usage}</p>
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {preference.recipients.map((recipient) => (
              <span
                key={recipient}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
              >
                {recipient}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="text-slate-500 dark:text-slate-400">{preference.enabled ? "Activo" : "Inactivo"}</span>
            <button
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                preference.enabled
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-300"
              }`}
            >
              {preference.enabled ? "Activado" : "Activar"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
