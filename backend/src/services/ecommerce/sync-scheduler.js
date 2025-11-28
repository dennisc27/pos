/**
 * Sync Scheduler Service
 * Handles scheduled synchronization of inventory and orders with ecommerce channels
 */

import cron from 'node-cron';
import { db } from '../../db/connection.js';
import { ecomChannels, ecomListings, ecomOrders, ecomOrderItems, ecomChannelLogs, productCodeVersions, settings } from '../../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { eBayAdapter } from './ebay-adapter.js';
import { ShopifyAdapter } from './shopify-adapter.js';
import { normalizeOrder } from './order-normalizer.js';
import { reserveInventoryForOrder } from './inventory-reservation.js';
import { handleSyncError, syncWithRetry } from './error-handler.js';

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

/**
 * Sync inventory for a specific channel
 * @param {Object} channel - Channel configuration
 * @returns {Promise<Object>} Sync result
 */
export async function syncInventoryForChannel(channel) {
  const logEntry = {
    channelId: channel.id,
    operation: 'sync_inventory',
    status: 'success',
    recordsProcessed: 0,
    recordsFailed: 0,
    errorMessage: null,
    metadata: {},
    startedAt: new Date(),
    completedAt: null,
  };

  try {
    const adapter = getAdapter(channel);

    // Get all active listings for this channel
    const listings = await db
      .select()
      .from(ecomListings)
      .where(
        and(
          eq(ecomListings.channelId, channel.id),
          eq(ecomListings.status, 'active')
        )
      );

    logEntry.metadata.totalListings = listings.length;

    for (const listing of listings) {
      try {
        // Get current inventory from product code version
        const version = await getProductCodeVersion(
          listing.productCodeId,
          channel.branchId
        );

        const availableQty = Math.max(0, version.qtyOnHand - version.qtyReserved);

        // Update inventory on marketplace
        // Note: Different adapters use different identifiers
        let updateResult;
        if (channel.provider === 'ebay') {
          // eBay uses SKU (product code) for inventory updates
          updateResult = await syncWithRetry(
            () => adapter.updateInventory(version.code, availableQty),
            { operation: 'updateInventory', listingId: listing.id }
          );
        } else if (channel.provider === 'shopify') {
          // Shopify uses inventory_item_id (stored in listing.attributes or needs to be fetched)
          // For now, we'll try to get it from the variant if externalId is set
          let inventoryItemId = listing.attributes?.inventoryItemId;
          
          if (!inventoryItemId && listing.externalId) {
            // Try to fetch the product to get inventory_item_id
            try {
              const productResponse = await fetch(
                `${adapter.baseUrl}/products/${listing.externalId}.json`,
                { headers: adapter.getHeaders() }
              );
              if (productResponse.ok) {
                const productData = await productResponse.json();
                inventoryItemId = productData.product?.variants?.[0]?.inventory_item_id;
              }
            } catch (fetchError) {
              console.warn(`Could not fetch inventory_item_id for listing ${listing.id}:`, fetchError.message);
            }
          }

          if (!inventoryItemId) {
            throw new Error('inventory_item_id not found for Shopify listing');
          }

          updateResult = await syncWithRetry(
            () => adapter.updateInventory(inventoryItemId, availableQty, channel.config?.locationId),
            { operation: 'updateInventory', listingId: listing.id }
          );
        } else {
          throw new Error(`Unsupported provider for inventory sync: ${channel.provider}`);
        }

        if (updateResult.success) {
          // Update sync status
          await db
            .update(ecomListings)
            .set({
              lastSyncedAt: new Date(),
              syncStatus: 'synced',
              syncError: null,
            })
            .where(eq(ecomListings.id, listing.id));

          logEntry.recordsProcessed++;
        } else {
          // Update error status
          await db
            .update(ecomListings)
            .set({
              syncStatus: 'error',
              syncError: JSON.stringify(updateResult.error),
            })
            .where(eq(ecomListings.id, listing.id));

          logEntry.recordsFailed++;
        }
      } catch (error) {
        logEntry.recordsFailed++;
        console.error(`Error syncing listing ${listing.id}:`, error.message);
      }
    }

    // Update channel last sync time
    await db
      .update(ecomChannels)
      .set({ lastSyncAt: new Date() })
      .where(eq(ecomChannels.id, channel.id));

    logEntry.status = logEntry.recordsFailed > 0 ? 'partial' : 'success';
    logEntry.completedAt = new Date();

    // Log sync operation
    await db.insert(ecomChannelLogs).values(logEntry);

    return {
      success: true,
      processed: logEntry.recordsProcessed,
      failed: logEntry.recordsFailed,
    };
  } catch (error) {
    logEntry.status = 'error';
    logEntry.errorMessage = error.message;
    logEntry.completedAt = new Date();

    await handleSyncError(channel.id, error, 'sync_inventory');
    await db.insert(ecomChannelLogs).values(logEntry);

    return {
      success: false,
      error: error.message,
      processed: logEntry.recordsProcessed,
      failed: logEntry.recordsFailed,
    };
  }
}

