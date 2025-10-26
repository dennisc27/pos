export default function ReportsLandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">Reports</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Reporting center</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Use the sub-routes to access shift-end and loans-aging insights. Add shortcuts or saved filters here once the
          report modules are implemented.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          Ensure exports reuse the same aggregation logic as the on-screen widgets to avoid discrepancies.
        </p>
      </section>
    </main>
  );
}
