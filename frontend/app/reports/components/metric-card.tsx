type MetricCardProps = {
  label: string;
  value: string;
  helperText?: string | null;
};

export function MetricCard({ label, value, helperText }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
      {helperText ? <p className="mt-1 text-xs text-slate-500">{helperText}</p> : null}
    </div>
  );
}

