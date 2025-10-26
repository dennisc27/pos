export default function LoansInstaPawnPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">Loans</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">InstaPawn intake</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Collect remote applications, generate expiring barcodes, and notify customers once the backend services from
          section 3.4 of <code>TODO.md</code> exist.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          When fleshing this out, reuse the collateral capture UI from the main loan wizard so data structures stay in
          sync.
        </p>
      </section>
    </main>
  );
}
