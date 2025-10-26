export default function SettingsSystemPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">Settings</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">System configuration</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Configure POS behavior, notification providers, and integrations per section 11 of <code>TODO.md</code>. This
          scaffold keeps routing intact until forms and API hooks are in place.
        </p>
      </header>
      <section className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <p>
          Consider building this page with a tabbed layout so scope-specific settings (global, branch, user) are easy to
          manage.
        </p>
      </section>
    </main>
  );
}
