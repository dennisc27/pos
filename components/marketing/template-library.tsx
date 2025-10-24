import type { JSX } from "react";
import { FileText, MessageCircleHeart, MessageSquareDashed } from "lucide-react";
import type { TemplateRecord } from "./types";

const statusLabels: Record<TemplateRecord["status"], { label: string; className: string }> = {
  approved: {
    label: "Aprobada",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
  },
  pending: {
    label: "En revisión",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
  },
  draft: {
    label: "Borrador",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
  }
};

const channelIcons: Record<TemplateRecord["channel"], JSX.Element> = {
  email: <FileText className="h-4 w-4" />,
  sms: <MessageSquareDashed className="h-4 w-4" />,
  whatsapp: <MessageCircleHeart className="h-4 w-4" />
};

export function TemplateLibrary({ templates }: { templates: TemplateRecord[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {templates.map((template) => (
        <article
          key={template.id}
          className="flex flex-col gap-3 rounded-xl border border-slate-200/60 bg-white/80 p-4 shadow-sm transition-colors dark:border-slate-800/60 dark:bg-slate-900/40"
        >
          <header className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {channelIcons[template.channel]}
            </span>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{template.name}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusLabels[template.status].className}`}
                >
                  {statusLabels[template.status].label}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{template.category}</p>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Editado {template.lastEdited}</span>
          </header>
          <footer className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {template.usageCount} usos 30d
            </span>
            {template.tags?.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-900/60 dark:text-slate-400"
              >
                #{tag}
              </span>
            ))}
          </footer>
        </article>
      ))}
    </div>
  );
}
