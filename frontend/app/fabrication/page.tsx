export default function FabricationPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Fabrication</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          Custom builds and workshop coordination
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Track make-to-order jobs with kanban views, job cards, and material usage integrated with
          the inventory ledger.
        </p>
      </header>
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Workshop pipeline</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Planned features include shared kanban stages, job intake, cost capture, and warranty
          documentation tied to each fabrication order.
        </p>
      </section>
    </div>
  );
}