/**
 * Sync orders for a specific channel
 * @param {Object} channel - Channel configuration
 * @returns {Promise<Object>} Sync result
 */
export async function syncOrdersForChannel(channel) {
  const logEntry = {
    channelId: channel.id,
    operation: 'sync_orders',
    status: 'success',
    recordsProcessed: 0,
    recordsFailed: 0,
    errorMessage: null,
    metadata: {},
    startedAt: new Date(),
    completedAt: null,
  };

  try {
    const adapter = getAdapter(channel);

    // Get last sync time or default to 1 hour ago
    const lastSync = channel.lastSyncAt
      ? new Date(channel.lastSyncAt)
      : new Date(Date.now() - 60 * 60 * 1000);

    // Fetch orders from marketplace
    const fetchResult = await syncWithRetry(
      () => adapter.fetchOrders({
        createdAfter: lastSync.toISOString(),
        limit: 100,
      }),
      { operation: 'fetchOrders', channelId: channel.id }
    );

    if (!fetchResult.success) {
      throw new Error(fetchResult.error || 'Failed to fetch orders');
    }

    const rawOrders = fetchResult.orders || [];
    logEntry.metadata.totalOrders = rawOrders.length;

    for (const rawOrder of rawOrders) {
      try {
        // Normalize order to internal format
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
          // Update existing order
          await db
            .update(ecomOrders)
            .set({
              status: normalizedOrder.status,
              paymentStatus: normalizedOrder.paymentStatus,
              fulfillmentStatus: normalizedOrder.fulfillmentStatus,
              totalCents: normalizedOrder.totalCents,
              updatedAt: new Date(),
            })
            .where(eq(ecomOrders.id, existing.id));

          logEntry.recordsProcessed++;
          continue;
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

        // Reserve inventory for the order
        try {
          await reserveInventoryForOrder(newOrder.id);
        } catch (inventoryError) {
          console.error(`Failed to reserve inventory for order ${newOrder.id}:`, inventoryError.message);
          // Continue - inventory reservation failure doesn't prevent order import
        }

        logEntry.recordsProcessed++;
      } catch (error) {
        logEntry.recordsFailed++;
        console.error(`Error importing order ${rawOrder.id || rawOrder.orderId}:`, error.message);
      }
    }

    // Update channel last sync time
    await db
      .update(ecomChannels)
      .set({ lastSyncAt: new Date() })
      .where(eq(ecomChannels.id, channel.id));

    logEntry.status = logEntry.recordsFailed > 0 ? 'partial' : 'success';
    logEntry.completedAt = new Date();

    // Log sync operation
    await db.insert(ecomChannelLogs).values(logEntry);

    return {
      success: true,
      processed: logEntry.recordsProcessed,
      failed: logEntry.recordsFailed,
    };
  } catch (error) {
    logEntry.status = 'error';
    logEntry.errorMessage = error.message;
    logEntry.completedAt = new Date();

    await handleSyncError(channel.id, error, 'sync_orders');
    await db.insert(ecomChannelLogs).values(logEntry);

    return {
      success: false,
      error: error.message,
      processed: logEntry.recordsProcessed,
      failed: logEntry.recordsFailed,
    };
  }
}

/**
 * Load ecommerce settings from database
 * @returns {Promise<{inventorySyncMinutes: number, orderSyncMinutes: number}>}
 */
