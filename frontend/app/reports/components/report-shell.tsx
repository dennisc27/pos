import type { ReactNode } from "react";
import Link from "next/link";

import { ArrowLeft, Download } from "lucide-react";

const pawnQuickLinks = [
  { href: "/reports/pawns-created", label: "Pawns Created" },
  { href: "/reports/pawns-redeemed", label: "Pawns Redeemed" },
  { href: "/reports/pawns-forfeited", label: "Pawns Forfeited" },
  { href: "/reports/pawns-on-sale", label: "Pawns on Sale" }
];

function formatUpdatedAt(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
}

type ReportPageShellProps = {
  title: string;
  description: string;
  updatedAt?: string | null;
  exportHref?: string | null;
  children: ReactNode;
};

export function ReportPageShell({ title, description, updatedAt, exportHref, children }: ReportPageShellProps) {
  const formatted = formatUpdatedAt(updatedAt);

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-6 py-12">
      <div>
        <Link
          href="/reports/all"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a todos los reportes
        </Link>
      </div>

      <header className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Reportes</p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{description}</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {formatted ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Actualizado {formatted}</p>
            ) : null}
            {exportHref ? (
              <a
                href={exportHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <Download className="h-4 w-4" /> Descargar CSV
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {pawnQuickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50/60 px-3 py-1 text-xs font-medium text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {children}
    </main>
  );
}
