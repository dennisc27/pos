const peso = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

export function formatCurrency(value: number) {
  return peso.format(value);
}

export function formatPercent(value: number) {
  return percent.format(value);
}

export function statusBadgeColor(status: "active" | "overdue" | "completed") {
  if (status === "completed") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (status === "overdue") {
    return "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300";
  }

  return "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300";
}

export function channelPillColor(channel: "cash" | "card" | "transfer" | "auto") {
  switch (channel) {
    case "card":
      return "bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300";
    case "transfer":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
    case "auto":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
    default:
      return "bg-slate-200 text-slate-700 dark:bg-slate-500/10 dark:text-slate-200";
  }
}
