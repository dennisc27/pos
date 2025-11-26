# Ecommerce Implementation Guide: eBay & Shopify Integration

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [eBay Integration](#ebay-integration)
5. [Shopify Integration](#shopify-integration)
6. [Backend Implementation](#backend-implementation)
7. [Frontend Implementation](#frontend-implementation)
8. [Sync Mechanisms](#sync-mechanisms)
9. [Error Handling & Logging](#error-handling--logging)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Checklist](#deployment-checklist)

---

## Overview

This guide details the implementation of ecommerce integration for **eBay** and **Shopify** marketplaces within your POS/Pawnshop system. The integration enables:

- **Bidirectional sync** of products, inventory, and prices
- **Automated order import** and fulfillment
- **Real-time inventory updates** to prevent overselling
- **Returns/RMA management** from online channels
- **Unified reporting** across POS and online sales

### Key Requirements

- **Stock Reservation**: Reserve inventory when orders are created online
- **Price Override**: Allow different online prices vs. POS prices
- **Multi-Branch Support**: Sync inventory from specific branches
- **Audit Trail**: Track all sync operations and changes
- **Error Recovery**: Handle API failures gracefully with retry logic

---

## Architecture

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    POS/INVENTORY SYSTEM                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ product_codes│  │product_code_ │  │ stock_ledger │       │
│  │              │  │  versions    │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                        ↕ SYNC LAYER
┌─────────────────────────────────────────────────────────────┐
│              ECOMMERCE SYNC SERVICE                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ eBay Adapter │  │Shopify Adapter│  │ Sync Queue   │       │
│  │              │  │              │  │ (Bull/Redis) │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                        ↕ API
┌─────────────────────────────────────────────────────────────┐
│              EXTERNAL MARKETPLACES                            │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │     eBay     │  │   Shopify    │                          │
│  │   API v1.0   │  │  Admin API   │                          │
│  └──────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

1. **Adapter Layer**: Provider-specific API communication
2. **Sync Service**: Orchestrates sync operations, handles retries
3. **Queue System**: Manages async sync jobs (Bull/Redis)
4. **Webhook Handlers**: Receives real-time updates from marketplaces
5. **Inventory Manager**: Handles stock reservations and releases

---

## Database Schema

### Existing Tables (Review)

```sql
-- Product catalog
products (id, sku, name, description, category_id, is_active)
product_codes (id, product_id, code, name, sku)
product_code_versions (id, product_code_id, branch_id, price_cents, qty_on_hand, qty_reserved)

-- Orders
orders (id, branch_id, customer_id, status, total_cents)
order_items (id, order_id, code_id, qty, price_cents)

-- Stock tracking
stock_ledger (id, product_code_version_id, qty_change, reason, ref_table, ref_id)
```

### Ecommerce Tables (Already Exist - Verify Structure)

```sql
-- Channels configuration
CREATE TABLE IF NOT EXISTS ecom_channels (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  provider ENUM('shopify', 'woocommerce', 'amazon', 'ebay', 'custom') NOT NULL,
  status ENUM('disconnected', 'connected', 'error') DEFAULT 'disconnected',
  config JSON,  -- Encrypted credentials, sync rules, webhook URLs
  branch_id BIGINT,  -- Optional: restrict to specific branch
  last_sync_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

-- Online listings (one per product_code per channel)
CREATE TABLE IF NOT EXISTS ecom_listings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_code_id BIGINT NOT NULL,
  channel_id BIGINT NOT NULL,
  external_id VARCHAR(160),  -- Marketplace listing ID (e.g., eBay item ID, Shopify product variant ID)
  title VARCHAR(240) NOT NULL,
  description TEXT,
  price_cents BIGINT,  -- Override price (NULL = use product_code_version price)
  status ENUM('draft', 'active', 'inactive', 'archived') DEFAULT 'draft',
  seo_slug VARCHAR(200),
  meta_description TEXT,
  primary_image_url VARCHAR(500),
  image_urls JSON,  -- Array of image URLs
  category_mapping JSON,  -- Marketplace-specific category ID
  attributes JSON,  -- Brand, condition, material, etc.
  sync_status ENUM('pending', 'synced', 'error') DEFAULT 'pending',
  last_synced_at TIMESTAMP NULL,
  sync_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_code_id) REFERENCES product_codes(id),
  FOREIGN KEY (channel_id) REFERENCES ecom_channels(id),
  UNIQUE KEY uniq_listing (product_code_id, channel_id),
  INDEX idx_external_id (external_id),
  INDEX idx_status (status, sync_status)
);

-- Online orders
CREATE TABLE IF NOT EXISTS ecom_orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  channel_id BIGINT NOT NULL,
  external_id VARCHAR(160) NOT NULL,  -- Marketplace order ID
  customer_name VARCHAR(160) NOT NULL,
  customer_email VARCHAR(255),
  status ENUM('pending', 'paid', 'fulfilled', 'cancelled', 'refunded') DEFAULT 'pending',
  payment_status ENUM('unpaid', 'partial', 'paid', 'refunded') DEFAULT 'unpaid',
  shipping_address JSON,  -- Full address object
  billing_address JSON,
  subtotal_cents BIGINT NOT NULL,
  tax_cents BIGINT DEFAULT 0,
  shipping_cents BIGINT DEFAULT 0,
  total_cents BIGINT NOT NULL,
  currency CHAR(3) DEFAULT 'DOP',
  internal_order_id BIGINT NULL,  -- Links to orders table when converted
  tracking_number VARCHAR(120),
  shipping_carrier VARCHAR(60),
  fulfillment_status ENUM('unfulfilled', 'picking', 'packed', 'shipped') DEFAULT 'unfulfilled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES ecom_channels(id),
  FOREIGN KEY (internal_order_id) REFERENCES orders(id),
  UNIQUE KEY uniq_external_order (channel_id, external_id),
  INDEX idx_status (status, fulfillment_status),
  INDEX idx_created_at (created_at)
);

-- Order items
CREATE TABLE IF NOT EXISTS ecom_order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ecom_order_id BIGINT NOT NULL,
  listing_id BIGINT NULL,  -- Links to ecom_listings
  product_code_id BIGINT NULL,  -- Fallback if listing not found
  external_item_id VARCHAR(160),  -- Marketplace item ID
  quantity INT NOT NULL,
  price_cents BIGINT NOT NULL,
  sku VARCHAR(64),
  title VARCHAR(240),
  allocated_branch_id BIGINT NULL,  -- Which branch will fulfill
  allocated_version_id BIGINT NULL,  -- Which product_code_version
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ecom_order_id) REFERENCES ecom_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (listing_id) REFERENCES ecom_listings(id),
  FOREIGN KEY (product_code_id) REFERENCES product_codes(id),
  FOREIGN KEY (allocated_branch_id) REFERENCES branches(id),
  FOREIGN KEY (allocated_version_id) REFERENCES product_code_versions(id)
);

-- Returns/RMA
CREATE TABLE IF NOT EXISTS ecom_returns (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ecom_order_id BIGINT NOT NULL,
  external_rma_id VARCHAR(160),
  status ENUM('requested', 'approved', 'denied', 'received', 'refunded') DEFAULT 'requested',
  reason TEXT,
  refund_method ENUM('original', 'store_credit', 'manual') DEFAULT 'original',
  refund_cents BIGINT,
  restock_condition ENUM('new', 'used', 'damaged', 'not_restockable') NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ecom_order_id) REFERENCES ecom_orders(id),
  INDEX idx_status (status)
);

-- Return items
CREATE TABLE IF NOT EXISTS ecom_return_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ecom_return_id BIGINT NOT NULL,
  ecom_order_item_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  condition ENUM('new', 'used', 'damaged', 'not_restockable') NULL,
  restocked BOOLEAN DEFAULT FALSE,
  restock_version_id BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ecom_return_id) REFERENCES ecom_returns(id) ON DELETE CASCADE,
  FOREIGN KEY (ecom_order_item_id) REFERENCES ecom_order_items(id),
  FOREIGN KEY (restock_version_id) REFERENCES product_code_versions(id)
);

-- Sync logs
CREATE TABLE IF NOT EXISTS ecom_channel_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  channel_id BIGINT NOT NULL,
  operation ENUM('sync_listings', 'sync_orders', 'sync_inventory', 'webhook') NOT NULL,
  status ENUM('success', 'error', 'partial') NOT NULL,
  records_processed INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  error_message TEXT,
  metadata JSON,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (channel_id) REFERENCES ecom_channels(id),
  INDEX idx_channel_operation (channel_id, operation, started_at)
);

-- Webhook logs
CREATE TABLE IF NOT EXISTS ecom_webhook_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  channel_id BIGINT NOT NULL,
  event_type VARCHAR(60) NOT NULL,  -- order.created, inventory.updated, etc.
  payload JSON NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES ecom_channels(id),
  INDEX idx_processed (processed, created_at)
);
```

---

## eBay Integration

### 1. eBay API Setup

#### Prerequisites

1. **eBay Developer Account**: https://developer.ebay.com
2. **Application Keys**: Create app in eBay Developer Portal
   - App ID (Client ID)
   - Client Secret
   - OAuth Redirect URI
3. **OAuth Token**: User authorization token (refreshable)

#### API Endpoints Used

- **OAuth 2.0**: `https://api.ebay.com/identity/v1/oauth2/token`
- **Inventory API**: `https://api.ebay.com/sell/inventory/v1/inventory_item`
- **Fulfillment API**: `https://api.ebay.com/sell/fulfillment/v1/order`
- **Browse API**: `https://api.ebay.com/buy/browse/v1/item`

#### Authentication Flow

```javascript
// backend/src/services/ecommerce/ebay-auth.js
const axios = require('axios');
const crypto = require('crypto');

class eBayAuth {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.sandbox = config.sandbox || false;
    this.baseUrl = this.sandbox 
      ? 'https://api.sandbox.ebay.com' 
      : 'https://api.ebay.com';
  }

  // Step 1: Generate OAuth authorization URL
  getAuthorizationUrl(scopes = ['https://api.ebay.com/oauth/api_scope/sell.inventory']) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
    });
    return `https://auth.ebay.com/oauth2/authorize?${params.toString()}`;
  }

  // Step 2: Exchange authorization code for access token
  async exchangeCodeForToken(authorizationCode) {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const response = await axios.post(
      `${this.baseUrl}/identity/v1/oauth2/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: this.redirectUri,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
      }
    );

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
    };
  }

  // Step 3: Refresh access token
  async refreshAccessToken(refreshToken) {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const response = await axios.post(
      `${this.baseUrl}/identity/v1/oauth2/token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
      }
    );

    return {
      accessToken: response.data.access_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
    };
  }

  // Get valid access token (refresh if needed)
  async getValidToken(storedToken, storedRefreshToken, expiresAt) {
    if (new Date(expiresAt) > new Date(Date.now() + 60000)) { // 1 min buffer
      return storedToken;
    }
    
    const refreshed = await this.refreshAccessToken(storedRefreshToken);
    // Update stored token in database
    return refreshed.accessToken;
  }
}

module.exports = eBayAuth;
```

### 2. eBay Adapter Implementation

```javascript
// backend/src/services/ecommerce/ebay-adapter.js
const axios = require('axios');
const eBayAuth = require('./ebay-auth');

class eBayAdapter {
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
  }

  // Get authenticated request headers
  async getHeaders() {
    const token = await this.auth.getValidToken(
      this.config.accessToken,
      this.config.refreshToken,
      this.config.tokenExpiresAt
    );
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', // or EBAY_ES, etc.
    };
  }

  // Create/Update listing
  async createOrUpdateListing(listing, productCodeVersion) {
    const headers = await this.getHeaders();
    
    // Map your product to eBay inventory item format
    const inventoryItem = {
      sku: productCodeVersion.code,
      product: {
        title: listing.title,
        description: listing.description || '',
        imageUrls: listing.image_urls || [],
        aspects: this.mapAttributes(listing.attributes), // Brand, Material, etc.
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
          currency: 'USD', // or 'DOP' if supported
        },
      },
      packageWeightAndSize: {
        weight: {
          value: listing.attributes?.weight || '1',
          unit: 'POUND',
        },
      },
    };

    try {
      // Create inventory item
      const createResponse = await axios.put(
        `${this.baseUrl}/sell/inventory/v1/inventory_item/${inventoryItem.sku}`,
        inventoryItem,
        { headers }
      );

      // Publish offer (creates active listing)
      const offer = {
        sku: inventoryItem.sku,
        marketplaceId: 'EBAY_US',
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

      const offerResponse = await axios.post(
        `${this.baseUrl}/sell/inventory/v1/offer`,
        offer,
        { headers }
      );

      // Publish offer
      await axios.post(
        `${this.baseUrl}/sell/inventory/v1/offer/${offerResponse.data.offerId}/publish`,
        {},
        { headers }
      );

      return {
        success: true,
        externalId: offerResponse.data.listingId,
        offerId: offerResponse.data.offerId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors || error.message,
      };
    }
  }

  // Map your attributes to eBay aspects
  mapAttributes(attributes) {
    const aspects = {};
    if (attributes?.brand) aspects.Brand = [attributes.brand];
    if (attributes?.material) aspects.Material = [attributes.material];
    if (attributes?.color) aspects.Color = [attributes.color];
    return aspects;
  }

  // Update inventory quantity
  async updateInventory(sku, quantity) {
    const headers = await this.getHeaders();
    
    try {
      // Get current offer
      const offersResponse = await axios.get(
        `${this.baseUrl}/sell/inventory/v1/offer?sku=${sku}`,
        { headers }
      );

      if (offersResponse.data.offers.length === 0) {
        return { success: false, error: 'No offer found for SKU' };
      }

      const offerId = offersResponse.data.offers[0].offerId;
      
      // Update offer quantity
      const updateResponse = await axios.get(
        `${this.baseUrl}/sell/inventory/v1/offer/${offerId}`,
        { headers }
      );

      const offer = updateResponse.data;
      offer.quantity = quantity;

      await axios.put(
        `${this.baseUrl}/sell/inventory/v1/offer/${offerId}`,
        offer,
        { headers }
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors || error.message,
      };
    }
  }

  // Fetch orders
  async fetchOrders(params = {}) {
    const headers = await this.getHeaders();
    
    const queryParams = new URLSearchParams({
      limit: params.limit || 20,
      offset: params.offset || 0,
    });

    if (params.createdAfter) {
      queryParams.append('filter', `creationdate:[${params.createdAfter}]`);
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/sell/fulfillment/v1/order?${queryParams.toString()}`,
        { headers }
      );

      return {
        success: true,
        orders: response.data.orders || [],
        total: response.data.total || 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors || error.message,
        orders: [],
      };
    }
  }

  // Get order details
  async getOrder(orderId) {
    const headers = await this.getHeaders();
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/sell/fulfillment/v1/order/${orderId}`,
        { headers }
      );

      return {
        success: true,
        order: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors || error.message,
      };
    }
  }

  // Fulfill order (mark as shipped)
  async fulfillOrder(orderId, trackingNumber, carrier) {
    const headers = await this.getHeaders();
    
    const fulfillment = {
      lineItems: [], // Will be populated from order
      shippedDate: new Date().toISOString(),
      shippingCarrierCode: carrier, // 'USPS', 'UPS', 'FedEx', etc.
      trackingNumber: trackingNumber,
    };

    try {
      const orderResponse = await this.getOrder(orderId);
      if (!orderResponse.success) {
        return orderResponse;
      }

      fulfillment.lineItems = orderResponse.order.lineItems.map(item => ({
        lineItemId: item.lineItemId,
        quantity: item.quantity,
      }));

      await axios.post(
        `${this.baseUrl}/sell/fulfillment/v1/order/${orderId}/ship_fulfillment`,
        fulfillment,
        { headers }
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors || error.message,
      };
    }
  }

  // Cancel order
  async cancelOrder(orderId, reason) {
    const headers = await this.getHeaders();
    
    try {
      await axios.post(
        `${this.baseUrl}/sell/fulfillment/v1/order/${orderId}/cancel`,
        { cancelReason: reason },
        { headers }
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors || error.message,
      };
    }
  }
}

