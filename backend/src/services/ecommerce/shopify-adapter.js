/**
 * Shopify Admin API Adapter
 * Handles all Shopify API interactions: products, inventory, orders, fulfillment
 */

import { ShopifyAuth } from './shopify-auth.js';

export class ShopifyAdapter {
  /**
   * @param {Object} channelConfig - Channel configuration from database
   * @param {number} channelConfig.id - Channel ID
   * @param {Object} channelConfig.config - Channel config (shop name, access token, etc.)
   */
  constructor(channelConfig) {
    this.channelId = channelConfig.id;
    this.config = channelConfig.config;

    this.auth = new ShopifyAuth({
      shopName: this.config.shopName,
      accessToken: this.config.accessToken,
      apiVersion: this.config.apiVersion || '2024-01',
    });

    this.baseUrl = this.auth.getBaseUrl();
  }

  /**
   * Get authenticated request headers
   * @returns {Object} Headers object
   */
  getHeaders() {
    return this.auth.getHeaders();
  }

  /**
   * Create or update product listing on Shopify
   * @param {Object} listing - Listing data from ecom_listings table
   * @param {Object} productCodeVersion - Product code version with inventory
   * @returns {Promise<{success: boolean, externalId?: string, variantId?: string, inventoryItemId?: string, error?: any}>}
   */
  async createOrUpdateListing(listing, productCodeVersion) {
    const headers = this.getHeaders();

    // Check if product already exists (by SKU)
    const existingProduct = await this.findProductBySku(productCodeVersion.code);

    const productData = {
      title: listing.title,
      body_html: listing.description || '',
      vendor: listing.attributes?.brand || 'Default',
      product_type: listing.category_mapping?.shopify_type || 'General',
      variants: [
        {
          sku: productCodeVersion.code,
          price: String((listing.price_cents || productCodeVersion.price_cents) / 100),
          inventory_quantity: Math.max(0, productCodeVersion.qty_on_hand - productCodeVersion.qty_reserved),
          inventory_management: 'shopify',
          inventory_policy: 'deny', // Prevent overselling
          requires_shipping: true,
          weight: listing.attributes?.weight || 1,
          weight_unit: 'lb',
        },
      ],
      images: (listing.image_urls || []).map((url, index) => ({
        src: url,
        position: index + 1,
      })),
      options: listing.attributes?.options || [{ name: 'Default', values: ['Default'] }],
      status: listing.status === 'active' ? 'active' : 'draft',
      published_scope: listing.status === 'active' ? 'web' : null,
    };

    try {
      let response;
      if (existingProduct) {
        // Update existing product
        response = await fetch(
          `${this.baseUrl}/products/${existingProduct.id}.json`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({ product: { ...productData, id: existingProduct.id } }),
          }
        );
      } else {
        // Create new product
        response = await fetch(
          `${this.baseUrl}/products.json`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ product: productData }),
          }
        );
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const product = data.product;
      const variant = product.variants[0];

      return {
        success: true,
        externalId: String(product.id),
        variantId: String(variant.id),
        inventoryItemId: String(variant.inventory_item_id),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Find product by SKU
   * @param {string} sku - Product SKU
   * @returns {Promise<Object|null>} Product object or null if not found
   */
  async findProductBySku(sku) {
    const headers = this.getHeaders();

    try {
      let page = 1;
      const limit = 250;

      while (true) {
        const response = await fetch(
          `${this.baseUrl}/products.json?limit=${limit}&page=${page}`,
          { headers }
        );

        if (!response.ok) {
          break;
        }

        const data = await response.json();
        const products = data.products || [];

        if (products.length === 0) {
          break;
        }

        for (const product of products) {
          const variant = product.variants.find(v => v.sku === sku);
          if (variant) {
            return { ...product, variant };
          }
        }

        // Check if there are more pages
        const linkHeader = response.headers.get('link');
        if (!linkHeader || !linkHeader.includes('rel="next"')) {
          break;
        }

        page++;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update inventory quantity on Shopify
   * @param {string} inventoryItemId - Shopify inventory item ID
   * @param {number} quantity - New quantity
   * @param {string} [locationId] - Location ID (optional, uses first available if not provided)
   * @returns {Promise<{success: boolean, error?: any}>}
   */
  async updateInventory(inventoryItemId, quantity, locationId) {
    const headers = this.getHeaders();

    try {
      // Get inventory levels
      const levelsResponse = await fetch(
        `${this.baseUrl}/inventory_levels.json?inventory_item_ids=${inventoryItemId}`,
        { headers }
      );

      if (!levelsResponse.ok) {
        throw new Error(`Failed to fetch inventory levels: HTTP ${levelsResponse.status}`);
      }

      const levelsData = await levelsResponse.json();
      const inventoryLevels = levelsData.inventory_levels || [];

      if (inventoryLevels.length === 0) {
        return { success: false, error: 'Inventory level not found' };
      }

      const inventoryLevel = locationId
        ? inventoryLevels.find(level => level.location_id === locationId)
        : inventoryLevels[0];

      if (!inventoryLevel) {
        return { success: false, error: 'Inventory level not found for location' };
      }

      // Set inventory level
      const setResponse = await fetch(
        `${this.baseUrl}/inventory_levels/set.json`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            location_id: locationId || inventoryLevel.location_id,
            inventory_item_id: inventoryItemId,
            available: quantity,
          }),
        }
      );

      if (!setResponse.ok) {
        const errorData = await setResponse.json().catch(() => ({}));
        throw new Error(errorData.errors || `HTTP ${setResponse.status}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Fetch orders from Shopify
   * @param {Object} params - Query parameters
   * @param {number} [params.limit=50] - Number of orders to fetch
   * @param {string} [params.status='any'] - Order status (any, open, closed, cancelled)
   * @param {string} [params.createdAfter] - ISO date string for filtering
   * @returns {Promise<{success: boolean, orders?: Array, error?: any}>}
   */
  async fetchOrders(params = {}) {
    const headers = this.getHeaders();

    const queryParams = new URLSearchParams({
      limit: String(params.limit || 50),
      status: params.status || 'any',
    });

    if (params.createdAfter) {
      queryParams.append('created_at_min', params.createdAfter);
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/orders.json?${queryParams.toString()}`,
        { headers }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors || `HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        orders: data.orders || [],
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error',
        orders: [],
      };
    }
  }

  /**
   * Get single order details from Shopify
   * @param {string} orderId - Shopify order ID
   * @returns {Promise<{success: boolean, order?: Object, error?: any}>}
   */
  async getOrder(orderId) {
    const headers = this.getHeaders();

    try {
      const response = await fetch(
        `${this.baseUrl}/orders/${orderId}.json`,
        { headers }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors || `HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        order: data.order,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Fulfill order (mark as shipped) on Shopify
   * @param {string} orderId - Shopify order ID
   * @param {string} trackingNumber - Tracking number
   * @param {string} carrier - Shipping carrier (USPS, UPS, FedEx, etc.)
   * @param {Array} lineItems - Array of line items to fulfill
   * @returns {Promise<{success: boolean, error?: any}>}
   */
  async fulfillOrder(orderId, trackingNumber, carrier, lineItems) {
    const headers = this.getHeaders();

    const fulfillment = {
      order_id: orderId,
      tracking_number: trackingNumber,
      tracking_company: carrier,
      tracking_urls: [`https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`],
      notify_customer: true,
      line_items: lineItems.map(item => ({
        id: item.line_item_id || item.id,
        quantity: item.quantity,
      })),
    };

    try {
      const response = await fetch(
        `${this.baseUrl}/orders/${orderId}/fulfillments.json`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ fulfillment }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors || `HTTP ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Cancel order on Shopify
   * @param {string} orderId - Shopify order ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<{success: boolean, error?: any}>}
   */
  async cancelOrder(orderId, reason) {
    const headers = this.getHeaders();

    try {
      const response = await fetch(
        `${this.baseUrl}/orders/${orderId}/cancel.json`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason: reason || 'other' }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors || `HTTP ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Create webhook subscription on Shopify
   * @param {string} topic - Webhook topic (e.g., 'orders/create', 'orders/updated')
   * @param {string} callbackUrl - Webhook callback URL
   * @returns {Promise<{success: boolean, webhookId?: string, error?: any}>}
   */
  async createWebhook(topic, callbackUrl) {
    const headers = this.getHeaders();

    try {
      const response = await fetch(
        `${this.baseUrl}/webhooks.json`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            webhook: {
              topic: topic,
              address: callbackUrl,
              format: 'json',
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors || `HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        webhookId: String(data.webhook.id),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }
}

export default ShopifyAdapter;

