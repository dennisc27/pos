import type { JSX } from "react";
import { AlarmClock, Rocket, Workflow } from "lucide-react";
import type { AutomationPlay } from "./types";

const statusTokens: Record<AutomationPlay["status"], { label: string; className: string }> = {
  active: {
    label: "Activo",
    className: "text-emerald-600 dark:text-emerald-300",
  },
  paused: {
    label: "Pausado",
    className: "text-amber-600 dark:text-amber-300",
  },
  testing: {
    label: "Testing",
    className: "text-sky-600 dark:text-sky-300",
  },
};

const channelTokens: Record<AutomationPlay["channel"], { icon: JSX.Element; label: string }> = {
  sms: { icon: <AlarmClock className="h-4 w-4" />, label: "SMS" },
  email: { icon: <Rocket className="h-4 w-4" />, label: "Email" },
  whatsapp: { icon: <Workflow className="h-4 w-4" />, label: "WhatsApp" },
  push: { icon: <Rocket className="h-4 w-4" />, label: "Push" },
};

const nextStatus: Record<AutomationPlay["status"], AutomationPlay["status"]> = {
  active: "paused",
  paused: "active",
  testing: "active",
};

export function AutomationCenter({
  automations,
  onToggle,
  onEdit,
}: {
  automations: AutomationPlay[];
  onToggle?: (id: string, next: AutomationPlay["status"]) => void;
  onEdit?: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {automations.map((automation) => (
        <article
          key={automation.id}
          className="rounded-xl border border-slate-200/60 bg-white/80 p-4 shadow-sm transition-colors dark:border-slate-800/60 dark:bg-slate-900/40"
        >
          <header className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                {channelTokens[automation.channel].icon}
              </span>
              {automation.trigger}
            </span>
            <span className={`text-xs font-medium ${statusTokens[automation.status].className}`}>
              {statusTokens[automation.status].label}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Audiencia · {automation.audience}</span>
            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
              Próxima ejecución {automation.nextRun}
            </span>
          </header>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{automation.description}</p>
          <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-3">
              <span>Último envío {automation.lastRun}</span>
              <span>Canal {channelTokens[automation.channel].label}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-slate-300 px-3 py-1 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:hover:border-slate-600"
                onClick={() => onEdit?.(automation.id)}
              >
                Editar
              </button>
              <button
                className="rounded-full border border-sky-400/70 px-3 py-1 text-sky-600 transition hover:border-sky-500/70 hover:text-sky-700 dark:border-sky-500/60 dark:text-sky-300"
                onClick={() => onToggle?.(automation.id, nextStatus[automation.status])}
              >
                {automation.status === "active" ? "Pausar" : "Activar"}
              </button>
            </div>
          </footer>
        </article>
      ))}
    </div>
  );
}
