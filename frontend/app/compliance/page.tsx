export default function CompliancePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Compliance</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          Regulatory filings and watchlists
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Manage mandatory reporting such as police exports, IRS 8300 submissions, OFAC checks, and
          firearms paperwork with complete audit trails.
        </p>
      </header>
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Compliance workspace</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Upcoming widgets will include filing queues, review states, and export/download actions so
          teams can keep regulators up to date without leaving the POS.
        </p>
      </section>
    </div>
  );
}
