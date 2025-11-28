/**
 * eBay API Adapter
 * Handles all eBay API interactions: listings, inventory, orders, fulfillment
 */

import { eBayAuth } from './ebay-auth.js';

export class eBayAdapter {
  /**
   * @param {Object} channelConfig - Channel configuration from database
   * @param {number} channelConfig.id - Channel ID
   * @param {Object} channelConfig.config - Channel config (credentials, tokens, etc.)
   */
  constructor(channelConfig) {
    this.channelId = channelConfig.id;
    this.config = channelConfig.config;
    
    this.auth = new eBayAuth({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      redirectUri: this.config.redirectUri,
      sandbox: this.config.sandbox || false,
    });
    
    this.baseUrl = this.config.sandbox
      ? 'https://api.sandbox.ebay.com'
      : 'https://api.ebay.com';
    
    this.marketplaceId = this.config.marketplaceId || 'EBAY_US';
  }

  /**
   * Get authenticated request headers with token refresh
   * @returns {Promise<Object>} Headers object
   */
  async getHeaders() {
    const token = await this.auth.getValidToken(
      this.config.accessToken,
      this.config.refreshToken,
      this.config.tokenExpiresAt
    );

    // Update stored token if it was refreshed
    if (token !== this.config.accessToken) {
      this.config.accessToken = token;
      // Note: Caller should update config in database
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': this.marketplaceId,
    };
  }

