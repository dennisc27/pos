/**
 * PRICE CALCULATION UTILITIES
 * 
 * IMPORTANT: In this application, ALL unit prices (unitPriceCents) ALREADY INCLUDE ITBIS (tax).
 * This means:
 * - unitPriceCents = price with tax included
 * - When calculating refunds, totals, or any price operations, use unitPriceCents directly
 * - DO NOT add taxCents to unitPriceCents - that would double-count the tax
 * - taxCents is stored separately for reporting/display purposes only
 * 
 * Formula: unitPriceCents = basePrice + ITBIS (all in one value)
 * 
 * Example:
 * - If an item costs RD$100 with 18% ITBIS:
 *   - basePrice = RD$84.75 (100 / 1.18)
 *   - ITBIS = RD$15.25 (100 - 84.75)
 *   - unitPriceCents = 10000 (represents RD$100.00, tax included)
 *   - taxCents = 1525 (represents RD$15.25, for reporting only)
 * 
 * When refunding RD$100 item:
 * - Refund amount = unitPriceCents (10000) = RD$100.00
 * - DO NOT use: unitPriceCents + taxCents (that would be RD$115.25 - WRONG!)
 */

/**
 * Calculate line total from unit price (which already includes ITBIS)
 * @param unitPriceCents - Price per unit in cents (includes ITBIS)
 * @param quantity - Number of units
 * @returns Total amount in cents (includes ITBIS)
 */
export function calculateLineTotal(unitPriceCents: number, quantity: number): number {
  return Math.round(unitPriceCents * quantity);
}

/**
 * Calculate proportional refund amount for a partial return
 * @param originalTotalCents - Original line total in cents (includes ITBIS)
 * @param originalQuantity - Original quantity purchased
 * @param refundQuantity - Quantity being refunded
 * @returns Refund amount in cents (includes ITBIS)
 */
export function calculateProportionalRefund(
  originalTotalCents: number,
  originalQuantity: number,
  refundQuantity: number
): number {
  if (originalQuantity <= 0) return 0;
  return Math.round((originalTotalCents * refundQuantity) / originalQuantity);
}

/**
 * Calculate unit price from total (for display/calculation purposes)
 * @param totalCents - Total amount in cents (includes ITBIS)
 * @param quantity - Number of units
 * @returns Price per unit in cents (includes ITBIS)
 */
export function calculateUnitPrice(totalCents: number, quantity: number): number {
  if (quantity <= 0) return 0;
  return Math.round(totalCents / quantity);
}

/**
 * Calculate subtotal and tax breakdown from a price that includes ITBIS
 * This is for display/reporting purposes only - the actual price already includes tax
 * @param priceInCents - Price in cents (includes ITBIS)
 * @param taxRate - Tax rate as decimal (e.g., 0.18 for 18%)
 * @returns Object with net (base price), tax, and total amounts in cents
 */
export function breakdownPriceWithTax(
  priceInCents: number,
  taxRate: number = 0.18
): {
  netCents: number;
  taxCents: number;
  totalCents: number;
} {
  const price = priceInCents / 100; // Convert to display value
  const net = Math.round((price / (1 + taxRate)) * 100); // Base price in cents
  const tax = priceInCents - net; // Tax amount in cents
  
  return {
    netCents: net,
    taxCents: tax,
    totalCents: priceInCents, // Total is the original price (includes tax)
  };
}

/**
 * Sum multiple line totals (all prices already include ITBIS)
 * @param lines - Array of line totals in cents
 * @returns Sum in cents (includes ITBIS)
 */
export function sumLineTotals(lines: number[]): number {
  return lines.reduce((sum, total) => sum + total, 0);
}

/**
 * Calculate refund total from refund lines
 * IMPORTANT: Each line's unitPriceCents already includes ITBIS
 * @param refundLines - Array of refund line objects with unitPriceCents and qty
 * @returns Total refund amount in cents (includes ITBIS)
 */
export function calculateRefundTotal(refundLines: Array<{ unitPriceCents: number; qty: number }>): number {
  return refundLines.reduce((sum, line) => {
    return sum + calculateLineTotal(line.unitPriceCents, line.qty);
  }, 0);
}

