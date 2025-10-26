export default function LayawayNewPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">Layaway</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Create a layaway</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Reserve stock, plan installments, and preview agreements as described in section 4.1 of <code>TODO.md</code>.
          This placeholder will be replaced with the actual cart-driven experience.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          Consider reusing components from the POS sale flow for the cart while layering payment scheduling on top.
        </p>
      </section>
    </main>
  );
}
