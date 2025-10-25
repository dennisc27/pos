export default function POSBuyPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Buy from Customer</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          Intake and payout for walk-in sellers
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Capture item details, attach photos, evaluate the offer, and record the cash movement to
          the current shift drawer.
        </p>
      </header>
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Workflow placeholder</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          The final implementation will connect to the purchases endpoint, manage photo uploads, and
          produce a signed receipt for the seller.
        </p>
      </section>
    </div>
  );
}
