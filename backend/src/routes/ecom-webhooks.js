/**
 * E-Commerce Webhook Routes
 * Handles incoming webhooks from eBay, Shopify, and other marketplaces
 */

import express from 'express';
import crypto from 'crypto';
import { db } from '../db/connection.js';
import { ecomChannels, ecomWebhookLogs, ecomOrders, ecomOrderItems } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { normalizeOrder } from '../services/ecommerce/order-normalizer.js';
import { reserveInventoryForOrder } from '../services/ecommerce/inventory-reservation.js';

const router = express.Router();

// Simple in-memory rate limiter for webhooks
// Key: IP address, Value: { count: number, resetAt: timestamp }
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP

/**
 * Rate limiting middleware for webhook endpoints
 * Allows up to 100 requests per minute per IP address
 */
function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  // Clean up old entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  const entry = rateLimitStore.get(ip);
  
  if (!entry || entry.resetAt < now) {
    // New window or expired window
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return next();
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
  }
  
  entry.count++;
  next();
}

/**
 * Request validation middleware
 * Validates that the request has required fields for webhook processing
 */
function validateWebhookRequest(req, res, next) {
  // Webhooks should have a body
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  
  // Channel ID should be a valid number
  const channelId = Number.parseInt(req.params.channelId, 10);
  if (!Number.isFinite(channelId) || channelId <= 0) {
    return res.status(400).json({ error: 'Invalid channel ID' });
  }
  
  next();
}

// Apply rate limiting to all webhook routes
router.use(rateLimitMiddleware);

// Middleware to parse JSON (webhooks send raw JSON)
// This must be after rate limiting but before validation
router.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Apply validation middleware
router.use(validateWebhookRequest);

/**
 * Verify eBay webhook signature
 * @param {Buffer} payload - Raw request body
 * @param {string} signature - X-EBAY-SIGNATURE header
 * @param {string} secret - Webhook secret from channel config
 * @returns {boolean} True if signature is valid
 */
function verifyEBaySignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Verify Shopify webhook signature
 * @param {Buffer} payload - Raw request body
 * @param {string} signature - X-Shopify-Hmac-Sha256 header
 * @param {string} secret - Webhook secret from channel config
 * @returns {boolean} True if signature is valid
 */
function verifyShopifySignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Log webhook to database
 * @param {number} channelId - Channel ID
 * @param {string} eventType - Event type
 * @param {Object} payload - Webhook payload
 * @param {boolean} processed - Whether webhook was processed successfully
 * @param {string|null} errorMessage - Error message if processing failed
 */
async function logWebhook(channelId, eventType, payload, processed = false, errorMessage = null) {
  try {
    await db.insert(ecomWebhookLogs).values({
      channelId,
      eventType,
      payload: JSON.stringify(payload),
      processed,
      errorMessage,
    });
  } catch (error) {
    console.error('Failed to log webhook:', error.message);
  }
}

/**
 * Process webhook asynchronously
 * @param {number} channelId - Channel ID
 * @param {string} eventType - Event type
 * @param {Object} payload - Webhook payload
 */
async function processWebhook(channelId, eventType, payload) {
  try {
    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    if (!channel || channel.status !== 'connected') {
      throw new Error('Channel not found or not connected');
    }

    // Handle different event types
    switch (eventType) {
      case 'ORDER.CREATED':
      case 'orders/create': // Shopify
        await handleOrderWebhook(channel, payload, 'created');
        break;

      case 'ORDER.UPDATED':
      case 'orders/updated': // Shopify
        await handleOrderWebhook(channel, payload, 'updated');
        break;

      case 'ORDER.CANCELLED':
      case 'orders/cancelled': // Shopify
        await handleOrderWebhook(channel, payload, 'cancelled');
        break;

      case 'INVENTORY.UPDATED':
      case 'inventory_levels/update': // Shopify
        await handleInventoryWebhook(channel, payload);
        break;

      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
    }

    await logWebhook(channelId, eventType, payload, true);
  } catch (error) {
    console.error(`Error processing webhook ${eventType}:`, error.message);
    await logWebhook(channelId, eventType, payload, false, error.message);
    throw error;
  }
}

/**
 * Handle order webhook (created, updated, cancelled)
 * Unified handler for all order-related webhook events
 */
async function handleOrderWebhook(channel, payload, action) {
  const rawOrder = channel.provider === 'ebay' 
    ? payload.notification?.data 
    : payload; // Shopify sends order directly

  if (!rawOrder) return;

  const normalizedOrder = normalizeOrder(rawOrder, channel.provider);

  // Find existing order
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

  if (action === 'created') {
    if (existing) {
      // Order already exists, skip
      return;
    }

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

    // Reserve inventory
    try {
      await reserveInventoryForOrder(newOrder.id);
    } catch (error) {
      console.error(`Failed to reserve inventory for webhook order ${newOrder.id}:`, error.message);
    }
  } else if (action === 'updated' || action === 'cancelled') {
    if (!existing) {
      // Order doesn't exist yet, treat as created
      await handleOrderWebhook(channel, payload, 'created');
      return;
    }

    // Update existing order
    const updates = {
      status: normalizedOrder.status,
      paymentStatus: normalizedOrder.paymentStatus,
      fulfillmentStatus: normalizedOrder.fulfillmentStatus,
      totalCents: normalizedOrder.totalCents,
      updatedAt: new Date(),
    };

    if (action === 'cancelled') {
      updates.status = 'cancelled';
    }

    await db
      .update(ecomOrders)
      .set(updates)
      .where(eq(ecomOrders.id, existing.id));
  }
}

