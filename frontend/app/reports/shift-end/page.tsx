export default function ReportsShiftEndPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">Reports</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Shift-end report</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Summaries, discrepancies, and exports will live here as described in section 9.1 of <code>TODO.md</code>.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          When implemented, pull data from the same backend aggregations that power shift reconciliation.
        </p>
      </section>
    </main>
  );
}
