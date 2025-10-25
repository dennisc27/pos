export default function POSGiftCardPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Gift Card</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          Manage store gift cards
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Issue new cards, reload balances, and redeem against active sales while preventing
          overdrafts.
        </p>
      </header>
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">In development</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          This module will surface card balances, ledger activity, and the actions for issuing,
          reloading, and redeeming codes once the backend endpoints are ready.
        </p>
      </section>
    </div>
  );
}