/**
 * Handle order created webhook (deprecated - use handleOrderWebhook)
 * @deprecated Use handleOrderWebhook instead
 */
async function handleOrderCreated(channel, payload) {
  return handleOrderWebhook(channel, payload, 'created');
  const rawOrder = channel.provider === 'ebay' 
    ? payload.notification?.data 
    : payload; // Shopify sends order directly

  if (!rawOrder) return;

  const normalizedOrder = normalizeOrder(rawOrder, channel.provider);

  // Check if order already exists
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
    // Order already exists, skip
    return;
  }

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

  // Reserve inventory
  try {
    await reserveInventoryForOrder(newOrder.id);
  } catch (error) {
    console.error(`Failed to reserve inventory for webhook order ${newOrder.id}:`, error.message);
  }
}

/**
 * Handle order updated webhook (deprecated - use handleOrderWebhook)
 * @deprecated Use handleOrderWebhook instead
 */
async function handleOrderUpdated(channel, payload) {
  return handleOrderWebhook(channel, payload, 'updated');
}

/**
 * Handle inventory webhook
 * Updates inventory sync status and can trigger immediate sync if needed
 */
async function handleInventoryWebhook(channel, payload) {
  // For inventory updates, we typically want to sync FROM marketplace TO our system
  // This is usually handled by the scheduled sync, but we can log it here
  console.log(`Inventory updated webhook received for channel ${channel.id}`);
  
  // Log the inventory update details
  const inventoryData = channel.provider === 'shopify'
    ? payload // Shopify sends inventory_level data directly
    : payload.notification?.data; // eBay format
  
  if (inventoryData) {
    console.log(`Inventory webhook payload:`, JSON.stringify(inventoryData, null, 2));
    
    // TODO: Could trigger immediate inventory sync here if needed
    // For now, the scheduled sync will handle it
  }
}

/**
 * Handle inventory updated webhook (deprecated - use handleInventoryWebhook)
 * @deprecated Use handleInventoryWebhook instead
 */
async function handleInventoryUpdated(channel, payload) {
  return handleInventoryWebhook(channel, payload);
}

/**
 * POST /api/ecom/webhooks/ebay/:channelId
 * eBay webhook endpoint
 */
/**
 * POST /api/ecom/webhooks/ebay/:channelId
 * eBay webhook endpoint
 */
router.post('/ebay/:channelId', async (req, res, next) => {
  try {
    // Validation middleware already checked channelId
    const channelId = Number.parseInt(req.params.channelId, 10);

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.provider !== 'ebay') {
      return res.status(400).json({ error: 'Channel is not an eBay channel' });
    }

    const config = typeof channel.config === 'string' ? JSON.parse(channel.config) : channel.config;
    const webhookSecret = config.webhookSecret;

    // Verify webhook signature
    const signature = req.headers['x-ebay-signature'];
    if (webhookSecret && !verifyEBaySignature(req.rawBody, signature, webhookSecret)) {
      await logWebhook(channelId, 'unknown', req.body, false, 'Invalid signature');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const eventType = req.body.notification?.notificationType || 'unknown';
    const payload = req.body;

    // Log webhook before processing
    await logWebhook(channelId, eventType, payload, false);

    // Process webhook asynchronously (don't block response)
    processWebhook(channelId, eventType, payload).catch(error => {
      console.error('Async webhook processing error:', error);
    });

    // Respond immediately
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ecom/webhooks/shopify/:channelId
 * Shopify webhook endpoint
 */
router.post('/shopify/:channelId', async (req, res, next) => {
  try {
    // Validation middleware already checked channelId
    const channelId = Number.parseInt(req.params.channelId, 10);

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.provider !== 'shopify') {
      return res.status(400).json({ error: 'Channel is not a Shopify channel' });
    }

    const config = typeof channel.config === 'string' ? JSON.parse(channel.config) : channel.config;
    const webhookSecret = config.webhookSecret;

    // Verify HMAC signature (Shopify uses HMAC-SHA256)
    const signature = req.headers['x-shopify-hmac-sha256'];
    if (webhookSecret && !verifyShopifySignature(req.rawBody, signature, webhookSecret)) {
      await logWebhook(channelId, 'unknown', req.body, false, 'Invalid HMAC signature');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // Shopify sends event type in X-Shopify-Topic header
    const eventType = req.headers['x-shopify-topic'] || 'unknown';
    const payload = req.body;

    // Log webhook before processing
    await logWebhook(channelId, eventType, payload, false);

    // Process webhook asynchronously
    processWebhook(channelId, eventType, payload).catch(error => {
      console.error('Async webhook processing error:', error);
    });

    // Respond immediately
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});

export default router;

