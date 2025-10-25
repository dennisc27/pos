import { Star } from "lucide-react";
import type { ReviewRecord } from "./types";

const sourceLabels: Record<ReviewRecord["source"], string> = {
  google: "Google",
  facebook: "Facebook",
  "in-store": "En tienda",
  survey: "Encuesta",
};

const statusTokens: Record<ReviewRecord["status"], { label: string; className: string }> = {
  new: { label: "Nuevo", className: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200" },
  responded: {
    label: "Respondido",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  flagged: { label: "Revisar", className: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200" },
};

export function ReviewTracker({
  reviews,
  onRespond,
  onFlag,
}: {
  reviews: ReviewRecord[];
  onRespond?: (id: string) => void;
  onFlag?: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <article
          key={review.id}
          className="rounded-xl border border-slate-200/60 bg-white/80 p-4 shadow-sm transition-colors dark:border-slate-800/60 dark:bg-slate-900/40"
        >
          <header className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <span className="flex items-center gap-1 text-amber-500">
                {Array.from({ length: review.rating }).map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-current" />
                ))}
              </span>
              {review.customer}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{sourceLabels[review.source]}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTokens[review.status].className}`}>
              {statusTokens[review.status].label}
            </span>
            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">{review.receivedAt}</span>
          </header>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">“{review.snippet}”</p>
          <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Seguimiento vía {review.channel === "in-store" ? "mostrador" : review.channel.toUpperCase()}</span>
            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-slate-300 px-3 py-1 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:hover:border-slate-600"
                onClick={() => onRespond?.(review.id)}
              >
                Responder
              </button>
              {review.status !== "flagged" ? (
                <button
                  className="rounded-full border border-rose-400/70 px-3 py-1 text-rose-600 transition hover:border-rose-500/70 hover:text-rose-700 dark:border-rose-500/60 dark:text-rose-300"
                  onClick={() => onFlag?.(review.id)}
                >
                  Marcar
                </button>
              ) : null}
            </div>
          </footer>
        </article>
      ))}
    </div>
  );
}
