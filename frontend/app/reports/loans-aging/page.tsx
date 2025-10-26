export default function ReportsLoansAgingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">Reports</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Loans aging</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Visualize balances by bucket, export CSVs, and surface risk indicators as detailed in section 9.2 of
          <code>TODO.md</code>. Placeholder copy keeps navigation alive in the meantime.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          Ensure the backend groups loans by the same thresholds used by frontline teams to avoid confusion.
        </p>
      </section>
    </main>
  );
}
