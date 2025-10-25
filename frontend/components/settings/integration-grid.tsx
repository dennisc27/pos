import { Cable, Cloud, ShieldCheck } from "lucide-react";
import type { IntegrationConfig } from "./types";

const statusTokens: Record<IntegrationConfig["status"], { label: string; className: string }> = {
  connected: {
    label: "Conectado",
    className: "text-emerald-600 dark:text-emerald-300"
  },
  warning: {
    label: "Advertencia",
    className: "text-amber-600 dark:text-amber-300"
  },
  disconnected: {
    label: "Sin conexión",
    className: "text-rose-600 dark:text-rose-300"
  }
};

export function IntegrationGrid({ integrations }: { integrations: IntegrationConfig[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {integrations.map((integration) => (
        <article
          key={integration.id}
          className="flex flex-col gap-3 rounded-xl border border-slate-200/60 bg-white/80 p-4 shadow-sm transition-colors dark:border-slate-800/60 dark:bg-slate-900/40"
        >
          <header className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {integration.provider.includes("Supabase") ? (
                <Cloud className="h-5 w-5" />
              ) : integration.provider.includes("Twilio") || integration.provider.includes("WhatsApp") ? (
                <Cable className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </span>
            <div className="flex-1 space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{integration.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{integration.provider}</p>
            </div>
            <span className={`text-xs font-medium ${statusTokens[integration.status].className}`}>
              {statusTokens[integration.status].label}
            </span>
          </header>
          <p className="text-sm text-slate-600 dark:text-slate-300">{integration.detail}</p>
          <footer className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Último sync {integration.lastSync}</span>
            <button className="text-sky-600 transition hover:text-sky-500 dark:text-sky-300">Configurar</button>
          </footer>
        </article>
      ))}
    </div>
  );
}
