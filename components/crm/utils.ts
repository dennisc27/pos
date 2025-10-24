const peso = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatCurrency(value: number) {
  return peso.format(value);
}

export function formatPoints(points: number) {
  const formatter = new Intl.NumberFormat("es-DO");
  return formatter.format(points);
}
