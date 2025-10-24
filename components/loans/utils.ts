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

export function trendColor(trend: "up" | "down" | "flat") {
  if (trend === "up") return "text-emerald-600 dark:text-emerald-300";
  if (trend === "down") return "text-rose-500 dark:text-rose-300";
  return "text-slate-600 dark:text-slate-400";
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

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return `Ayer · ${date.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}`;
  }

  return date.toLocaleString("es-DO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
