export default function ECommercePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">E-Commerce</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          Omni-channel listings and orders
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Connect sales channels, manage listings, and orchestrate fulfillment while keeping store
          inventory in sync.
        </p>
      </header>
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Channel management</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Future updates will cover channel onboarding, webhook monitoring, listing bulk actions, and
          order fulfillment flows from pick to ship.
        </p>
      </section>
    </div>
  );
}
