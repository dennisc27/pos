/**
 * Order Normalization Service
 * Converts marketplace-specific order formats to internal unified format
 */

/**
 * Map eBay order status to internal status
 * @param {string} ebayStatus - eBay order fulfillment status
 * @returns {string} Internal status
 */
function mapEBayOrderStatus(ebayStatus) {
  const statusMap = {
    'FULFILLED': 'fulfilled',
    'IN_PROGRESS': 'paid',
    'PENDING': 'pending',
    'CANCELLED': 'cancelled',
  };
  return statusMap[ebayStatus] || 'pending';
}

/**
 * Map eBay payment status to internal payment status
 * @param {string} ebayStatus - eBay order payment status
 * @returns {string} Internal payment status
 */
function mapEBayPaymentStatus(ebayStatus) {
  const statusMap = {
    'FULLY_PAID': 'paid',
    'PARTIALLY_PAID': 'partial',
    'NOT_PAID': 'unpaid',
    'REFUNDED': 'refunded',
  };
  return statusMap[ebayStatus] || 'unpaid';
}

/**
 * Map Shopify order status to internal status
 * @param {string} financialStatus - Shopify financial status
 * @param {string} fulfillmentStatus - Shopify fulfillment status
 * @returns {string} Internal status
 */
function mapShopifyOrderStatus(financialStatus, fulfillmentStatus) {
  if (fulfillmentStatus === 'fulfilled') {
    return 'fulfilled';
  }
  if (financialStatus === 'paid' || financialStatus === 'partially_paid') {
    return 'paid';
  }
  if (financialStatus === 'refunded' || financialStatus === 'partially_refunded') {
    return 'refunded';
  }
  if (financialStatus === 'voided') {
    return 'cancelled';
  }
  return 'pending';
}

/**
 * Map Shopify payment status to internal payment status
 * @param {string} financialStatus - Shopify financial status
 * @returns {string} Internal payment status
 */
function mapShopifyPaymentStatus(financialStatus) {
  const statusMap = {
    'paid': 'paid',
    'partially_paid': 'partial',
    'pending': 'unpaid',
    'refunded': 'refunded',
    'partially_refunded': 'refunded',
    'voided': 'unpaid',
  };
  return statusMap[financialStatus] || 'unpaid';
}

/**
 * Normalize eBay order to internal format
 * @param {Object} ebayOrder - eBay order object
 * @returns {Object} Normalized order
 */
export function normalizeEBayOrder(ebayOrder) {
  const shippingStep = ebayOrder.fulfillmentStartInstructions?.shippingStep;
  const shipTo = shippingStep?.shipTo;
  const contactAddress = shipTo?.contactAddress;

  return {
    externalId: String(ebayOrder.orderId),
    customerName: `${ebayOrder.buyer?.givenName || ''} ${ebayOrder.buyer?.surname || ''}`.trim() || 'Guest',
    customerEmail: ebayOrder.buyer?.email || null,
    status: mapEBayOrderStatus(ebayOrder.orderFulfillmentStatus),
    paymentStatus: mapEBayPaymentStatus(ebayOrder.orderPaymentStatus),
    shippingAddress: {
      name: shipTo?.fullName || '',
      address1: contactAddress?.addressLine1 || '',
      address2: contactAddress?.addressLine2 || '',
      city: contactAddress?.city || '',
      state: contactAddress?.stateOrProvince || '',
      zip: contactAddress?.postalCode || '',
      country: contactAddress?.countryCode || '',
      phone: shipTo?.primaryPhone?.phoneNumber || '',
    },
    billingAddress: ebayOrder.paymentSummary?.payments?.[0]?.billingAddress || null,
    subtotalCents: Math.round((ebayOrder.pricingSummary?.priceSubtotal?.value || 0) * 100),
    taxCents: Math.round((ebayOrder.pricingSummary?.priceSubtotal?.value || 0) * 100), // Note: eBay may combine tax in subtotal
    shippingCents: Math.round((ebayOrder.pricingSummary?.deliveryCost?.value || 0) * 100),
    totalCents: Math.round((ebayOrder.pricingSummary?.total?.value || 0) * 100),
    currency: ebayOrder.pricingSummary?.total?.currency || 'USD',
    items: (ebayOrder.lineItems || []).map(item => ({
      externalItemId: String(item.lineItemId),
      sku: item.sku || '',
      title: item.title || '',
      quantity: item.quantity || 1,
      priceCents: Math.round((item.lineItemCost?.value || 0) * 100),
    })),
  };
}

