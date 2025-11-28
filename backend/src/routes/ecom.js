/**
 * E-Commerce API Routes
 * Handles all ecommerce-related endpoints for channels, listings, orders, returns, and webhooks
 */

import express from 'express';
import { db } from '../db/connection.js';
import {
  ecomChannels,
  ecomListings,
  ecomOrders,
  ecomOrderItems,
  ecomReturns,
  ecomReturnItems,
  ecomChannelLogs,
  ecomWebhookLogs,
  productCodes,
  productCodeVersions,
  orders,
  orderItems,
  stockLedger,
} from '../db/schema.js';
import { eq, and, or, like, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import { eBayAdapter } from '../services/ecommerce/ebay-adapter.js';
import { ShopifyAdapter } from '../services/ecommerce/shopify-adapter.js';
import { normalizeOrder } from '../services/ecommerce/order-normalizer.js';
import { reserveInventoryForOrder, releaseInventoryForOrder } from '../services/ecommerce/inventory-reservation.js';
import { syncInventoryForChannel, syncOrdersForChannel } from '../services/ecommerce/sync-scheduler.js';
import { handleSyncError } from '../services/ecommerce/error-handler.js';
import { fullCatalogSync, historicalOrderImport } from '../services/ecommerce/initial-sync.js';
import { syncInventoryOnStockChange, syncPriceOnChange, syncListingStatus, resolveConflict } from '../services/ecommerce/realtime-sync.js';
import { processReturnRestock, calculateRefundAmount, processRefund } from '../services/ecommerce/return-processing.js';

const router = express.Router();

/**
 * Get adapter instance for a channel
 * @param {Object} channel - Channel configuration
 * @returns {eBayAdapter|ShopifyAdapter} Adapter instance
 */
function getAdapter(channel) {
  const channelConfig = {
    id: channel.id,
    config: typeof channel.config === 'string' ? JSON.parse(channel.config) : channel.config,
  };

  switch (channel.provider) {
    case 'ebay':
      return new eBayAdapter(channelConfig);
    case 'shopify':
      return new ShopifyAdapter(channelConfig);
    default:
      throw new Error(`Unsupported provider: ${channel.provider}`);
  }
}

/**
 * Get product code version for a listing
 * @param {number} productCodeId - Product code ID
 * @param {number|null} branchId - Branch ID (optional)
 * @returns {Promise<Object>} Product code version
 */
async function getProductCodeVersion(productCodeId, branchId) {
  const conditions = [
    eq(productCodeVersions.productCodeId, productCodeId),
    eq(productCodeVersions.isActive, true),
  ];

  if (branchId) {
    conditions.push(eq(productCodeVersions.branchId, branchId));
  }

  const [version] = await db
    .select()
    .from(productCodeVersions)
    .where(and(...conditions))
    .limit(1);

  if (!version) {
    throw new Error(`No active product code version found for product_code_id: ${productCodeId}`);
  }

  return version;
}

// ========== 3.1 CHANNEL MANAGEMENT ROUTES ==========

/**
 * GET /api/ecom/channels
 * List all channels with status
 */
router.get('/channels', async (req, res, next) => {
  try {
    const channels = await db
      .select()
      .from(ecomChannels)
      .orderBy(desc(ecomChannels.createdAt));

    // Parse config JSON if it's a string
    const formattedChannels = channels.map(channel => ({
      ...channel,
      config: typeof channel.config === 'string' ? JSON.parse(channel.config) : channel.config,
    }));

    res.json({ channels: formattedChannels });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ecom/channels/:id
 * Get channel details
 */
router.get('/channels/:id', async (req, res, next) => {
  try {
    const channelId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(channelId) || channelId <= 0) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const formattedChannel = {
      ...channel,
      config: typeof channel.config === 'string' ? JSON.parse(channel.config) : channel.config,
    };

    res.json({ channel: formattedChannel });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/channels
 * Create new channel
 */
router.post('/channels', async (req, res, next) => {
  try {
    const { name, provider, config, branchId } = req.body;

    if (!name || !provider || !config) {
      return res.status(400).json({ error: 'Missing required fields: name, provider, config' });
    }

    // Validate provider-specific config
    if (provider === 'ebay') {
      if (!config.clientId || !config.clientSecret) {
        return res.status(400).json({ error: 'Missing eBay credentials: clientId, clientSecret' });
      }
    } else if (provider === 'shopify') {
      if (!config.shopName || !config.accessToken) {
        return res.status(400).json({ error: 'Missing Shopify credentials: shopName, accessToken' });
      }
    } else {
      return res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }

    // Test connection before saving
    const testChannel = { id: 0, provider, config };
    try {
      const adapter = getAdapter(testChannel);
      const testResult = await adapter.fetchOrders({ limit: 1 });
      if (!testResult.success) {
        return res.status(400).json({ error: `Connection test failed: ${testResult.error || 'Unknown error'}` });
      }
    } catch (testError) {
      return res.status(400).json({ error: `Connection test failed: ${testError.message}` });
    }

    // Create channel
    const [newChannel] = await db
      .insert(ecomChannels)
      .values({
        name,
        provider,
        config: JSON.stringify(config), // TODO: Encrypt sensitive data in production
        branchId: branchId ? Number(branchId) : null,
        status: 'connected',
      });

    res.status(201).json({
      channel: {
        ...newChannel,
        config: typeof newChannel.config === 'string' ? JSON.parse(newChannel.config) : newChannel.config,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/ecom/channels/:id
 * Update channel config
 */
router.put('/channels/:id', async (req, res, next) => {
  try {
    const channelId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(channelId) || channelId <= 0) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const [existing] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const { name, config, branchId, status } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (config !== undefined) {
      // Validate config if provided
      if (existing.provider === 'ebay' && (!config.clientId || !config.clientSecret)) {
        return res.status(400).json({ error: 'Missing eBay credentials' });
      }
      if (existing.provider === 'shopify' && (!config.shopName || !config.accessToken)) {
        return res.status(400).json({ error: 'Missing Shopify credentials' });
      }
      updates.config = JSON.stringify(config);
    }
    if (branchId !== undefined) updates.branchId = branchId ? Number(branchId) : null;
    if (status !== undefined) updates.status = status;

    await db
      .update(ecomChannels)
      .set(updates)
      .where(eq(ecomChannels.id, channelId));

    const [updated] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    res.json({
      channel: {
        ...updated,
        config: typeof updated.config === 'string' ? JSON.parse(updated.config) : updated.config,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ecom/channels/:id/oauth-url
 * Get OAuth authorization URL for eBay channel
 */
router.get('/channels/:id/oauth-url', async (req, res, next) => {
  try {
    const channelId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(channelId) || channelId <= 0) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.provider !== 'ebay') {
      return res.status(400).json({ error: 'OAuth URL is only available for eBay channels' });
    }

    const config = typeof channel.config === 'string' ? JSON.parse(channel.config) : channel.config;

    if (!config.clientId || !config.clientSecret || !config.redirectUri) {
      return res.status(400).json({ error: 'Missing OAuth configuration (clientId, clientSecret, redirectUri)' });
    }

    // Generate OAuth URL
    const { eBayAuth } = await import('../services/ecommerce/ebay-auth.js');
    const auth = new eBayAuth({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      sandbox: config.sandbox || false,
    });

    const scopes = config.scopes || ['https://api.ebay.com/oauth/api_scope/sell.inventory'];
    const authUrl = auth.getAuthorizationUrl(scopes);

    res.json({ authUrl });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/channels/:id/oauth-callback
 * Handle OAuth callback and exchange code for token
 */
router.post('/channels/:id/oauth-callback', async (req, res, next) => {
  try {
    const channelId = Number.parseInt(req.params.id, 10);
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    if (!Number.isFinite(channelId) || channelId <= 0) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.provider !== 'ebay') {
      return res.status(400).json({ error: 'OAuth callback is only available for eBay channels' });
    }

    const config = typeof channel.config === 'string' ? JSON.parse(channel.config) : channel.config;

    // Exchange code for token
    const { eBayAuth } = await import('../services/ecommerce/ebay-auth.js');
    const auth = new eBayAuth({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      sandbox: config.sandbox || false,
    });

    const tokenData = await auth.exchangeCodeForToken(code);

    // Update channel config with tokens
    const updatedConfig = {
      ...config,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpiresAt: tokenData.expiresAt.toISOString(),
    };

    await db
      .update(ecomChannels)
      .set({
        config: JSON.stringify(updatedConfig),
        status: 'connected',
        updatedAt: new Date(),
      })
      .where(eq(ecomChannels.id, channelId));

    res.json({ success: true, message: 'OAuth tokens saved successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/channels/:id/test
 * Test channel connection
 */
router.post('/channels/:id/test', async (req, res, next) => {
  try {
    const channelId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(channelId) || channelId <= 0) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    try {
      const adapter = getAdapter(channel);
      const testResult = await adapter.fetchOrders({ limit: 1 });

      // Update channel status based on test result
      await db
        .update(ecomChannels)
        .set({
          status: testResult.success ? 'connected' : 'error',
          lastSyncAt: testResult.success ? new Date() : null,
        })
        .where(eq(ecomChannels.id, channelId));

      res.json({
        success: testResult.success,
        error: testResult.error || null,
      });
    } catch (error) {
      await db
        .update(ecomChannels)
        .set({ status: 'error' })
        .where(eq(ecomChannels.id, channelId));

      res.json({
        success: false,
        error: error.message,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/channels/:id/sync
 * Trigger manual sync for a channel
 */
router.post('/channels/:id/sync', async (req, res, next) => {
  try {
    const channelId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(channelId) || channelId <= 0) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const { type = 'both' } = req.body; // 'inventory', 'orders', or 'both'

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const results = {};

    if (type === 'inventory' || type === 'both') {
      results.inventory = await syncInventoryForChannel(channel);
    }

    if (type === 'orders' || type === 'both') {
      results.orders = await syncOrdersForChannel(channel);
    }

    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ecom/channels/:id/logs
 * Get channel logs
 */
router.get('/channels/:id/logs', async (req, res, next) => {
  try {
    const channelId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(channelId) || channelId <= 0) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const limit = Number.parseInt(req.query.limit || '50', 10);
    const offset = Number.parseInt(req.query.offset || '0', 10);

    const logs = await db
      .select()
      .from(ecomChannelLogs)
      .where(eq(ecomChannelLogs.channelId, channelId))
      .orderBy(desc(ecomChannelLogs.startedAt))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(ecomChannelLogs)
      .where(eq(ecomChannelLogs.channelId, channelId));

    res.json({
      logs,
      total: total[0]?.count || 0,
      limit,
      offset,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ecom/channels/:id/webhook-logs
 * Get webhook logs for a channel
 */
router.get('/channels/:id/webhook-logs', async (req, res, next) => {
  try {
    const channelId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(channelId) || channelId <= 0) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const limit = Number.parseInt(req.query.limit || '50', 10);
    const offset = Number.parseInt(req.query.offset || '0', 10);
    const eventType = req.query.eventType; // Optional filter
    const processed = req.query.processed; // Optional filter: 'true' or 'false'

    const conditions = [eq(ecomWebhookLogs.channelId, channelId)];
    if (eventType) {
      conditions.push(like(ecomWebhookLogs.eventType, `%${eventType}%`));
    }
    if (processed !== undefined) {
      conditions.push(eq(ecomWebhookLogs.processed, processed === 'true'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await db
      .select()
      .from(ecomWebhookLogs)
      .where(whereClause)
      .orderBy(desc(ecomWebhookLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(ecomWebhookLogs)
      .where(whereClause);

    res.json({
      logs: logs.map(log => ({
        ...log,
        payload: typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload,
      })),
      total: total[0]?.count || 0,
      limit,
      offset,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/ecom/channels/:id
 * Delete channel (soft delete - set status to disconnected)
 */
router.delete('/channels/:id', async (req, res, next) => {
  try {
    const channelId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(channelId) || channelId <= 0) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Soft delete: set status to disconnected
    await db
      .update(ecomChannels)
      .set({ status: 'disconnected' })
      .where(eq(ecomChannels.id, channelId));

    res.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ========== 3.2 LISTING MANAGEMENT ROUTES ==========

/**
 * GET /api/ecom/listings
 * List listings with filters
 */
router.get('/listings', async (req, res, next) => {
  try {
    const { search, status, channelId, syncStatus, limit = 50, offset = 0 } = req.query;

    const conditions = [];
    if (status) conditions.push(eq(ecomListings.status, status));
    if (channelId) conditions.push(eq(ecomListings.channelId, Number.parseInt(channelId, 10)));
    if (syncStatus) conditions.push(eq(ecomListings.syncStatus, syncStatus));
    if (search) {
      conditions.push(
        or(
          like(ecomListings.title, `%${search}%`),
          like(ecomListings.description, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const listings = await db
      .select()
      .from(ecomListings)
      .where(whereClause)
      .orderBy(desc(ecomListings.updatedAt))
      .limit(Number.parseInt(limit, 10))
      .offset(Number.parseInt(offset, 10));

    // Get channel and product code info for each listing
    const enrichedListings = await Promise.all(
      listings.map(async (listing) => {
        const [channel] = await db
          .select()
          .from(ecomChannels)
          .where(eq(ecomChannels.id, listing.channelId))
          .limit(1);

        const [productCode] = await db
          .select()
          .from(productCodes)
          .where(eq(productCodes.id, listing.productCodeId))
          .limit(1);

        return {
          ...listing,
          channel: channel || null,
          productCode: productCode || null,
        };
      })
    );

    res.json({ listings: enrichedListings });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ecom/listings/:id
 * Get listing details
 */
router.get('/listings/:id', async (req, res, next) => {
  try {
    const listingId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(listingId) || listingId <= 0) {
      return res.status(400).json({ error: 'Invalid listing ID' });
    }

    const [listing] = await db
      .select()
      .from(ecomListings)
      .where(eq(ecomListings.id, listingId))
      .limit(1);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Get related data
    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, listing.channelId))
      .limit(1);

    const [productCode] = await db
      .select()
      .from(productCodes)
      .where(eq(productCodes.id, listing.productCodeId))
      .limit(1);

    res.json({
      listing: {
        ...listing,
        channel: channel || null,
        productCode: productCode || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/listings
 * Create new listing
 */
router.post('/listings', async (req, res, next) => {
  try {
    const {
      productCodeId,
      channelId,
      title,
      description,
      priceCents,
      status = 'draft',
      seoSlug,
      metaDescription,
      primaryImageUrl,
      imageUrls,
      categoryMapping,
      attributes,
    } = req.body;

    if (!productCodeId || !channelId || !title) {
      return res.status(400).json({ error: 'Missing required fields: productCodeId, channelId, title' });
    }

    // Validate product_code_id exists
    const [productCode] = await db
      .select()
      .from(productCodes)
      .where(eq(productCodes.id, Number.parseInt(productCodeId, 10)))
      .limit(1);

    if (!productCode) {
      return res.status(400).json({ error: 'Product code not found' });
    }

    // Validate channel_id exists
    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, Number.parseInt(channelId, 10)))
      .limit(1);

    if (!channel) {
      return res.status(400).json({ error: 'Channel not found' });
    }

    // Check for existing listing
    const [existing] = await db
      .select()
      .from(ecomListings)
      .where(
        and(
          eq(ecomListings.productCodeId, Number.parseInt(productCodeId, 10)),
          eq(ecomListings.channelId, Number.parseInt(channelId, 10))
        )
      )
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: 'Listing already exists for this product code and channel' });
    }

    const [newListing] = await db
      .insert(ecomListings)
      .values({
        productCodeId: Number.parseInt(productCodeId, 10),
        channelId: Number.parseInt(channelId, 10),
        title,
        description: description || null,
        priceCents: priceCents ? Number.parseInt(priceCents, 10) : null,
        status,
        seoSlug: seoSlug || null,
        metaDescription: metaDescription || null,
        primaryImageUrl: primaryImageUrl || null,
        imageUrls: imageUrls ? JSON.stringify(imageUrls) : null,
        categoryMapping: categoryMapping ? JSON.stringify(categoryMapping) : null,
        attributes: attributes ? JSON.stringify(attributes) : null,
        syncStatus: 'pending',
      });

    res.status(201).json({ listing: newListing });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/ecom/listings/:id
 * Update listing
 */
router.put('/listings/:id', async (req, res, next) => {
  try {
    const listingId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(listingId) || listingId <= 0) {
      return res.status(400).json({ error: 'Invalid listing ID' });
    }

    const [existing] = await db
      .select()
      .from(ecomListings)
      .where(eq(ecomListings.id, listingId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const {
      title,
      description,
      priceCents,
      status,
      seoSlug,
      metaDescription,
      primaryImageUrl,
      imageUrls,
      categoryMapping,
      attributes,
    } = req.body;

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (priceCents !== undefined) updates.priceCents = priceCents ? Number.parseInt(priceCents, 10) : null;
    if (status !== undefined) updates.status = status;
    if (seoSlug !== undefined) updates.seoSlug = seoSlug;
    if (metaDescription !== undefined) updates.metaDescription = metaDescription;
    if (primaryImageUrl !== undefined) updates.primaryImageUrl = primaryImageUrl;
    if (imageUrls !== undefined) updates.imageUrls = imageUrls ? JSON.stringify(imageUrls) : null;
    if (categoryMapping !== undefined) updates.categoryMapping = categoryMapping ? JSON.stringify(categoryMapping) : null;
    if (attributes !== undefined) updates.attributes = attributes ? JSON.stringify(attributes) : null;

    // If status changed, reset sync status
    if (status !== undefined && status !== existing.status) {
      updates.syncStatus = 'pending';
    }

    await db
      .update(ecomListings)
      .set(updates)
      .where(eq(ecomListings.id, listingId));

    const [updated] = await db
      .select()
      .from(ecomListings)
      .where(eq(ecomListings.id, listingId))
      .limit(1);

    res.json({ listing: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/listings/bulk
 * Bulk operations on listings
 */
router.post('/listings/bulk', async (req, res, next) => {
  try {
    const { action, listingIds } = req.body;

    if (!action || !Array.isArray(listingIds) || listingIds.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: action, listingIds' });
    }

    const results = [];

    for (const listingId of listingIds) {
      try {
        const [listing] = await db
          .select()
          .from(ecomListings)
          .where(eq(ecomListings.id, Number.parseInt(listingId, 10)))
          .limit(1);

        if (!listing) {
          results.push({ listingId, success: false, error: 'Listing not found' });
          continue;
        }

        let updateData = {};

        switch (action) {
          case 'publish':
            updateData = { status: 'active', syncStatus: 'pending' };
            break;
          case 'unpublish':
            updateData = { status: 'inactive', syncStatus: 'pending' };
            break;
          case 'archive':
            updateData = { status: 'archived' };
            break;
          case 'sync':
            // Sync will be handled separately
            updateData = { syncStatus: 'pending' };
            break;
          default:
            if (action.startsWith('update:')) {
              // Custom update action
              const updateFields = req.body.updateFields || {};
              updateData = updateFields;
            } else {
              results.push({ listingId, success: false, error: `Unknown action: ${action}` });
              continue;
            }
        }

        if (Object.keys(updateData).length > 0) {
          await db
            .update(ecomListings)
            .set(updateData)
            .where(eq(ecomListings.id, listing.id));

          results.push({ listingId, success: true });
        } else {
          results.push({ listingId, success: true, message: 'No update needed' });
        }
      } catch (error) {
        results.push({ listingId, success: false, error: error.message });
      }
    }

    res.json({ results });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/listings/sync
 * Sync listings to channel
 */
router.post('/listings/sync', async (req, res, next) => {
  try {
    const { channelId, listingIds } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'Missing required field: channelId' });
    }

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, Number.parseInt(channelId, 10)))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const adapter = getAdapter(channel);
    const results = [];
    const listingIdsToSync = listingIds || [];

    // If no listingIds provided, sync all active listings for this channel
    let listings;
    if (listingIdsToSync.length === 0) {
      listings = await db
        .select()
        .from(ecomListings)
        .where(
          and(
            eq(ecomListings.channelId, channel.id),
            eq(ecomListings.status, 'active')
          )
        );
    } else {
      listings = await db
        .select()
        .from(ecomListings)
        .where(
          and(
            eq(ecomListings.channelId, channel.id),
            inArray(ecomListings.id, listingIdsToSync.map(id => Number.parseInt(id, 10)))
          )
        );
    }

    for (const listing of listings) {
      try {
        // Get product code version
        const version = await getProductCodeVersion(listing.productCodeId, channel.branchId);

        // Sync to marketplace
        const syncResult = await adapter.createOrUpdateListing(listing, version);

        if (syncResult.success) {
          await db
            .update(ecomListings)
            .set({
              externalId: syncResult.externalId || listing.externalId,
              syncStatus: 'synced',
              lastSyncedAt: new Date(),
              syncError: null,
            })
            .where(eq(ecomListings.id, listing.id));

          // Log successful sync
          await db.insert(ecomChannelLogs).values({
            channelId: channel.id,
            operation: 'sync_listings',
            status: 'success',
            recordsProcessed: 1,
            recordsFailed: 0,
            metadata: { listingId: listing.id },
            startedAt: new Date(),
            completedAt: new Date(),
          });

          results.push({ listingId: listing.id, success: true });
        } else {
          await db
            .update(ecomListings)
            .set({
              syncStatus: 'error',
              syncError: JSON.stringify(syncResult.error),
            })
            .where(eq(ecomListings.id, listing.id));

          // Log error
          await db.insert(ecomChannelLogs).values({
            channelId: channel.id,
            operation: 'sync_listings',
            status: 'error',
            recordsProcessed: 0,
            recordsFailed: 1,
            errorMessage: JSON.stringify(syncResult.error),
            metadata: { listingId: listing.id },
            startedAt: new Date(),
            completedAt: new Date(),
          });

          results.push({ listingId: listing.id, success: false, error: syncResult.error });
        }
      } catch (error) {
        await handleSyncError(channel.id, error, 'sync_listings');
        results.push({ listingId: listing.id, success: false, error: error.message });
      }
    }

    res.json({ results });
  } catch (error) {
    next(error);
  }
});

// ========== 3.3 ORDER MANAGEMENT ROUTES ==========

/**
 * GET /api/ecom/orders
 * List orders with filters
 */
router.get('/orders', async (req, res, next) => {
  try {
    const { search, status, channelId, fulfillmentStatus, limit = 50, offset = 0 } = req.query;

    const conditions = [];
    if (status) conditions.push(eq(ecomOrders.status, status));
    if (channelId) conditions.push(eq(ecomOrders.channelId, Number.parseInt(channelId, 10)));
    if (fulfillmentStatus) conditions.push(eq(ecomOrders.fulfillmentStatus, fulfillmentStatus));
    if (search) {
      conditions.push(
        or(
          like(ecomOrders.customerName, `%${search}%`),
          like(ecomOrders.customerEmail, `%${search}%`),
          like(ecomOrders.externalId, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orders = await db
      .select()
      .from(ecomOrders)
      .where(whereClause)
      .orderBy(desc(ecomOrders.createdAt))
      .limit(Number.parseInt(limit, 10))
      .offset(Number.parseInt(offset, 10));

    // Get order items and channel for each order
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const items = await db
          .select()
          .from(ecomOrderItems)
          .where(eq(ecomOrderItems.ecomOrderId, order.id));

        const [channel] = await db
          .select()
          .from(ecomChannels)
          .where(eq(ecomChannels.id, order.channelId))
          .limit(1);

        return {
          ...order,
          shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress) : null,
          billingAddress: order.billingAddress ? JSON.parse(order.billingAddress) : null,
          items,
          channel: channel || null,
        };
      })
    );

    res.json({ orders: enrichedOrders });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ecom/orders/:id
 * Get order details
 */
router.get('/orders/:id', async (req, res, next) => {
  try {
    const orderId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const [order] = await db
      .select()
      .from(ecomOrders)
      .where(eq(ecomOrders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = await db
      .select()
      .from(ecomOrderItems)
      .where(eq(ecomOrderItems.ecomOrderId, order.id));

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, order.channelId))
      .limit(1);

    res.json({
      order: {
        ...order,
        shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress) : null,
        billingAddress: order.billingAddress ? JSON.parse(order.billingAddress) : null,
        items,
        channel: channel || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ecom/channels/:id/orders
 * Fetch orders from marketplace for a channel
 */
router.get('/channels/:id/orders', async (req, res, next) => {
  try {
    const channelId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(channelId) || channelId <= 0) {
      return res.status(400).json({ error: 'Invalid channel ID' });
    }

    const { startDate, endDate, status, limit = 100 } = req.query;

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.status !== 'connected') {
      return res.status(400).json({ error: 'Channel is not connected' });
    }

    const adapter = getAdapter(channel);

    // Fetch orders from marketplace
    const fetchOptions = {
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: endDate ? new Date(endDate) : new Date(),
      status: status || undefined,
      limit: Number.parseInt(limit, 10),
    };

    const result = await adapter.fetchOrders(fetchOptions);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to fetch orders' });
    }

    // Normalize and import orders
    const imported = { created: 0, updated: 0, errors: [] };

    for (const rawOrder of result.orders || []) {
      try {
        const normalizedOrder = normalizeOrder(rawOrder, channel.provider);

        const [existing] = await db
          .select()
          .from(ecomOrders)
          .where(
            and(
              eq(ecomOrders.channelId, channel.id),
              eq(ecomOrders.externalId, normalizedOrder.externalId)
            )
          )
          .limit(1);

        if (existing) {
          imported.updated++;
        } else {
          const [newOrder] = await db
            .insert(ecomOrders)
            .values({
              channelId: channel.id,
              externalId: normalizedOrder.externalId,
              customerName: normalizedOrder.customerName,
              customerEmail: normalizedOrder.customerEmail,
              status: normalizedOrder.status,
              paymentStatus: normalizedOrder.paymentStatus,
              fulfillmentStatus: normalizedOrder.fulfillmentStatus,
              shippingAddress: JSON.stringify(normalizedOrder.shippingAddress),
              billingAddress: JSON.stringify(normalizedOrder.billingAddress),
              subtotalCents: normalizedOrder.subtotalCents,
              taxCents: normalizedOrder.taxCents,
              shippingCents: normalizedOrder.shippingCents,
              totalCents: normalizedOrder.totalCents,
              currency: normalizedOrder.currency,
            });

          for (const item of normalizedOrder.items) {
            await db.insert(ecomOrderItems).values({
              ecomOrderId: newOrder.id,
              listingId: item.listingId || null,
              productCodeId: item.productCodeId || null,
              externalItemId: item.externalItemId,
              quantity: item.quantity,
              priceCents: item.priceCents,
              sku: item.sku,
              title: item.title,
            });
          }

          try {
            await reserveInventoryForOrder(newOrder.id);
          } catch (inventoryError) {
            console.error(`Failed to reserve inventory for order ${newOrder.id}:`, inventoryError.message);
          }

          imported.created++;
        }
      } catch (error) {
        imported.errors.push({ order: rawOrder.id || 'unknown', error: error.message });
      }
    }

    res.json({ imported: imported.created + imported.updated, ...imported });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/orders/import
 * Import orders from marketplace
 */
router.post('/orders/import', async (req, res, next) => {
  try {
    const { channelId, orders: rawOrders } = req.body;

    if (!channelId || !Array.isArray(rawOrders) || rawOrders.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: channelId, orders' });
    }

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, Number.parseInt(channelId, 10)))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const results = { created: 0, updated: 0, errors: [] };

    for (const rawOrder of rawOrders) {
      try {
        const normalizedOrder = normalizeOrder(rawOrder, channel.provider);

        // Check if order exists
        const [existing] = await db
          .select()
          .from(ecomOrders)
          .where(
            and(
              eq(ecomOrders.channelId, channel.id),
              eq(ecomOrders.externalId, normalizedOrder.externalId)
            )
          )
          .limit(1);

        if (existing) {
          // Update existing order
          await db
            .update(ecomOrders)
            .set({
              status: normalizedOrder.status,
              paymentStatus: normalizedOrder.paymentStatus,
              fulfillmentStatus: normalizedOrder.fulfillmentStatus,
              totalCents: normalizedOrder.totalCents,
              subtotalCents: normalizedOrder.subtotalCents,
              taxCents: normalizedOrder.taxCents,
              shippingCents: normalizedOrder.shippingCents,
              updatedAt: new Date(),
            })
            .where(eq(ecomOrders.id, existing.id));

          results.updated++;
        } else {
          // Create new order
          const [newOrder] = await db
            .insert(ecomOrders)
            .values({
              channelId: channel.id,
              externalId: normalizedOrder.externalId,
              customerName: normalizedOrder.customerName,
              customerEmail: normalizedOrder.customerEmail,
              status: normalizedOrder.status,
              paymentStatus: normalizedOrder.paymentStatus,
              fulfillmentStatus: normalizedOrder.fulfillmentStatus,
              shippingAddress: JSON.stringify(normalizedOrder.shippingAddress),
              billingAddress: JSON.stringify(normalizedOrder.billingAddress),
              subtotalCents: normalizedOrder.subtotalCents,
              taxCents: normalizedOrder.taxCents,
              shippingCents: normalizedOrder.shippingCents,
              totalCents: normalizedOrder.totalCents,
              currency: normalizedOrder.currency,
            });

          // Create order items
          for (const item of normalizedOrder.items) {
            await db.insert(ecomOrderItems).values({
              ecomOrderId: newOrder.id,
              listingId: item.listingId || null,
              productCodeId: item.productCodeId || null,
              externalItemId: item.externalItemId,
              quantity: item.quantity,
              priceCents: item.priceCents,
              sku: item.sku,
              title: item.title,
            });
          }

          // Reserve inventory for the order
          try {
            await reserveInventoryForOrder(newOrder.id);
          } catch (inventoryError) {
            console.error(`Failed to reserve inventory for order ${newOrder.id}:`, inventoryError.message);
            // Continue - inventory reservation failure doesn't prevent order import
          }

          results.created++;
        }
      } catch (error) {
        results.errors.push({
          order: rawOrder.id || rawOrder.orderId || 'unknown',
          error: error.message,
        });
      }
    }

    res.json(results);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/orders/:id/pick
 * Mark order as picking
 */
router.post('/orders/:id/pick', async (req, res, next) => {
  try {
    const orderId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const [order] = await db
      .select()
      .from(ecomOrders)
      .where(eq(ecomOrders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await db
      .update(ecomOrders)
      .set({ fulfillmentStatus: 'picking', updatedAt: new Date() })
      .where(eq(ecomOrders.id, orderId));

    res.json({ message: 'Order marked as picking' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/orders/:id/pack
 * Mark order as packed
 */
router.post('/orders/:id/pack', async (req, res, next) => {
  try {
    const orderId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const [order] = await db
      .select()
      .from(ecomOrders)
      .where(eq(ecomOrders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await db
      .update(ecomOrders)
      .set({ fulfillmentStatus: 'packed', updatedAt: new Date() })
      .where(eq(ecomOrders.id, orderId));

    res.json({ message: 'Order marked as packed' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/sync/full-catalog
 * Trigger full catalog sync (all active listings to all connected channels)
 */
router.post('/sync/full-catalog', async (req, res, next) => {
  try {
    const { channelId } = req.body; // Optional specific channel ID

    // Return immediately with job ID
    const jobId = `catalog-sync-${Date.now()}`;
    
    // Run sync in background
    fullCatalogSync(channelId || null, (progress) => {
      // Progress callback - could be used for websocket updates
      console.log('Catalog sync progress:', progress);
    }).catch(error => {
      console.error('Full catalog sync error:', error);
    });

    res.json({
      jobId,
      message: 'Full catalog sync started',
      status: 'in_progress',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/sync/historical-orders
 * Import historical orders from date range
 */
router.post('/sync/historical-orders', async (req, res, next) => {
  try {
    const { channelId, startDate, endDate } = req.body;

    if (!channelId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields: channelId, startDate, endDate' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (start > end) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    // Start import asynchronously
    const jobId = `historical-orders-${Date.now()}`;
    
    historicalOrderImport(channelId, start, end, (progress) => {
      console.log('Historical order import progress:', progress);
    }).catch(error => {
      console.error('Historical order import error:', error);
    });

    res.json({
      jobId,
      message: 'Historical order import started',
      status: 'in_progress',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ecom/sync/progress/:jobId
 * Get sync progress (for polling)
 */
router.get('/sync/progress/:jobId', async (req, res, next) => {
  try {
    // For now, return latest log entry
    // In production, you'd want to track job progress in Redis or similar
    const { channelId } = req.query;
    
    const conditions = [];
    if (channelId) {
      conditions.push(eq(ecomChannelLogs.channelId, Number.parseInt(channelId, 10)));
    }

    const [latestLog] = await db
      .select()
      .from(ecomChannelLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ecomChannelLogs.startedAt))
      .limit(1);

    if (!latestLog) {
      return res.json({
        status: 'not_found',
        message: 'No sync job found',
      });
    }

    res.json({
      status: latestLog.status,
      progress: latestLog.recordsProcessed,
      total: (latestLog.metadata?.totalListings || latestLog.metadata?.totalOrders) || 0,
      failed: latestLog.recordsFailed,
      startedAt: latestLog.startedAt,
      completedAt: latestLog.completedAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/sync/inventory
 * Trigger inventory sync for product code(s) (real-time sync)
 */
router.post('/sync/inventory', async (req, res, next) => {
  try {
    const { productCodeId, branchId } = req.body;

    if (!productCodeId) {
      return res.status(400).json({ error: 'Missing required field: productCodeId' });
    }

    const result = await syncInventoryOnStockChange(productCodeId, branchId || null);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/sync/price
 * Trigger price sync for product code(s) (real-time sync)
 */
router.post('/sync/price', async (req, res, next) => {
  try {
    const { productCodeId } = req.body;

    if (!productCodeId) {
      return res.status(400).json({ error: 'Missing required field: productCodeId' });
    }

    const result = await syncPriceOnChange(productCodeId);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/listings/:id/sync-status
 * Sync listing status to marketplace
 */
router.post('/listings/:id/sync-status', async (req, res, next) => {
  try {
    const listingId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(listingId) || listingId <= 0) {
      return res.status(400).json({ error: 'Invalid listing ID' });
    }

    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "active" or "inactive"' });
    }

    const result = await syncListingStatus(listingId, status);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/listings/:id/resolve-conflict
 * Resolve conflict between marketplace and POS
 */
router.post('/listings/:id/resolve-conflict', async (req, res, next) => {
  try {
    const listingId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(listingId) || listingId <= 0) {
      return res.status(400).json({ error: 'Invalid listing ID' });
    }

    const { conflictType, resolution } = req.body;

    if (!conflictType || !['inventory', 'price', 'status'].includes(conflictType)) {
      return res.status(400).json({ error: 'Invalid conflictType' });
    }

    if (!resolution || !['pos_wins', 'marketplace_wins', 'manual'].includes(resolution)) {
      return res.status(400).json({ error: 'Invalid resolution' });
    }

    const result = await resolveConflict(listingId, conflictType, resolution);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/orders/:id/convert
 * Convert ecommerce order to internal order
 */
router.post('/orders/:id/convert', async (req, res, next) => {
  try {
    const orderId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const [ecomOrder] = await db
      .select()
      .from(ecomOrders)
      .where(eq(ecomOrders.id, orderId))
      .limit(1);

    if (!ecomOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (ecomOrder.internalOrderId) {
      return res.status(400).json({ error: 'Order already converted' });
    }

    // Get order items
    const items = await db
      .select()
      .from(ecomOrderItems)
      .where(eq(ecomOrderItems.ecomOrderId, orderId));

    // Get channel to find branch
    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, ecomOrder.channelId))
      .limit(1);

    // Create internal order
    const [internalOrder] = await db
      .insert(orders)
      .values({
        customerId: null, // TODO: Link to customer if exists
        branchId: channel?.branchId || null,
        totalCents: ecomOrder.totalCents,
        status: 'completed',
        createdAt: ecomOrder.createdAt || new Date(),
      });

    // Create order items
    for (const item of items) {
      if (item.productCodeId) {
        await db.insert(orderItems).values({
          orderId: internalOrder.id,
          productCodeId: item.productCodeId,
          quantity: item.quantity,
          unitPriceCents: item.priceCents,
        });
      }
    }

    // Link ecom order to internal order
    await db
      .update(ecomOrders)
      .set({ internalOrderId: internalOrder.id })
      .where(eq(ecomOrders.id, orderId));

    res.json({ internalOrderId: internalOrder.id, message: 'Order converted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/orders/:id/ship
 * Fulfill order (mark as shipped)
 */
router.post('/orders/:id/ship', async (req, res, next) => {
  try {
    const orderId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const { trackingNumber, carrier } = req.body;

    if (!trackingNumber) {
      return res.status(400).json({ error: 'Missing required field: trackingNumber' });
    }

    const [order] = await db
      .select()
      .from(ecomOrders)
      .where(eq(ecomOrders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, order.channelId))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const adapter = getAdapter(channel);

    // Get order items
    const items = await db
      .select()
      .from(ecomOrderItems)
      .where(eq(ecomOrderItems.ecomOrderId, order.id));

    // Fulfill on marketplace
    const fulfillResult = await adapter.fulfillOrder(
      order.externalId,
      trackingNumber,
      carrier || 'Other',
      items
    );

    if (!fulfillResult.success) {
      return res.status(400).json({ error: fulfillResult.error || 'Failed to fulfill order on marketplace' });
    }

    // Update order status
    await db
      .update(ecomOrders)
      .set({
        fulfillmentStatus: 'shipped',
        status: 'fulfilled',
        trackingNumber,
        shippingCarrier: carrier || null,
        updatedAt: new Date(),
      })
      .where(eq(ecomOrders.id, order.id));

    // TODO: Convert to internal order (link to orders table)
    // This would create an order in the orders table and link it via internal_order_id

    // Update inventory: reduce reserved quantity and update stock ledger
    for (const item of items) {
      if (item.allocatedVersionId) {
        const [version] = await db
          .select()
          .from(productCodeVersions)
          .where(eq(productCodeVersions.id, item.allocatedVersionId))
          .limit(1);

        if (version) {
          await db
            .update(productCodeVersions)
            .set({
              qtyOnHand: sql`${productCodeVersions.qtyOnHand} - ${item.quantity}`,
              qtyReserved: sql`${productCodeVersions.qtyReserved} - ${item.quantity}`,
            })
            .where(eq(productCodeVersions.id, item.allocatedVersionId));

          // Create stock ledger entry
          await db.insert(stockLedger).values({
            productCodeVersionId: item.allocatedVersionId,
            qtyChange: -item.quantity,
            reason: 'sale',
            refTable: 'ecom_orders',
            refId: order.id,
          });
        }
      }
    }

    res.json({ message: 'Order fulfilled successfully', trackingNumber });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/orders/:id/cancel
 * Cancel order
 */
router.post('/orders/:id/cancel', async (req, res, next) => {
  try {
    const orderId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const { reason } = req.body;

    const [order] = await db
      .select()
      .from(ecomOrders)
      .where(eq(ecomOrders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'cancelled' || order.status === 'fulfilled') {
      return res.status(400).json({ error: `Cannot cancel order with status: ${order.status}` });
    }

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, order.channelId))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const adapter = getAdapter(channel);

    // Cancel on marketplace
    const cancelResult = await adapter.cancelOrder(order.externalId, reason || 'Customer request');

    if (!cancelResult.success) {
      return res.status(400).json({ error: cancelResult.error || 'Failed to cancel order on marketplace' });
    }

    // Update order status
    await db
      .update(ecomOrders)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(ecomOrders.id, order.id));

    // Release reserved inventory
    try {
      await releaseInventoryForOrder(order.id);
    } catch (inventoryError) {
      console.error(`Failed to release inventory for order ${order.id}:`, inventoryError.message);
      // Continue - inventory release failure doesn't prevent cancellation
    }

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    next(error);
  }
});

// ========== 3.4 RETURNS MANAGEMENT ROUTES ==========

/**
 * GET /api/ecom/returns
 * List returns with filters
 */
router.get('/returns', async (req, res, next) => {
  try {
    const { status, channelId, limit = 50, offset = 0 } = req.query;

    const conditions = [];
    if (status) conditions.push(eq(ecomReturns.status, status));
    if (channelId) {
      // Get returns for orders from this channel
      const channelOrderIds = await db
        .select({ id: ecomOrders.id })
        .from(ecomOrders)
        .where(eq(ecomOrders.channelId, Number.parseInt(channelId, 10)));

      if (channelOrderIds.length > 0) {
        conditions.push(
          inArray(
            ecomReturns.ecomOrderId,
            channelOrderIds.map(o => o.id)
          )
        );
      } else {
        // No orders for this channel, return empty
        return res.json({ returns: [], total: 0 });
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const returns = await db
      .select()
      .from(ecomReturns)
      .where(whereClause)
      .orderBy(desc(ecomReturns.createdAt))
      .limit(Number.parseInt(limit, 10))
      .offset(Number.parseInt(offset, 10));

    // Get return items and order info
    const enrichedReturns = await Promise.all(
      returns.map(async (returnRecord) => {
        const items = await db
          .select()
          .from(ecomReturnItems)
          .where(eq(ecomReturnItems.ecomReturnId, returnRecord.id));

        const [order] = await db
          .select()
          .from(ecomOrders)
          .where(eq(ecomOrders.id, returnRecord.ecomOrderId))
          .limit(1);

        return {
          ...returnRecord,
          items,
          order: order || null,
        };
      })
    );

    res.json({ returns: enrichedReturns });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/ecom/returns/:id
 * Get return details
 */
router.get('/returns/:id', async (req, res, next) => {
  try {
    const returnId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(returnId) || returnId <= 0) {
      return res.status(400).json({ error: 'Invalid return ID' });
    }

    const [returnRecord] = await db
      .select()
      .from(ecomReturns)
      .where(eq(ecomReturns.id, returnId))
      .limit(1);

    if (!returnRecord) {
      return res.status(404).json({ error: 'Return not found' });
    }

    const items = await db
      .select()
      .from(ecomReturnItems)
      .where(eq(ecomReturnItems.ecomReturnId, returnRecord.id));

    const [order] = await db
      .select()
      .from(ecomOrders)
      .where(eq(ecomOrders.id, returnRecord.ecomOrderId))
      .limit(1);

    res.json({
      return: {
        ...returnRecord,
        items,
        order: order || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/returns
 * Create return request
 */
router.post('/returns', async (req, res, next) => {
  try {
    const { ecomOrderId, reason, items } = req.body;

    if (!ecomOrderId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: ecomOrderId, items' });
    }

    const [order] = await db
      .select()
      .from(ecomOrders)
      .where(eq(ecomOrders.id, Number.parseInt(ecomOrderId, 10)))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const [newReturn] = await db
      .insert(ecomReturns)
      .values({
        ecomOrderId: order.id,
        status: 'requested',
        reason: reason || null,
      });

    // Create return items
    for (const item of items) {
      await db.insert(ecomReturnItems).values({
        ecomReturnId: newReturn.id,
        ecomOrderItemId: Number.parseInt(item.orderItemId, 10),
        quantity: Number.parseInt(item.quantity, 10),
        condition: item.condition || null,
      });
    }

    res.status(201).json({ return: newReturn });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/returns/:id/approve
 * Approve return
 */
router.post('/returns/:id/approve', async (req, res, next) => {
  try {
    const returnId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(returnId) || returnId <= 0) {
      return res.status(400).json({ error: 'Invalid return ID' });
    }

    const { comment } = req.body;

    await db
      .update(ecomReturns)
      .set({ 
        status: 'approved', 
        updatedAt: new Date(),
        // TODO: Store comment in notes field if available
      })
      .where(eq(ecomReturns.id, returnId));

    res.json({ message: 'Return approved' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/returns/:id/receive
 * Receive returned items
 */
router.post('/returns/:id/receive', async (req, res, next) => {
  try {
    const returnId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(returnId) || returnId <= 0) {
      return res.status(400).json({ error: 'Invalid return ID' });
    }

    const { items } = req.body; // Array of { itemId, condition, restock }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required field: items' });
    }

    const result = await processReturnRestock(returnId, items);

    res.json({
      message: 'Return received and processed',
      restockedItems: result.restockedItems,
      errors: result.errors,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/returns/:id/refund
 * Process refund
 */
router.post('/returns/:id/refund', async (req, res, next) => {
  try {
    const returnId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(returnId) || returnId <= 0) {
      return res.status(400).json({ error: 'Invalid return ID' });
    }

    const { refundCents, refundMethod = 'original' } = req.body;

    if (!['original', 'store_credit', 'cash', 'check', 'manual'].includes(refundMethod)) {
      return res.status(400).json({ error: 'Invalid refund method' });
    }

    const result = await processRefund(returnId, refundCents || null, refundMethod);

    res.json({
      message: 'Refund processed successfully',
      refundAmountCents: result.refundAmountCents,
      refundMethod: result.refundMethod,
      creditNoteId: result.creditNoteId || null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/returns/:id/deny
 * Deny return
 */
router.post('/returns/:id/deny', async (req, res, next) => {
  try {
    const returnId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(returnId) || returnId <= 0) {
      return res.status(400).json({ error: 'Invalid return ID' });
    }

    const { comment } = req.body;

    await db
      .update(ecomReturns)
      .set({ 
        status: 'denied', 
        updatedAt: new Date(),
        // TODO: Store comment in notes field if available
      })
      .where(eq(ecomReturns.id, returnId));

    res.json({ message: 'Return denied' });
  } catch (error) {
    next(error);
  }
});


export default router;

