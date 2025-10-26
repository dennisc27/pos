const peso = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatCurrency(value: number) {
  return peso.format(value);
}

export function toCents(amount: number) {
  return Math.round(Number(amount) * 100);
}

export function fromCents(amountInCents: number | null | undefined) {
  if (!Number.isFinite(amountInCents)) {
    return 0;
  }

  return Math.round(Number(amountInCents)) / 100;
}