  /**
   * Create or update listing on eBay
   * @param {Object} listing - Listing data from ecom_listings table
   * @param {Object} productCodeVersion - Product code version with inventory
   * @returns {Promise<{success: boolean, externalId?: string, offerId?: string, error?: any}>}
   */
  async createOrUpdateListing(listing, productCodeVersion) {
    const headers = await this.getHeaders();

    // Map product to eBay inventory item format
    const inventoryItem = {
      sku: productCodeVersion.code,
      product: {
        title: listing.title,
        description: listing.description || '',
        imageUrls: listing.image_urls || [],
        aspects: this.mapAttributes(listing.attributes || {}),
        categoryId: listing.category_mapping?.ebay_category_id,
      },
      condition: listing.attributes?.condition || 'NEW',
      availability: {
        shipToLocation: {
          regionExcluded: [],
        },
        quantity: Math.max(0, productCodeVersion.qty_on_hand - productCodeVersion.qty_reserved),
      },
      pricingSummary: {
        price: {
          value: String((listing.price_cents || productCodeVersion.price_cents) / 100),
          currency: listing.attributes?.currency || 'USD',
        },
      },
      packageWeightAndSize: {
        weight: {
          value: String(listing.attributes?.weight || 1),
          unit: 'POUND',
        },
      },
    };

    try {
      // Create or update inventory item
      const createResponse = await fetch(
        `${this.baseUrl}/sell/inventory/v1/inventory_item/${inventoryItem.sku}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(inventoryItem),
        }
      );

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0]?.message || `HTTP ${createResponse.status}`);
      }

      // Check if offer already exists
      const offersResponse = await fetch(
        `${this.baseUrl}/sell/inventory/v1/offer?sku=${inventoryItem.sku}`,
        { headers }
      );

      let offerId;
      if (offersResponse.ok) {
        const offersData = await offersResponse.json();
        if (offersData.offers && offersData.offers.length > 0) {
          offerId = offersData.offers[0].offerId;
        }
      }

      // Create or update offer
      const offer = {
        sku: inventoryItem.sku,
        marketplaceId: this.marketplaceId,
        format: 'FIXED_PRICE',
        listingDescription: listing.description || '',
        quantity: inventoryItem.availability.quantity,
        pricingSummary: inventoryItem.pricingSummary,
        categoryId: listing.category_mapping?.ebay_category_id,
        merchantLocationKey: this.config.location_key || 'default',
        tax: {
          vatPercentage: 0,
          applyTax: false,
        },
      };

      let offerResponse;
      if (offerId) {
        // Update existing offer
        offerResponse = await fetch(
          `${this.baseUrl}/sell/inventory/v1/offer/${offerId}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify(offer),
          }
        );
      } else {
        // Create new offer
        offerResponse = await fetch(
          `${this.baseUrl}/sell/inventory/v1/offer`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(offer),
          }
        );
      }

      if (!offerResponse.ok) {
        const errorData = await offerResponse.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0]?.message || `HTTP ${offerResponse.status}`);
      }

      const offerData = await offerResponse.json();
      offerId = offerData.offerId || offerId;

      // Publish offer if status is active
      if (listing.status === 'active' && offerId) {
        const publishResponse = await fetch(
          `${this.baseUrl}/sell/inventory/v1/offer/${offerId}/publish`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({}),
          }
        );

        if (!publishResponse.ok) {
          const errorData = await publishResponse.json().catch(() => ({}));
          throw new Error(errorData.errors?.[0]?.message || `HTTP ${publishResponse.status}`);
        }

        const publishData = await publishResponse.json();
        return {
          success: true,
          externalId: publishData.listingId || offerId,
          offerId: offerId,
        };
      }

      return {
        success: true,
        externalId: offerId,
        offerId: offerId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Map listing attributes to eBay product aspects
   * @param {Object} attributes - Listing attributes
   * @returns {Object} eBay aspects object
   */
  mapAttributes(attributes) {
    const aspects = {};
    if (attributes?.brand) aspects.Brand = [attributes.brand];
    if (attributes?.material) aspects.Material = [attributes.material];
    if (attributes?.color) aspects.Color = [attributes.color];
    if (attributes?.size) aspects.Size = [attributes.size];
    if (attributes?.style) aspects.Style = [attributes.style];
    return aspects;
  }

  /**
   * Update inventory quantity on eBay
   * @param {string} sku - Product SKU
   * @param {number} quantity - New quantity
   * @returns {Promise<{success: boolean, error?: any}>}
   */
  async updateInventory(sku, quantity) {
    const headers = await this.getHeaders();

    try {
      // Get current offer
      const offersResponse = await fetch(
        `${this.baseUrl}/sell/inventory/v1/offer?sku=${sku}`,
        { headers }
      );

      if (!offersResponse.ok) {
        throw new Error(`Failed to fetch offers: HTTP ${offersResponse.status}`);
      }

      const offersData = await offersResponse.json();

      if (!offersData.offers || offersData.offers.length === 0) {
        return { success: false, error: 'No offer found for SKU' };
      }

      const offerId = offersData.offers[0].offerId;

      // Get full offer details
      const getOfferResponse = await fetch(
        `${this.baseUrl}/sell/inventory/v1/offer/${offerId}`,
        { headers }
      );

      if (!getOfferResponse.ok) {
        throw new Error(`Failed to fetch offer: HTTP ${getOfferResponse.status}`);
      }

      const offer = await getOfferResponse.json();
      offer.quantity = Math.max(0, quantity);

      // Update offer
      const updateResponse = await fetch(
        `${this.baseUrl}/sell/inventory/v1/offer/${offerId}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(offer),
        }
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0]?.message || `HTTP ${updateResponse.status}`);
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
   * Fetch orders from eBay
   * @param {Object} params - Query parameters
   * @param {number} [params.limit=20] - Number of orders to fetch
   * @param {number} [params.offset=0] - Offset for pagination
   * @param {string} [params.createdAfter] - ISO date string for filtering
   * @returns {Promise<{success: boolean, orders?: Array, total?: number, error?: any}>}
   */
  async fetchOrders(params = {}) {
    const headers = await this.getHeaders();

    const queryParams = new URLSearchParams({
      limit: String(params.limit || 20),
      offset: String(params.offset || 0),
    });

    if (params.createdAfter) {
      queryParams.append('filter', `creationdate:[${params.createdAfter}]`);
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/sell/fulfillment/v1/order?${queryParams.toString()}`,
        { headers }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0]?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        orders: data.orders || [],
        total: data.total || 0,
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
   * Get single order details from eBay
   * @param {string} orderId - eBay order ID
   * @returns {Promise<{success: boolean, order?: Object, error?: any}>}
   */
  async getOrder(orderId) {
    const headers = await this.getHeaders();

    try {
      const response = await fetch(
        `${this.baseUrl}/sell/fulfillment/v1/order/${orderId}`,
        { headers }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0]?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        order: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Fulfill order (mark as shipped) on eBay
   * @param {string} orderId - eBay order ID
   * @param {string} trackingNumber - Tracking number
   * @param {string} carrier - Shipping carrier code (USPS, UPS, FedEx, etc.)
   * @returns {Promise<{success: boolean, error?: any}>}
   */
  async fulfillOrder(orderId, trackingNumber, carrier) {
    const headers = await this.getHeaders();

    try {
      // Get order details first
      const orderResponse = await this.getOrder(orderId);
      if (!orderResponse.success) {
        return orderResponse;
      }

      const fulfillment = {
        lineItems: orderResponse.order.lineItems.map(item => ({
          lineItemId: item.lineItemId,
          quantity: item.quantity,
        })),
        shippedDate: new Date().toISOString(),
        shippingCarrierCode: carrier,
        trackingNumber: trackingNumber,
      };

      const response = await fetch(
        `${this.baseUrl}/sell/fulfillment/v1/order/${orderId}/ship_fulfillment`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(fulfillment),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0]?.message || `HTTP ${response.status}`);
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
   * Cancel order on eBay
   * @param {string} orderId - eBay order ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<{success: boolean, error?: any}>}
   */
  async cancelOrder(orderId, reason) {
    const headers = await this.getHeaders();

    try {
      const response = await fetch(
        `${this.baseUrl}/sell/fulfillment/v1/order/${orderId}/cancel`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ cancelReason: reason || 'BUYER_REQUESTED' }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.errors?.[0]?.message || `HTTP ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }
}

export default eBayAdapter;

