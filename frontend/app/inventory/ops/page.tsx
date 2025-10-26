export default function InventoryOpsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">Inventory</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Inventory operations</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Count sessions, transfers, and quarantine workflows live here. The final experience should satisfy section 5.2
          of <code>TODO.md</code> once backend endpoints land.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          Tie variance posts back to the <code>stock_ledger</code> entries defined in the schema to keep valuation
          accurate.
        </p>
      </section>
    </main>
  );
}
