import Link from "next/link";

import { ArrowRight, FileText } from "lucide-react";

import { REPORT_DEFINITIONS } from "../report-definitions";

export default function AllReportsPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">Reports</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">All reports</h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Jump into any operational or financial report. Each view opens with navigation to return to this
          collection, so staff can explore insights without losing their place.
        </p>
      </header>

      <section className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
          <FileText className="mt-1 h-4 w-4 flex-shrink-0" />
          <p>
            Reports consolidate data from POS, loans, marketing, and accounting modules. Use filters inside each
            module to segment by branch, user, or period before exporting shareable snapshots.
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORT_DEFINITIONS.map((report) => {
          const href = report.href ?? `/reports/${report.key}`;

          return (
            <Link
              key={report.key}
              href={href}
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div>
                <p className="text-sm font-medium text-slate-900 transition group-hover:text-indigo-600 dark:text-slate-100">
                  {report.title}
                </p>
                <p className="mt-1 text-xs text-slate-600 line-clamp-2 dark:text-slate-400">{report.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-400 transition group-hover:text-indigo-500" />
            </Link>
          );
        })}
      </div>
    </main>
  );
}
