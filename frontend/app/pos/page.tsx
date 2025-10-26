export default function PosLandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">Point of sale</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Choose a POS workflow
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Use the navigation menu to jump directly into selling, processing refunds, buying from customers, or
          managing gift cards. Each workspace follows the detailed acceptance criteria captured in <code>TODO.md</code>.
        </p>
      </header>
      <section className="grid gap-4 rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This landing page keeps the /pos route functional while dedicated flows live under the sub-routes listed in
          the sidebar. As those experiences are implemented, replace this copy with real shortcuts or KPIs.
        </p>
      </section>
    </main>
  );
}
