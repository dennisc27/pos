export default function CrmCustomersPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">CRM</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Customer directory</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Search, filter, and message customers per section 8.1 of <code>TODO.md</code>. Replace this placeholder with the
          actual directory and profile drawer when ready.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          Reuse shared customer types so blacklisting ties directly into POS and loan eligibility checks.
        </p>
      </section>
    </main>
  );
}
