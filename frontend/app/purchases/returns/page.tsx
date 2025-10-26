export default function PurchaseReturnsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">Purchasing</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Supplier returns</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Build the workflow for returning merchandise and issuing supplier credits described in section 6.2 of
          <code>TODO.md</code>. Until then this placeholder avoids 404s.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          Remember to update the inventory ledger and supplier balance when the implementation ships.
        </p>
      </section>
    </main>
  );
}
