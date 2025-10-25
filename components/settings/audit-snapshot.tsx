import type { AuditSnapshot } from "./types";

const statusTokens: Record<AuditSnapshot["status"], { label: string; className: string }> = {
  logged: { label: "Registrado", className: "text-slate-500 dark:text-slate-400" },
  warning: { label: "Alerta", className: "text-amber-600 dark:text-amber-300" },
  error: { label: "Bloqueado", className: "text-rose-600 dark:text-rose-300" }
};

export function AuditSnapshotList({ events }: { events: AuditSnapshot[] }) {
  return (
    <div className="space-y-3">
      {events.map((event) => (
        <article
          key={event.id}
          className="rounded-xl border border-slate-200/60 bg-white/80 p-4 shadow-sm transition-colors dark:border-slate-800/60 dark:bg-slate-900/40"
        >
          <header className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{event.event}</h3>
            <span className={`text-xs font-medium ${statusTokens[event.status].className}`}>
              {statusTokens[event.status].label}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{event.timestamp}</span>
            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">{event.actor}</span>
          </header>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{event.scope}</p>
        </article>
      ))}
    </div>
  );
}
