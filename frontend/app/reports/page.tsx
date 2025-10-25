export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Reports</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          Performance and compliance reporting
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Generate end-of-shift summaries, loan aging, and other operational analytics with export
          options for leadership teams.
        </p>
      </header>
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Insights dashboard</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Upcoming visualizations will surface tender breakdowns, delinquency trends, and inventory
          KPIs with export-to-PDF tooling.
        </p>
      </section>
    </div>
  );
}
