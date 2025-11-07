import Link from "next/link";

import { ArrowRight } from "lucide-react";

export default function ReportsLandingPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">Reports</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Reporting center</h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Browse the consolidated list of operational and financial reports or jump directly to shift-end and loans-aging
          analytics.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Ensure CSV/PDF exports reuse the same aggregation logic shown on screen so finance and audit teams reconcile
            quickly.
          </div>
          <Link
            href="/reports/all"
            className="inline-flex items-center gap-2 self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            View all reports <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