module.exports = eBayAdapter;
```

### 3. eBay Webhook Setup

eBay uses **webhooks** for real-time order notifications:

```javascript
// backend/src/routes/ecom-webhooks.js
const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');
const { ecomWebhookLogs, ecomOrders } = require('../db/schema');
const { eq } = require('drizzle-orm');
const eBayAdapter = require('../services/ecommerce/ebay-adapter');

// eBay webhook endpoint
router.post('/ebay/:channelId', async (req, res) => {
  const { channelId } = req.params;
  const signature = req.headers['x-ebay-signature'];
  const payload = req.body;

  try {
    // Verify webhook signature (eBay provides signature verification)
    // Store webhook log
    await db.insert(ecomWebhookLogs).values({
      channelId: Number(channelId),
      eventType: payload.notification?.topic || 'unknown',
      payload: payload,
      processed: false,
    });

    // Process webhook asynchronously
    processWebhook(channelId, payload).catch(console.error);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function processWebhook(channelId, payload) {
  const topic = payload.notification?.topic;
  
  switch (topic) {
    case 'ORDER.CREATED':
    case 'ORDER.UPDATED':
      await handleOrderWebhook(channelId, payload);
      break;
    case 'INVENTORY.UPDATED':
      await handleInventoryWebhook(channelId, payload);
      break;
    default:
      console.log(`Unhandled webhook topic: ${topic}`);
  }
}

async function handleOrderWebhook(channelId, payload) {
  // Fetch channel config
  const channel = await getChannel(channelId);
  const adapter = new eBayAdapter(channel);
  
  // Get order ID from webhook
  const orderId = payload.notification?.data?.orderId;
  if (!orderId) return;

  // Fetch full order details
  const orderResponse = await adapter.getOrder(orderId);
  if (!orderResponse.success) return;

  // Import order (same as manual import)
  await importOrder(channelId, orderResponse.order);
}
```

---

## Shopify Integration

### 1. Shopify API Setup

#### Prerequisites

1. **Shopify Partner Account**: https://partners.shopify.com
2. **Shopify App**: Create custom app in Shopify Admin
   - API Key (Client ID)
   - API Secret
   - Admin API Access Token
3. **Webhook Endpoints**: Register webhook URLs

#### API Endpoints Used

- **Admin API**: `https://{shop}.myshopify.com/admin/api/2024-01/`
- **GraphQL Admin API**: `https://{shop}.myshopify.com/admin/api/2024-01/graphql.json`
- **REST Admin API**: `https://{shop}.myshopify.com/admin/api/2024-01/`

#### Authentication

Shopify uses **Admin API Access Tokens** (no OAuth refresh needed for private apps):

```javascript
// backend/src/services/ecommerce/shopify-auth.js
class ShopifyAuth {
  constructor(config) {
    this.shopName = config.shopName; // e.g., 'mystore'
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion || '2024-01';
  }

  getBaseUrl() {
    return `https://${this.shopName}.myshopify.com/admin/api/${this.apiVersion}`;
  }

  getHeaders() {
    return {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json',
    };
  }
}

module.exports = ShopifyAuth;
```

### 2. Shopify Adapter Implementation

```javascript
// backend/src/services/ecommerce/shopify-adapter.js
const axios = require('axios');
const ShopifyAuth = require('./shopify-auth');

class ShopifyAdapter {
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

  // Create/Update product
  async createOrUpdateListing(listing, productCodeVersion) {
    const headers = this.auth.getHeaders();
    
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
          inventory_management: 'shopify', // or 'not_managed'
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
        response = await axios.put(
          `${this.baseUrl}/products/${existingProduct.id}.json`,
          { product: { ...productData, id: existingProduct.id } },
          { headers }
        );
      } else {
        // Create new product
        response = await axios.post(
          `${this.baseUrl}/products.json`,
          { product: productData },
          { headers }
        );
      }

      const product = response.data.product;
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
        error: error.response?.data?.errors || error.message,
      };
    }
  }

  // Find product by SKU
  async findProductBySku(sku) {
    const headers = this.auth.getHeaders();
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/products.json?limit=250`,
        { headers }
      );

      for (const product of response.data.products || []) {
        const variant = product.variants.find(v => v.sku === sku);
        if (variant) {
          return { ...product, variant };
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Update inventory quantity
  async updateInventory(inventoryItemId, quantity, locationId) {
    const headers = this.auth.getHeaders();
    
    try {
      // Get inventory levels
      const levelsResponse = await axios.get(
        `${this.baseUrl}/inventory_levels.json?inventory_item_ids=${inventoryItemId}`,
        { headers }
      );

      const inventoryLevel = levelsResponse.data.inventory_levels[0];
      if (!inventoryLevel) {
        return { success: false, error: 'Inventory level not found' };
      }

      // Set inventory level
      await axios.post(
        `${this.baseUrl}/inventory_levels/set.json`,
        {
          location_id: locationId || inventoryLevel.location_id,
          inventory_item_id: inventoryItemId,
          available: quantity,
        },
        { headers }
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors || error.message,
      };
    }
  }

  // Fetch orders
  async fetchOrders(params = {}) {
    const headers = this.auth.getHeaders();
    
    const queryParams = new URLSearchParams({
      limit: params.limit || 50,
      status: params.status || 'any', // any, open, closed, cancelled
    });

    if (params.createdAfter) {
      queryParams.append('created_at_min', params.createdAfter);
    }

    try {
      const response = await axios.get(
        `${this.baseUrl}/orders.json?${queryParams.toString()}`,
        { headers }
      );

      return {
        success: true,
        orders: response.data.orders || [],
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors || error.message,
        orders: [],
      };
    }
  }

  // Get order details
  async getOrder(orderId) {
    const headers = this.auth.getHeaders();
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/orders/${orderId}.json`,
        { headers }
      );

      return {
        success: true,
        order: response.data.order,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors || error.message,
      };
    }
  }

  // Fulfill order
  async fulfillOrder(orderId, trackingNumber, carrier, lineItems) {
    const headers = this.auth.getHeaders();
    
    const fulfillment = {
      order_id: orderId,
      tracking_number: trackingNumber,
      tracking_company: carrier, // 'USPS', 'UPS', 'FedEx', etc.
      tracking_urls: [`https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`],
      notify_customer: true,
      line_items: lineItems.map(item => ({
        id: item.line_item_id,
        quantity: item.quantity,
      })),
    };

    try {
      await axios.post(
        `${this.baseUrl}/orders/${orderId}/fulfillments.json`,
        { fulfillment },
        { headers }
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors || error.message,
      };
    }
  }

  // Cancel order
  async cancelOrder(orderId, reason) {
    const headers = this.auth.getHeaders();
    
    try {
      await axios.post(
        `${this.baseUrl}/orders/${orderId}/cancel.json`,
        { reason: reason || 'other' },
        { headers }
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors || error.message,
      };
    }
  }

  // Create webhook subscription
  async createWebhook(topic, callbackUrl) {
    const headers = this.auth.getHeaders();
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/webhooks.json`,
        {
          webhook: {
            topic: topic, // 'orders/create', 'orders/updated', 'inventory_levels/update'
            address: callbackUrl,
            format: 'json',
          },
        },
        { headers }
      );

      return {
        success: true,
        webhookId: response.data.webhook.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.errors || error.message,
      };
    }
  }
}

module.exports = ShopifyAdapter;
```

### 3. Shopify Webhook Setup

```javascript
// backend/src/routes/ecom-webhooks.js (continued)
const crypto = require('crypto');
const ShopifyAdapter = require('../services/ecommerce/shopify-adapter');

// Shopify webhook endpoint
router.post('/shopify/:channelId', async (req, res) => {
  const { channelId } = req.params;
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const shop = req.headers['x-shopify-shop-domain'];
  const topic = req.headers['x-shopify-topic'];
  const payload = req.body;

  try {
    // Verify webhook signature
    const channel = await getChannel(channelId);
    const calculatedHmac = crypto
      .createHmac('sha256', channel.config.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('base64');

    if (calculatedHmac !== hmac) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Store webhook log
    await db.insert(ecomWebhookLogs).values({
      channelId: Number(channelId),
      eventType: topic,
      payload: payload,
      processed: false,
    });

    // Process webhook asynchronously
    processShopifyWebhook(channelId, topic, payload).catch(console.error);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function processShopifyWebhook(channelId, topic, payload) {
  switch (topic) {
    case 'orders/create':
      await handleOrderCreated(channelId, payload);
      break;
    case 'orders/updated':
      await handleOrderUpdated(channelId, payload);
      break;
    case 'orders/cancelled':
      await handleOrderCancelled(channelId, payload);
      break;
    case 'inventory_levels/update':
      await handleInventoryUpdate(channelId, payload);
      break;
    default:
      console.log(`Unhandled webhook topic: ${topic}`);
  }
}

async function handleOrderCreated(channelId, orderData) {
  // Import order
  await importOrder(channelId, orderData);
}
```

---

## Backend Implementation

### 1. API Endpoints

```javascript
// backend/src/routes/ecom.js
const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');
const { ecomChannels, ecomListings, ecomOrders } = require('../db/schema');
const { eq, and } = require('drizzle-orm');
const eBayAdapter = require('../services/ecommerce/ebay-adapter');
const ShopifyAdapter = require('../services/ecommerce/shopify-adapter');

// Get adapter instance
function getAdapter(channel) {
  switch (channel.provider) {
    case 'ebay':
      return new eBayAdapter(channel);
    case 'shopify':
      return new ShopifyAdapter(channel);
    default:
      throw new Error(`Unsupported provider: ${channel.provider}`);
  }
}

// ========== CHANNELS ==========

// List channels
router.get('/channels', async (req, res) => {
  try {
    const channels = await db.select().from(ecomChannels);
    res.json({ channels });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create channel
router.post('/channels', async (req, res) => {
  try {
    const { name, provider, config, branchId } = req.body;
    
    // Validate provider-specific config
    if (provider === 'ebay') {
      if (!config.clientId || !config.clientSecret) {
        return res.status(400).json({ error: 'Missing eBay credentials' });
      }
    } else if (provider === 'shopify') {
      if (!config.shopName || !config.accessToken) {
        return res.status(400).json({ error: 'Missing Shopify credentials' });
      }
    }

    // Test connection
    const channel = { id: 0, config };
    const adapter = getAdapter({ provider, config });
    
    // Simple connection test (fetch orders with limit 1)
    const testResult = await adapter.fetchOrders({ limit: 1 });
    if (!testResult.success) {
      return res.status(400).json({ error: `Connection test failed: ${testResult.error}` });
    }

    // Create channel
    const [newChannel] = await db.insert(ecomChannels).values({
      name,
      provider,
      config: JSON.stringify(config), // Encrypt in production
      branchId: branchId || null,
      status: 'connected',
    });

    res.json({ channel: newChannel });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test channel connection
router.post('/channels/:id/test', async (req, res) => {
  try {
    const channel = await db.select().from(ecomChannels).where(eq(ecomChannels.id, req.params.id)).limit(1);
    if (!channel.length) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const adapter = getAdapter(channel[0]);
    const testResult = await adapter.fetchOrders({ limit: 1 });

    if (testResult.success) {
      await db.update(ecomChannels)
        .set({ status: 'connected', lastSyncAt: new Date() })
        .where(eq(ecomChannels.id, req.params.id));
    } else {
      await db.update(ecomChannels)
        .set({ status: 'error' })
        .where(eq(ecomChannels.id, req.params.id));
    }

    res.json({ success: testResult.success, error: testResult.error });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== LISTINGS ==========

// Sync listings to channel
router.post('/listings/sync', async (req, res) => {
  try {
    const { channelId, listingIds } = req.body;
    
    const channel = await db.select().from(ecomChannels).where(eq(ecomChannels.id, channelId)).limit(1);
    if (!channel.length) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const adapter = getAdapter(channel[0]);
    const results = [];

    for (const listingId of listingIds) {
      const listing = await db.select()
        .from(ecomListings)
        .where(eq(ecomListings.id, listingId))
        .limit(1);

      if (!listing.length) continue;

      // Get product code version
      const version = await getProductCodeVersion(listing[0].productCodeId, channel[0].branchId);

      // Sync to marketplace
      const syncResult = await adapter.createOrUpdateListing(listing[0], version);
      
      if (syncResult.success) {
        await db.update(ecomListings)
          .set({
            externalId: syncResult.externalId,
            syncStatus: 'synced',
            lastSyncedAt: new Date(),
            syncError: null,
          })
          .where(eq(ecomListings.id, listingId));
      } else {
        await db.update(ecomListings)
          .set({
            syncStatus: 'error',
            syncError: JSON.stringify(syncResult.error),
          })
          .where(eq(ecomListings.id, listingId));
      }

      results.push({ listingId, success: syncResult.success, error: syncResult.error });
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ORDERS ==========

// Import orders from channel
router.post('/orders/import', async (req, res) => {
  try {
    const { channelId, orders: rawOrders } = req.body;
    
    const channel = await db.select().from(ecomChannels).where(eq(ecomChannels.id, channelId)).limit(1);
    if (!channel.length) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const adapter = getAdapter(channel[0]);
    const results = { created: 0, updated: 0, errors: [] };

    for (const rawOrder of rawOrders) {
      try {
        const order = await normalizeOrder(rawOrder, channel[0].provider);
        
        // Check if order exists
        const existing = await db.select()
          .from(ecomOrders)
          .where(
            and(
              eq(ecomOrders.channelId, channelId),
              eq(ecomOrders.externalId, order.externalId)
            )
          )
          .limit(1);

        if (existing.length) {
          // Update existing order
          await db.update(ecomOrders)
            .set({
              status: order.status,
              paymentStatus: order.paymentStatus,
              totalCents: order.totalCents,
              updatedAt: new Date(),
            })
            .where(eq(ecomOrders.id, existing[0].id));
          results.updated++;
        } else {
          // Create new order
          const [newOrder] = await db.insert(ecomOrders).values({
            channelId,
            externalId: order.externalId,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            status: order.status,
            paymentStatus: order.paymentStatus,
            shippingAddress: JSON.stringify(order.shippingAddress),
            billingAddress: JSON.stringify(order.billingAddress),
            subtotalCents: order.subtotalCents,
            taxCents: order.taxCents,
            shippingCents: order.shippingCents,
            totalCents: order.totalCents,
            currency: order.currency,
          });

          // Create order items
          for (const item of order.items) {
            await db.insert(ecomOrderItems).values({
              ecomOrderId: newOrder.id,
              listingId: item.listingId,
              productCodeId: item.productCodeId,
              externalItemId: item.externalItemId,
              quantity: item.quantity,
              priceCents: item.priceCents,
              sku: item.sku,
              title: item.title,
            });
          }

          // Reserve inventory
          await reserveInventoryForOrder(newOrder.id);

          results.created++;
        }
      } catch (error) {
        results.errors.push({ order: rawOrder.externalId, error: error.message });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fulfill order
router.post('/orders/:id/fulfill', async (req, res) => {
  try {
    const { trackingNumber, carrier } = req.body;
    
    const order = await db.select()
      .from(ecomOrders)
      .where(eq(ecomOrders.id, req.params.id))
      .limit(1);

    if (!order.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const channel = await db.select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, order[0].channelId))
      .limit(1);

    const adapter = getAdapter(channel[0]);
    
    // Get order items
    const items = await db.select()
      .from(ecomOrderItems)
      .where(eq(ecomOrderItems.ecomOrderId, order[0].id));

    // Fulfill on marketplace
    const fulfillResult = await adapter.fulfillOrder(
      order[0].externalId,
      trackingNumber,
      carrier,
      items
    );

    if (fulfillResult.success) {
      // Update order status
      await db.update(ecomOrders)
        .set({
          fulfillmentStatus: 'shipped',
          status: 'fulfilled',
          trackingNumber,
          shippingCarrier: carrier,
          updatedAt: new Date(),
        })
        .where(eq(ecomOrders.id, order[0].id));

      // Convert to internal order
      await convertToInternalOrder(order[0].id);
    }

    res.json({ success: fulfillResult.success, error: fulfillResult.error });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### 2. Order Normalization

```javascript
// backend/src/services/ecommerce/order-normalizer.js

function normalizeEBayOrder(ebayOrder) {
  return {
    externalId: String(ebayOrder.orderId),
    customerName: `${ebayOrder.buyer?.givenName || ''} ${ebayOrder.buyer?.surname || ''}`.trim(),
    customerEmail: ebayOrder.buyer?.email || null,
    status: mapEBayOrderStatus(ebayOrder.orderFulfillmentStatus),
    paymentStatus: mapEBayPaymentStatus(ebayOrder.orderPaymentStatus),
    shippingAddress: {
      name: ebayOrder.fulfillmentStartInstructions?.shippingStep?.shipTo?.fullName,
      address1: ebayOrder.fulfillmentStartInstructions?.shippingStep?.shipTo?.contactAddress?.addressLine1,
      address2: ebayOrder.fulfillmentStartInstructions?.shippingStep?.shipTo?.contactAddress?.addressLine2,
      city: ebayOrder.fulfillmentStartInstructions?.shippingStep?.shipTo?.contactAddress?.city,
      state: ebayOrder.fulfillmentStartInstructions?.shippingStep?.shipTo?.contactAddress?.stateOrProvince,
      zip: ebayOrder.fulfillmentStartInstructions?.shippingStep?.shipTo?.contactAddress?.postalCode,
      country: ebayOrder.fulfillmentStartInstructions?.shippingStep?.shipTo?.contactAddress?.countryCode,
    },
    billingAddress: ebayOrder.paymentSummary?.payments?.[0]?.billingAddress || null,
    subtotalCents: Math.round((ebayOrder.pricingSummary?.priceSubtotal?.value || 0) * 100),
    taxCents: Math.round((ebayOrder.pricingSummary?.priceSubtotal?.value || 0) * 100),
    shippingCents: Math.round((ebayOrder.pricingSummary?.deliveryCost?.value || 0) * 100),
    totalCents: Math.round((ebayOrder.pricingSummary?.total?.value || 0) * 100),
    currency: ebayOrder.pricingSummary?.total?.currency || 'USD',
    items: ebayOrder.lineItems.map(item => ({
      externalItemId: String(item.lineItemId),
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
      priceCents: Math.round((item.lineItemCost?.value || 0) * 100),
    })),
  };
}

function normalizeShopifyOrder(shopifyOrder) {
  return {
    externalId: String(shopifyOrder.id),
    customerName: shopifyOrder.customer?.first_name && shopifyOrder.customer?.last_name
      ? `${shopifyOrder.customer.first_name} ${shopifyOrder.customer.last_name}`
      : shopifyOrder.billing_address?.name || 'Guest',
    customerEmail: shopifyOrder.customer?.email || shopifyOrder.email || null,
    status: mapShopifyOrderStatus(shopifyOrder.financial_status, shopifyOrder.fulfillment_status),
    paymentStatus: mapShopifyPaymentStatus(shopifyOrder.financial_status),
    shippingAddress: shopifyOrder.shipping_address || null,
    billingAddress: shopifyOrder.billing_address || null,
    subtotalCents: Math.round((shopifyOrder.subtotal_price || 0) * 100),
    taxCents: Math.round((shopifyOrder.total_tax || 0) * 100),
    shippingCents: Math.round((shopifyOrder.total_shipping_price_set?.shop_money?.amount || 0) * 100),
    totalCents: Math.round((shopifyOrder.total_price || 0) * 100),
    currency: shopifyOrder.currency || 'USD',
    items: shopifyOrder.line_items.map(item => ({
      externalItemId: String(item.id),
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
      priceCents: Math.round((item.price || 0) * 100),
    })),
  };
}

function normalizeOrder(rawOrder, provider) {
  switch (provider) {
    case 'ebay':
      return normalizeEBayOrder(rawOrder);
    case 'shopify':
      return normalizeShopifyOrder(rawOrder);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

module.exports = { normalizeOrder };
```

### 3. Inventory Reservation

```javascript
// backend/src/services/ecommerce/inventory-reservation.js

async function reserveInventoryForOrder(ecomOrderId) {
  const order = await db.select()
    .from(ecomOrders)
    .where(eq(ecomOrders.id, ecomOrderId))
    .limit(1);

  if (!order.length) throw new Error('Order not found');

  const items = await db.select()
    .from(ecomOrderItems)
    .where(eq(ecomOrderItems.ecomOrderId, ecomOrderId));

  for (const item of items) {
    // Find product code version to reserve from
    const version = await findAvailableVersion(item.productCodeId, item.quantity, order[0].channelId);

    if (!version) {
      throw new Error(`Insufficient inventory for SKU: ${item.sku}`);
    }

    // Reserve inventory
    await db.update(productCodeVersions)
      .set({
        qtyReserved: version.qty_reserved + item.quantity,
      })
      .where(eq(productCodeVersions.id, version.id));

    // Update order item with allocation
    await db.update(ecomOrderItems)
      .set({
        allocatedBranchId: version.branch_id,
        allocatedVersionId: version.id,
      })
      .where(eq(ecomOrderItems.id, item.id));

    // Log reservation
    await db.insert(stockLedger).values({
      productCodeVersionId: version.id,
      qtyChange: -item.quantity,
      reason: 'sale',
      refTable: 'ecom_orders',
      refId: ecomOrderId,
    });
  }
}

async function findAvailableVersion(productCodeId, quantity, channelId) {
  // Get channel branch restriction
  const channel = await db.select()
    .from(ecomChannels)
    .where(eq(ecomChannels.id, channelId))
    .limit(1);

  const branchId = channel[0]?.branchId;

  // Find versions with available stock
  const versions = await db.select()
    .from(productCodeVersions)
    .where(
      and(
        eq(productCodeVersions.productCodeId, productCodeId),
        branchId ? eq(productCodeVersions.branchId, branchId) : undefined,
        sql`${productCodeVersions.qtyOnHand} - ${productCodeVersions.qtyReserved} >= ${quantity}`
      )
    )
    .orderBy(desc(productCodeVersions.qtyOnHand));

  return versions[0] || null;
}
```

---

## Frontend Implementation

### 1. Channel Configuration Page

```typescript
// frontend/app/ecom/channels/page.tsx (Enhanced)

"use client";

import { useState, useEffect } from "react";
import { Settings, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

type Channel = {
  id: number;
  name: string;
  provider: "ebay" | "shopify";
  status: "connected" | "disconnected" | "error";
  lastSyncAt: string | null;
};

export default function EcomChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    provider: "shopify" as "ebay" | "shopify",
    // eBay fields
    clientId: "",
    clientSecret: "",
    // Shopify fields
    shopName: "",
    accessToken: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const config = formData.provider === "ebay"
      ? {
          clientId: formData.clientId,
          clientSecret: formData.clientSecret,
          sandbox: true, // Start with sandbox
        }
      : {
          shopName: formData.shopName,
          accessToken: formData.accessToken,
        };

    const response = await fetch("/api/ecom/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.name,
        provider: formData.provider,
        config,
      }),
    });

    if (response.ok) {
      setShowForm(false);
      fetchChannels();
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Sales Channels</h1>
        <p className="text-sm text-muted-foreground">
          Connect and manage your marketplace integrations
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {channels.map((channel) => (
          <div key={channel.id} className="rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{channel.name}</h3>
              {channel.status === "connected" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-rose-500" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Provider: {channel.provider}
            </p>
            <p className="text-xs text-muted-foreground">
              Last sync: {channel.lastSyncAt 
                ? new Date(channel.lastSyncAt).toLocaleString()
                : "Never"}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => testConnection(channel.id)}
                className="text-xs px-3 py-1.5 rounded border"
              >
                Test
              </button>
              <button
                onClick={() => syncNow(channel.id)}
                className="text-xs px-3 py-1.5 rounded bg-primary text-white"
              >
                Sync Now
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Add Channel</h2>
          
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded border px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Provider</label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value as "ebay" | "shopify" })}
              className="w-full rounded border px-3 py-2"
            >
              <option value="shopify">Shopify</option>
              <option value="ebay">eBay</option>
            </select>
          </div>

          {formData.provider === "ebay" ? (
            <>
              <div>
                <label className="text-sm font-medium">Client ID</label>
                <input
                  type="text"
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Client Secret</label>
                <input
                  type="password"
                  value={formData.clientSecret}
                  onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium">Shop Name</label>
                <input
                  type="text"
                  placeholder="mystore"
                  value={formData.shopName}
                  onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Admin API Access Token</label>
                <input
                  type="password"
                  value={formData.accessToken}
                  onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                  className="w-full rounded border px-3 py-2"
                  required
                />
              </div>
            </>
          )}

          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-primary text-white rounded">
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
```

---

## Sync Mechanisms

### 1. Scheduled Sync Jobs

```javascript
// backend/src/services/ecommerce/sync-scheduler.js
const cron = require('node-cron');
const { db } = require('../db/connection');
const { ecomChannels, ecomListings } = require('../db/schema');
const { eq } = require('drizzle-orm');

// Sync inventory every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('Running inventory sync...');
  
  const channels = await db.select()
    .from(ecomChannels)
    .where(eq(ecomChannels.status, 'connected'));

  for (const channel of channels) {
    await syncInventoryForChannel(channel);
  }
});

