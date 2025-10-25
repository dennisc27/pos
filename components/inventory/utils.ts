const peso = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const quantityFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

export function formatCurrency(value: number, currency: "DOP" | "USD" = "DOP") {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  return peso.format(value);
}

export function formatQuantity(value: number) {
  return quantityFormatter.format(value);
}

export function trendAccent(direction: "up" | "down" | "flat") {
  if (direction === "up") return "text-emerald-400";
  if (direction === "down") return "text-rose-400";
  return "text-slate-400";
}
