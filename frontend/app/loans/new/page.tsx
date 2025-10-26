export default function LoansNewPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">Loans</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Create a new loan</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Assemble the onboarding wizard outlined in section 3.1 of <code>TODO.md</code>: customer lookup, ID capture,
          collateral details, and printable ticket generation.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          This scaffold keeps routing intact while the underlying steps, validations, and Drizzle mutations are
          implemented.
        </p>
      </section>
    </main>
  );
}
