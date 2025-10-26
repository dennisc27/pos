export default function RepairsIntakePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">Repairs</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Repair intake</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Intake jobs, capture photos, and collect deposits per section 7.1 of <code>TODO.md</code>. This placeholder keeps the
          routing surface ready for development.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          Feed approved estimates into the board view so technicians always see next actions.
        </p>
      </section>
    </main>
  );
}
