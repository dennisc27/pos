import { ReactNode } from "react";

interface ModulePanelProps {
  title: string;
  description?: string;
  icon: ReactNode;
  actions?: ReactNode;
  items: Array<{
    label: string;
    value: string;
    pillColor?: string;
  }>;
}

export function ModulePanel({ title, description, icon, actions, items }: ModulePanelProps) {
  return (
    <section className="glass-panel grid-card-shadow flex flex-col gap-4 rounded-3xl p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900/80 text-xl text-brand-light">
            {icon}
          </span>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description ? (
              <p className="text-sm text-slate-400">{description}</p>
            ) : null}
          </div>
        </div>
        {actions}
      </header>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map(({ label, value, pillColor = "bg-slate-800/80" }) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/50 px-4 py-3"
          >
            <dt className="text-sm text-slate-400">{label}</dt>
            <dd
              className={`rounded-full px-3 py-1 text-sm font-semibold text-white ${pillColor}`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
