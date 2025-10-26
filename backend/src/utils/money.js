export const computeNetAndTaxFromTotal = (totalCents) => {
  if (!Number.isFinite(totalCents)) {
    throw new Error('Amount must be a finite number of cents.');
  }

  const netCents = Math.round((totalCents * 82) / 100);
  const taxCents = totalCents - netCents;

  return {
    netCents,
    taxCents,
  };
};
