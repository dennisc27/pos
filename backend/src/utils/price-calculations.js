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
 * @param {number} unitPriceCents - Price per unit in cents (includes ITBIS)
 * @param {number} quantity - Number of units
 * @returns {number} Total amount in cents (includes ITBIS)
 */
export function calculateLineTotal(unitPriceCents, quantity) {
  return Math.round(Number(unitPriceCents || 0) * Number(quantity || 0));
}

/**
 * Calculate proportional refund amount for a partial return
 * @param {number} originalTotalCents - Original line total in cents (includes ITBIS)
 * @param {number} originalQuantity - Original quantity purchased
 * @param {number} refundQuantity - Quantity being refunded
 * @returns {number} Refund amount in cents (includes ITBIS)
 */
export function calculateProportionalRefund(originalTotalCents, originalQuantity, refundQuantity) {
  const originalQty = Number(originalQuantity || 0);
  if (originalQty <= 0) return 0;
  
  const originalTotal = Number(originalTotalCents || 0);
  const refundQty = Number(refundQuantity || 0);
  
  return Math.round((originalTotal * refundQty) / originalQty);
}

/**
 * Calculate unit price from total (for display/calculation purposes)
 * @param {number} totalCents - Total amount in cents (includes ITBIS)
 * @param {number} quantity - Number of units
 * @returns {number} Price per unit in cents (includes ITBIS)
 */
export function calculateUnitPrice(totalCents, quantity) {
  const qty = Number(quantity || 0);
  if (qty <= 0) return 0;
  
  const total = Number(totalCents || 0);
  return Math.round(total / qty);
}

/**
 * Calculate subtotal and tax breakdown from a price that includes ITBIS
 * This is for display/reporting purposes only - the actual price already includes tax
 * @param {number} priceInCents - Price in cents (includes ITBIS)
 * @param {number} taxRate - Tax rate as decimal (e.g., 0.18 for 18%)
 * @returns {Object} Object with netCents (base price), taxCents, and totalCents
 */
export function breakdownPriceWithTax(priceInCents, taxRate = 0.18) {
  const price = Number(priceInCents || 0);
  const rate = Number(taxRate || 0);
  
  const priceDisplay = price / 100; // Convert to display value
  const netCents = Math.round((priceDisplay / (1 + rate)) * 100); // Base price in cents
  const taxCents = price - netCents; // Tax amount in cents
  
  return {
    netCents,
    taxCents,
    totalCents: price, // Total is the original price (includes tax)
  };
}

/**
 * Sum multiple line totals (all prices already include ITBIS)
 * @param {number[]} lines - Array of line totals in cents
 * @returns {number} Sum in cents (includes ITBIS)
 */
export function sumLineTotals(lines) {
  if (!Array.isArray(lines)) return 0;
  return lines.reduce((sum, total) => sum + Number(total || 0), 0);
}

/**
 * Calculate refund total from refund lines
 * IMPORTANT: Each line's unitPriceCents already includes ITBIS
 * @param {Array<{unitPriceCents: number, qty: number}>} refundLines - Array of refund line objects
 * @returns {number} Total refund amount in cents (includes ITBIS)
 */
export function calculateRefundTotal(refundLines) {
  if (!Array.isArray(refundLines)) return 0;
  
  return refundLines.reduce((sum, line) => {
    const unitPrice = Number(line.unitPriceCents || 0);
    const qty = Number(line.qty || 0);
    return sum + calculateLineTotal(unitPrice, qty);
  }, 0);
}

