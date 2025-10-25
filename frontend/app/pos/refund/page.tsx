export default function POSRefundPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Refunds</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          Process returns with policy controls
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Look up invoices, choose approved lines, and determine refund methods with automatic
          restock logic when items return in sellable condition.
        </p>
      </header>
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Coming soon</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          This screen will guide associates through invoice lookup, policy checks, line selection,
          and posting credit notes. It will integrate with the refund API endpoints defined in the
          implementation plan.
        </p>
      </section>
    </div>
  );
}
