export default function AdminPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Administration</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          Manage users, roles, and devices
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Configure staff access, hardware terminals, and branch-specific settings for the POS
          platform.
        </p>
      </header>
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Control center</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          User provisioning, permissions, and device enrollment workflows will be integrated here to
          match the UI spec.
        </p>
      </section>
    </div>
  );
}