// Sync orders every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running order sync...');
  
  const channels = await db.select()
    .from(ecomChannels)
    .where(eq(ecomChannels.status, 'connected'));

  for (const channel of channels) {
    await syncOrdersForChannel(channel);
  }
});

async function syncInventoryForChannel(channel) {
  const adapter = getAdapter(channel);
  
  // Get all active listings for this channel
  const listings = await db.select()
    .from(ecomListings)
    .where(
      and(
        eq(ecomListings.channelId, channel.id),
        eq(ecomListings.status, 'active')
      )
    );

  for (const listing of listings) {
    // Get current inventory
    const version = await getProductCodeVersion(listing.productCodeId, channel.branchId);
    const availableQty = version.qty_on_hand - version.qty_reserved;

    // Update on marketplace
    await adapter.updateInventory(
      listing.externalId,
      availableQty,
      channel.config.locationId
    );

    // Update sync status
    await db.update(ecomListings)
      .set({
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
      })
      .where(eq(ecomListings.id, listing.id));
  }
}
```

### 2. Queue System (Bull/Redis)

```javascript
// backend/src/services/ecommerce/sync-queue.js
const Queue = require('bull');
const redis = require('redis');

const syncQueue = new Queue('ecom-sync', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
});

// Process sync jobs
syncQueue.process('sync-listings', async (job) => {
  const { channelId, listingIds } = job.data;
  // Sync listings...
});

