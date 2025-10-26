export default function PurchasesNewPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">Purchasing</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Receive merchandise</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Capture supplier paperwork, line items, and payouts according to section 6.1 of <code>TODO.md</code>. The real
          experience will hook into ledger postings and label generation.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          While implementing, reuse the money helpers so purchase totals stay consistent with the rest of the platform.
        </p>
      </section>
    </main>
  );
}
