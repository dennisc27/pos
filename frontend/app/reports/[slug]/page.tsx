import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft, FileText } from "lucide-react";

import { PLACEHOLDER_REPORTS } from "../report-definitions";

export default function ReportPlaceholderPage({ params }: { params: { slug: string } }) {
  const report = PLACEHOLDER_REPORTS[params.slug];

  if (!report) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <div>
        <Link
          href="/reports/all"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to all reports
        </Link>
      </div>

      <header className="space-y-3">
        <p className="text-sm uppercase tracking-wide text-slate-500">Report preview</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{report.title}</h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">{report.description}</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
          <FileText className="mt-1 h-4 w-4 flex-shrink-0 text-indigo-500" />
          <div className="space-y-2">
            <p className="font-medium text-slate-800 dark:text-slate-200">Key insights to highlight:</p>
            <ul className="list-disc space-y-2 pl-5">
              {report.insights?.map((insight) => (
                <li key={insight}>{insight}</li>
              )) ?? (
                <li>Design pending for this report.</li>
              )}
            </ul>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Connect this report to the appropriate backend endpoint and SQL views before release.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
