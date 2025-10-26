export default function CashShiftPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">Cash</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Shift management</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Track opening counts, closing variances, and shift lifecycle events. Replace this placeholder with the
          denomination counter and report widgets outlined in section 2.1 of <code>TODO.md</code>.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          Backend hint: pair this UI with the <code>shifts</code> and <code>cash_movements</code> tables already defined
          in the Drizzle schema.
        </p>
      </section>
    </main>
  );
}