/**
 * Normalize Shopify order to internal format
 * @param {Object} shopifyOrder - Shopify order object
 * @returns {Object} Normalized order
 */
export function normalizeShopifyOrder(shopifyOrder) {
  const customer = shopifyOrder.customer;
  const shippingAddress = shopifyOrder.shipping_address;
  const billingAddress = shopifyOrder.billing_address;

  // Determine customer name
  let customerName = 'Guest';
  if (customer?.first_name && customer?.last_name) {
    customerName = `${customer.first_name} ${customer.last_name}`;
  } else if (billingAddress?.name) {
    customerName = billingAddress.name;
  } else if (shippingAddress?.name) {
    customerName = shippingAddress.name;
  }

  return {
    externalId: String(shopifyOrder.id),
    customerName,
    customerEmail: customer?.email || shopifyOrder.email || null,
    status: mapShopifyOrderStatus(shopifyOrder.financial_status, shopifyOrder.fulfillment_status),
    paymentStatus: mapShopifyPaymentStatus(shopifyOrder.financial_status),
    shippingAddress: shippingAddress ? {
      name: shippingAddress.name || '',
      address1: shippingAddress.address1 || '',
      address2: shippingAddress.address2 || '',
      city: shippingAddress.city || '',
      state: shippingAddress.province || '',
      zip: shippingAddress.zip || '',
      country: shippingAddress.country || '',
      phone: shippingAddress.phone || '',
    } : null,
    billingAddress: billingAddress ? {
      name: billingAddress.name || '',
      address1: billingAddress.address1 || '',
      address2: billingAddress.address2 || '',
      city: billingAddress.city || '',
      state: billingAddress.province || '',
      zip: billingAddress.zip || '',
      country: billingAddress.country || '',
      phone: billingAddress.phone || '',
    } : null,
    subtotalCents: Math.round((shopifyOrder.subtotal_price || 0) * 100),
    taxCents: Math.round((shopifyOrder.total_tax || 0) * 100),
    shippingCents: Math.round((shopifyOrder.total_shipping_price_set?.shop_money?.amount || 0) * 100),
    totalCents: Math.round((shopifyOrder.total_price || 0) * 100),
    currency: shopifyOrder.currency || 'USD',
    items: (shopifyOrder.line_items || []).map(item => ({
      externalItemId: String(item.id),
      sku: item.sku || '',
      title: item.title || '',
      quantity: item.quantity || 1,
      priceCents: Math.round((item.price || 0) * 100),
    })),
  };
}

/**
 * Normalize order based on provider
 * @param {Object} rawOrder - Raw order from marketplace
 * @param {string} provider - Provider name ('ebay' or 'shopify')
 * @returns {Object} Normalized order
 * @throws {Error} If provider is not supported
 */
export function normalizeOrder(rawOrder, provider) {
  switch (provider.toLowerCase()) {
    case 'ebay':
      return normalizeEBayOrder(rawOrder);
    case 'shopify':
      return normalizeShopifyOrder(rawOrder);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

export default {
  normalizeOrder,
  normalizeEBayOrder,
  normalizeShopifyOrder,
  mapEBayOrderStatus,
  mapEBayPaymentStatus,
  mapShopifyOrderStatus,
  mapShopifyPaymentStatus,
};

