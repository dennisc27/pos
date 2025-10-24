export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}
