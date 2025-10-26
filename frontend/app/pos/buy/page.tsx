export default function PosBuyPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">POS · Buy from customer</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Log a walk-in purchase</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Intake items, capture photos, and pay out the seller as described in section 1.3 of <code>TODO.md</code>. The
          UI shell here blocks 404s while the real workflow comes together.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          Consider reusing the shared cart/table components from the sales flow so line-level calculations stay
          consistent across POS operations.
        </p>
      </section>
    </main>
  );
}