async function loadEcommerceSettings() {
  try {
    const [setting] = await db
      .select({ value: settings.v })
      .from(settings)
      .where(
        and(
          eq(settings.scope, 'global'),
          eq(settings.k, 'ecommerce.settings'),
          isNull(settings.branchId),
          isNull(settings.userId)
        )
      )
      .limit(1);

    if (setting?.value && typeof setting.value === 'object') {
      const raw = setting.value;
      return {
        inventorySyncMinutes: Number(raw.inventorySyncMinutes) || 15,
        orderSyncMinutes: Number(raw.orderSyncMinutes) || 5,
      };
    }
  } catch (error) {
    console.warn('⚠️  Failed to load ecommerce settings, using defaults:', error.message);
  }

  // Default values
  return {
    inventorySyncMinutes: 15,
    orderSyncMinutes: 5,
  };
}

/**
 * Convert minutes to cron schedule
 * @param {number} minutes - Minutes interval
 * @returns {string} Cron schedule string
 */
function minutesToCron(minutes) {
  if (minutes < 1 || minutes > 1440) {
    throw new Error('Minutes must be between 1 and 1440');
  }
  
  // For intervals <= 60 minutes, use simple syntax: */N * * * *
  if (minutes <= 60) {
    return `*/${minutes} * * * *`;
  }
  
  // For intervals > 60 minutes, convert to hours and minutes
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    // Exact hours: run every N hours at minute 0
    return `0 */${hours} * * *`;
  } else {
    // Mixed hours and minutes: run every N hours at specific minute
    // This runs at the specified minute past every N hours
    return `${remainingMinutes} */${hours} * * *`;
  }
}

// Store cron task references for dynamic updates
let inventorySyncTask = null;
let orderSyncTask = null;

/**
 * Start scheduled sync jobs
 */
export async function startSyncScheduler() {
  console.log('🔄 Starting ecommerce sync scheduler...');

  // Load settings
  const ecomSettings = await loadEcommerceSettings();
  
  // Stop existing tasks if they exist
  if (inventorySyncTask) {
    inventorySyncTask.stop();
  }
  if (orderSyncTask) {
    orderSyncTask.stop();
  }

  // Sync inventory
  const inventoryCron = minutesToCron(ecomSettings.inventorySyncMinutes);
  inventorySyncTask = cron.schedule(inventoryCron, async () => {
    console.log('📦 Running inventory sync...');

    try {
      const channels = await db
        .select()
        .from(ecomChannels)
        .where(eq(ecomChannels.status, 'connected'));

      for (const channel of channels) {
        console.log(`  Syncing inventory for channel: ${channel.name} (${channel.provider})`);
        const result = await syncInventoryForChannel(channel);
        console.log(`  ✅ Processed: ${result.processed}, Failed: ${result.failed}`);
      }
    } catch (error) {
      console.error('❌ Inventory sync error:', error.message);
    }
  });

  // Sync orders
  const orderCron = minutesToCron(ecomSettings.orderSyncMinutes);
  orderSyncTask = cron.schedule(orderCron, async () => {
    console.log('📋 Running order sync...');

    try {
      const channels = await db
        .select()
        .from(ecomChannels)
        .where(eq(ecomChannels.status, 'connected'));

      for (const channel of channels) {
        console.log(`  Syncing orders for channel: ${channel.name} (${channel.provider})`);
        const result = await syncOrdersForChannel(channel);
        console.log(`  ✅ Processed: ${result.processed}, Failed: ${result.failed}`);
      }
    } catch (error) {
      console.error('❌ Order sync error:', error.message);
    }
  });

  console.log('✅ Sync scheduler started');
  console.log(`  - Inventory sync: every ${ecomSettings.inventorySyncMinutes} minutes`);
  console.log(`  - Order sync: every ${ecomSettings.orderSyncMinutes} minutes`);
}

/**
 * Reload scheduler with updated settings
 * Call this when settings are updated
 */
export async function reloadSyncScheduler() {
  console.log('🔄 Reloading ecommerce sync scheduler with updated settings...');
  await startSyncScheduler();
}

/**
 * Stop sync scheduler (for testing or graceful shutdown)
 */
export function stopSyncScheduler() {
  // Note: node-cron doesn't provide a direct way to stop all tasks
  // In production, you might want to store task references and destroy them
  console.log('🛑 Sync scheduler stopped');
}

