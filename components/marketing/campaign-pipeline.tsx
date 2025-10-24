import type { JSX } from "react";
import { MessageCircleMore, MessageSquareText, Send, Sparkles } from "lucide-react";
import type { CampaignRecord } from "./types";
import { formatCurrency, formatPercent } from "./utils";

const channelIcons: Record<CampaignRecord["channel"], JSX.Element> = {
  sms: <MessageSquareText className="h-4 w-4" />,
  email: <Send className="h-4 w-4" />,
  whatsapp: <MessageCircleMore className="h-4 w-4" />,
  push: <Sparkles className="h-4 w-4" />,
};

const statusStyles: Record<CampaignRecord["status"], string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  scheduled: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
  sending: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
};

const nextStatus: Record<CampaignRecord["status"], CampaignRecord["status"] | null> = {
  draft: "scheduled",
  scheduled: "sending",
  sending: "completed",
  completed: null,
};

export function CampaignPipeline({
  campaigns,
  selectedId,
  onSelect,
  onAdvance,
  onDuplicate,
}: {
  campaigns: CampaignRecord[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onAdvance?: (id: string, next: CampaignRecord["status"] | null) => void;
  onDuplicate?: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {campaigns.map((campaign) => {
        const next = nextStatus[campaign.status];
        const isActive = campaign.id === selectedId;
        return (
          <article
            key={campaign.id}
            className={`rounded-xl border p-4 shadow-sm transition-colors ${
              isActive
                ? "border-sky-500 bg-sky-50/70 dark:border-sky-500/60 dark:bg-sky-500/10"
                : "border-slate-200/60 bg-white/80 dark:border-slate-800/60 dark:bg-slate-900/40"
            }`}
            onClick={() => onSelect?.(campaign.id)}
          >
            <header className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  {channelIcons[campaign.channel]}
                </span>
                {campaign.name}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[campaign.status]}`}>
                {campaign.status === "sending"
                  ? "Enviando"
                  : campaign.status === "scheduled"
                    ? "Programada"
                    : campaign.status === "completed"
                      ? "Completada"
                      : "Borrador"}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{campaign.schedule}</span>
              <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">Owner · {campaign.owner}</span>
            </header>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Segmento</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{campaign.segment}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Entrega</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {campaign.metrics.delivered.toLocaleString()} / {campaign.metrics.sent.toLocaleString()} envíos
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  {campaign.metrics.openRate !== undefined ? (
                    <span>Aperturas {formatPercent(campaign.metrics.openRate)}</span>
                  ) : null}
                  {campaign.metrics.clickRate !== undefined ? (
                    <span>Clicks {formatPercent(campaign.metrics.clickRate)}</span>
                  ) : null}
                  {campaign.metrics.replyRate !== undefined ? (
                    <span>Respuestas {formatPercent(campaign.metrics.replyRate)}</span>
                  ) : null}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Impacto</p>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                  {campaign.metrics.revenue ? formatCurrency(campaign.metrics.revenue) : "--"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {campaign.metrics.revenue ? "Ventas atribuidas" : "Sin atribución aún"}
                </p>
              </div>
            </div>
            <footer className="mt-3 flex flex-wrap items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
              <button
                className="rounded-full border border-slate-300 px-3 py-1 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:hover:border-slate-600"
                onClick={(event) => {
                  event.stopPropagation();
                  onDuplicate?.(campaign.id);
                }}
              >
                Duplicar
              </button>
              <button
                className="rounded-full border border-sky-400/70 px-3 py-1 text-sky-600 transition hover:border-sky-500/70 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-500/60 dark:text-sky-300"
                onClick={(event) => {
                  event.stopPropagation();
                  onAdvance?.(campaign.id, next);
                }}
                disabled={!next}
              >
                {next ? `Avanzar a ${next}` : "Completo"}
              </button>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
