# Pricing Model Documentation

## ⚠️ CRITICAL: ITBIS-Inclusive Pricing

**ALL unit prices in this application ALREADY INCLUDE ITBIS (tax).**

This is a fundamental design decision that affects all price calculations throughout the application.

### Key Principles

1. **unitPriceCents includes ITBIS**
   - When you see `unitPriceCents`, it represents the final price the customer pays
   - This price already includes the tax (ITBIS)
   - Example: If `unitPriceCents = 10000`, the customer pays RD$100.00 (tax included)

2. **taxCents is for reporting only**
   - The `taxCents` field is stored separately for accounting/reporting purposes
   - It shows how much of the price is tax
   - **DO NOT add taxCents to unitPriceCents** - that would double-count the tax

3. **Total calculations**
   - Line total = `unitPriceCents * quantity` (no tax addition needed)
   - Refund amount = `unitPriceCents * refundQuantity` (no tax addition needed)
   - Order total = sum of all line totals (no tax addition needed)

### Example Calculation

**Scenario:** Item costs RD$100.00 with 18% ITBIS

- **Base price (net):** RD$84.75 (100 / 1.18)
- **ITBIS amount:** RD$15.25 (100 - 84.75)
- **unitPriceCents:** 10000 (represents RD$100.00 - **includes tax**)
- **taxCents:** 1525 (represents RD$15.25 - **for reporting only**)

**When refunding:**
- ✅ Correct: Refund = `unitPriceCents` = 10000 = RD$100.00
- ❌ Wrong: Refund = `unitPriceCents + taxCents` = 11525 = RD$115.25

### Code Guidelines

1. **Always use utility functions** from `frontend/lib/price-calculations.ts` or `backend/src/utils/price-calculations.js`
2. **Never add tax to unitPriceCents** - it's already included
3. **Use totalCents directly** for refunds, totals, and calculations
4. **Document any price calculations** that might be unclear

### Utility Functions

#### Frontend (`frontend/lib/price-calculations.ts`)
- `calculateLineTotal(unitPriceCents, quantity)` - Calculate line total
- `calculateProportionalRefund(originalTotal, originalQty, refundQty)` - Calculate partial refund
- `calculateRefundTotal(refundLines)` - Sum refund amounts
- `breakdownPriceWithTax(priceInCents, taxRate)` - Extract net/tax for display

#### Backend (`backend/src/utils/price-calculations.js`)
- Same functions available for server-side calculations

### Common Mistakes to Avoid

❌ **WRONG:**
```javascript
const refund = unitPriceCents + taxCents; // Double-counting tax!
const total = subtotalCents + taxCents; // If subtotal already includes tax
```

✅ **CORRECT:**
```javascript
const refund = unitPriceCents; // Price already includes tax
const total = unitPriceCents * quantity; // Total already includes tax
const refund = calculateProportionalRefund(originalTotal, originalQty, refundQty);
```

### Database Schema

- `order_items.price_cents` - Price per unit (includes ITBIS)
- `sales_return_items.unit_price_cents` - Refund price per unit (includes ITBIS)
- `product_code_versions.price_cents` - Selling price (includes ITBIS)

All price fields store the final price the customer pays, which includes tax.

### When Adding New Features

If you're adding new price calculations:
1. Check if the price already includes tax
2. Use the utility functions from `price-calculations.ts/js`
3. Add a comment explaining the calculation if it's not obvious
4. Test with a known example (e.g., RD$100 item with 18% tax)

