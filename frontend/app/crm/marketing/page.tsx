export default function CrmMarketingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">CRM</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Marketing hub</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Templates, segments, and campaign sending will live here per section 8.2 of <code>TODO.md</code>. Until then
          this placeholder prevents navigation dead ends.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          Align campaign stats with the notifications table defined in the backend schema for reliable reporting.
        </p>
      </section>
    </main>
  );
}
