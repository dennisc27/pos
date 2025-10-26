export default function PosRefundPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">POS · Refunds</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Return an invoice</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Build the refund flow described in <code>TODO.md</code>: search invoices, choose eligible lines, decide on
          restocking, and post the credit back to cash or store credit. This placeholder keeps the route active until
          the real workflow ships.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          Implementation hint: reuse the tender utilities from the sale workspace and lean on the backend endpoints in
          section 1.2 of <code>TODO.md</code> to drive validation and restock logic.
        </p>
      </section>
    </main>
  );
}
