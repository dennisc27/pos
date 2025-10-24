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

export function formatContactTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffMinutes < 1) {
    return "Hace instantes";
  }

  if (diffMinutes < 60) {
    return `Hace ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24 && now.getDate() === date.getDate()) {
    return `Hoy · ${date.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}`;
  }

  if (diffHours < 48 && now.getDate() - date.getDate() === 1) {
    return `Ayer · ${date.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}`;
  }

  return date.toLocaleString("es-DO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