syncQueue.process('sync-orders', async (job) => {
  const { channelId } = job.data;
  // Fetch and import orders...
});

// Add jobs
async function queueListingSync(channelId, listingIds) {
  await syncQueue.add('sync-listings', { channelId, listingIds }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
}
```

---

## Error Handling & Logging

### 1. Error Handling Strategy

```javascript
// backend/src/services/ecommerce/error-handler.js

class EcomError extends Error {
  constructor(message, code, provider, details) {
    super(message);
    this.name = 'EcomError';
    this.code = code;
    this.provider = provider;
    this.details = details;
  }
}

async function handleSyncError(error, channelId, operation) {
  // Log error
  await db.insert(ecomChannelLogs).values({
    channelId,
    operation,
    status: 'error',
    recordsFailed: 1,
    errorMessage: error.message,
    metadata: {
      code: error.code,
      details: error.details,
      stack: error.stack,
    },
  });

  // Update channel status if critical
  if (error.code === 'AUTH_FAILED' || error.code === 'RATE_LIMIT') {
    await db.update(ecomChannels)
      .set({ status: 'error' })
      .where(eq(ecomChannels.id, channelId));
  }

  // Alert admin (email, Slack, etc.)
  if (error.code === 'CRITICAL') {
    await sendAlert({
      channel: channelId,
      operation,
      error: error.message,
    });
  }
}
```

### 2. Retry Logic

```javascript
async function syncWithRetry(operation, maxRetries = 3) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      
      if (attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## Testing Strategy

### 1. Unit Tests

```javascript
// backend/tests/ecommerce/ebay-adapter.test.js
const eBayAdapter = require('../../src/services/ecommerce/ebay-adapter');

describe('eBayAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new eBayAdapter({
      id: 1,
      config: {
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        sandbox: true,
      },
    });
  });

  test('should create listing', async () => {
    const result = await adapter.createOrUpdateListing(mockListing, mockVersion);
    expect(result.success).toBe(true);
    expect(result.externalId).toBeDefined();
  });

  test('should handle API errors', async () => {
    // Mock API error
    // Assert error handling
  });
});
```

### 2. Integration Tests

```javascript
// backend/tests/ecommerce/integration.test.js
describe('Ecommerce Integration', () => {
  test('should sync listing to eBay', async () => {
    // Create test listing
    // Sync to eBay
    // Verify on eBay
  });

  test('should import order from Shopify', async () => {
    // Create test order on Shopify
    // Import via API
    // Verify in database
  });
});
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Set up eBay Developer account and obtain credentials
- [ ] Set up Shopify app and obtain access token
- [ ] Configure webhook endpoints (HTTPS required)
- [ ] Set up Redis for queue system
- [ ] Configure environment variables
- [ ] Set up SSL certificates for webhook endpoints
- [ ] Test sandbox/development environments

### Environment Variables

```bash
# eBay
EBAY_CLIENT_ID=your_client_id
EBAY_CLIENT_SECRET=your_client_secret
EBAY_SANDBOX=true  # false for production

# Shopify
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Encryption (for storing credentials)
ENCRYPTION_KEY=your_encryption_key
```

### Post-Deployment

- [ ] Verify webhook endpoints are accessible
- [ ] Test channel connections
- [ ] Run initial sync
- [ ] Monitor error logs
- [ ] Set up alerts for sync failures
- [ ] Configure backup strategy for ecommerce data

---

## Additional Resources

- **eBay API Documentation**: https://developer.ebay.com/api-docs
- **Shopify API Documentation**: https://shopify.dev/api/admin-rest
- **Webhook Testing**: Use ngrok for local development
- **Rate Limits**: Implement rate limiting to avoid API throttling

---

## Support & Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify credentials are correct
   - Check token expiration (eBay)
   - Regenerate access tokens if needed

2. **Inventory Sync Failures**
   - Verify product codes match between systems
   - Check stock availability
   - Review sync logs for specific errors

3. **Webhook Not Receiving Events**
   - Verify webhook URL is accessible (HTTPS)
   - Check webhook signature validation
   - Review webhook logs table

4. **Order Import Issues**
   - Verify order format matches expected structure
   - Check inventory availability before import
   - Review order normalization logic

---

**Last Updated**: 2024-01-XX
**Version**: 1.0.0


