export default function CashMovementsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">Cash</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Cash movements</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Record deposits, paid-ins, paid-outs, and vault transfers. Follow section 2.2 of <code>TODO.md</code> for the
          full experience once the backend endpoints exist.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          When implementing, tie submissions back to the active shift so totals feed directly into the shift-end report.
        </p>
      </section>
    </main>
  );
}
