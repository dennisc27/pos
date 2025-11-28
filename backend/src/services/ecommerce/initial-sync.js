/**
 * Initial Sync Service
 * Handles full catalog sync and historical order import
 */

import { db } from '../../db/connection.js';
import { ecomChannels, ecomListings, ecomOrders, productCodes, productCodeVersions } from '../../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { syncInventoryForChannel, syncOrdersForChannel } from './sync-scheduler.js';
import { eBayAdapter } from './ebay-adapter.js';
import { ShopifyAdapter } from './shopify-adapter.js';
import { normalizeOrder } from './order-normalizer.js';
import { reserveInventoryForOrder } from './inventory-reservation.js';
import { handleSyncError, syncWithRetry } from './error-handler.js';
import { ecomChannelLogs, ecomOrderItems } from '../../db/schema.js';

/**
 * Get adapter instance for a channel
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
 * Full catalog sync - sync all active listings to all connected channels
 * @param {number|null} channelId - Optional specific channel ID, or null for all channels
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Object>} Sync results
 */
export async function fullCatalogSync(channelId = null, progressCallback = null) {
  const logEntry = {
    channelId: channelId || 0, // 0 means all channels
    operation: 'full_catalog_sync',
    status: 'in_progress',
    recordsProcessed: 0,
    recordsFailed: 0,
    errorMessage: null,
    metadata: {},
    startedAt: new Date(),
    completedAt: null,
  };

  try {
    // Get channels to sync
    const conditions = [eq(ecomChannels.status, 'connected')];
    if (channelId) {
      conditions.push(eq(ecomChannels.id, channelId));
    }

    const channels = await db
      .select()
      .from(ecomChannels)
      .where(and(...conditions));

    if (channels.length === 0) {
      throw new Error('No connected channels found');
    }

    logEntry.metadata.totalChannels = channels.length;

    // Get all active listings
    const listings = await db
      .select()
      .from(ecomListings)
      .where(eq(ecomListings.status, 'active'));

    logEntry.metadata.totalListings = listings.length;

    const results = {
      channels: [],
      totalProcessed: 0,
      totalFailed: 0,
    };

    // Sync each channel
    for (const channel of channels) {
      const channelLog = {
        channelId: channel.id,
        operation: 'full_catalog_sync',
        status: 'in_progress',
        recordsProcessed: 0,
        recordsFailed: 0,
        errorMessage: null,
        metadata: {},
        startedAt: new Date(),
        completedAt: null,
      };

      try {
        const adapter = getAdapter(channel);

        // Get listings for this channel
        const channelListings = listings.filter(
          listing => !channelId || listing.channelId === channel.id
        );

        channelLog.metadata.totalListings = channelListings.length;

        // Sync each listing
        for (let i = 0; i < channelListings.length; i++) {
          const listing = channelListings[i];

          try {
            // Get product code version
            const [version] = await db
              .select()
              .from(productCodeVersions)
              .where(
                and(
                  eq(productCodeVersions.productCodeId, listing.productCodeId),
                  eq(productCodeVersions.isActive, true)
                )
              )
              .limit(1);

            if (!version) {
              throw new Error(`No active version found for product code ${listing.productCodeId}`);
            }

            // Sync to marketplace
            const syncResult = await syncWithRetry(
              () => adapter.createOrUpdateListing(listing, version),
              { operation: 'createOrUpdateListing', channelId: channel.id, listingId: listing.id }
            );

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

              channelLog.recordsProcessed++;
              results.totalProcessed++;
            } else {
              await db
                .update(ecomListings)
                .set({
                  syncStatus: 'error',
                  syncError: JSON.stringify(syncResult.error),
                })
                .where(eq(ecomListings.id, listing.id));

              channelLog.recordsFailed++;
              results.totalFailed++;
            }

            // Progress callback
            if (progressCallback) {
              progressCallback({
                channelId: channel.id,
                channelName: channel.name,
                listingId: listing.id,
                progress: ((i + 1) / channelListings.length) * 100,
                processed: channelLog.recordsProcessed,
                failed: channelLog.recordsFailed,
              });
            }
          } catch (error) {
            channelLog.recordsFailed++;
            results.totalFailed++;
            console.error(`Error syncing listing ${listing.id} to channel ${channel.id}:`, error.message);
          }
        }

        channelLog.status = channelLog.recordsFailed > 0 ? 'partial' : 'success';
        channelLog.completedAt = new Date();

        // Log channel sync
        await db.insert(ecomChannelLogs).values(channelLog);

        results.channels.push({
          channelId: channel.id,
          channelName: channel.name,
          processed: channelLog.recordsProcessed,
          failed: channelLog.recordsFailed,
        });
      } catch (error) {
        channelLog.status = 'error';
        channelLog.errorMessage = error.message;
        channelLog.completedAt = new Date();

        await handleSyncError(channel.id, error, 'full_catalog_sync');
        await db.insert(ecomChannelLogs).values(channelLog);

        results.channels.push({
          channelId: channel.id,
          channelName: channel.name,
          error: error.message,
        });
      }
    }

    logEntry.status = results.totalFailed > 0 ? 'partial' : 'success';
    logEntry.recordsProcessed = results.totalProcessed;
    logEntry.recordsFailed = results.totalFailed;
    logEntry.completedAt = new Date();
    logEntry.metadata.results = results;

    // Log overall sync
    if (!channelId) {
      await db.insert(ecomChannelLogs).values(logEntry);
    }

    return {
      success: true,
      ...results,
    };
  } catch (error) {
    logEntry.status = 'error';
    logEntry.errorMessage = error.message;
    logEntry.completedAt = new Date();

    await db.insert(ecomChannelLogs).values(logEntry);

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Historical order import - backfill orders from date range
 * @param {number} channelId - Channel ID
 * @param {Date} startDate - Start date for order import
 * @param {Date} endDate - End date for order import
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Object>} Import results
 */
export async function historicalOrderImport(channelId, startDate, endDate, progressCallback = null) {
  const logEntry = {
    channelId,
    operation: 'historical_order_import',
    status: 'in_progress',
    recordsProcessed: 0,
    recordsFailed: 0,
    errorMessage: null,
    metadata: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    startedAt: new Date(),
    completedAt: null,
  };

  try {
    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(eq(ecomChannels.id, channelId))
      .limit(1);

    if (!channel) {
      throw new Error('Channel not found');
    }

    if (channel.status !== 'connected') {
      throw new Error('Channel is not connected');
    }

    const adapter = getAdapter(channel);

    // Fetch orders in batches
    let allOrders = [];
    let hasMore = true;
    let offset = 0;
    const limit = 100;

    while (hasMore) {
      const fetchResult = await syncWithRetry(
        () => adapter.fetchOrders({
          startDate,
          endDate,
          limit,
          offset,
        }),
        { operation: 'fetchOrders', channelId }
      );

      if (!fetchResult.success) {
        throw new Error(fetchResult.error || 'Failed to fetch orders');
      }

      const orders = fetchResult.orders || [];
      allOrders = allOrders.concat(orders);

      hasMore = orders.length === limit;
      offset += limit;

      // Progress callback
      if (progressCallback) {
        progressCallback({
          channelId,
          fetched: allOrders.length,
          processed: logEntry.recordsProcessed,
          failed: logEntry.recordsFailed,
        });
      }
    }

    logEntry.metadata.totalOrders = allOrders.length;

    // Import each order
    for (let i = 0; i < allOrders.length; i++) {
      const rawOrder = allOrders[i];

      try {
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
              subtotalCents: normalizedOrder.subtotalCents,
              taxCents: normalizedOrder.taxCents,
              shippingCents: normalizedOrder.shippingCents,
              updatedAt: new Date(),
            })
            .where(eq(ecomOrders.id, existing.id));

          logEntry.recordsProcessed++;
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

          logEntry.recordsProcessed++;
        }

        // Progress callback
        if (progressCallback) {
          progressCallback({
            channelId,
            fetched: allOrders.length,
            processed: logEntry.recordsProcessed,
            failed: logEntry.recordsFailed,
            progress: ((i + 1) / allOrders.length) * 100,
          });
        }
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

    // Log import operation
    await db.insert(ecomChannelLogs).values(logEntry);

    return {
      success: true,
      processed: logEntry.recordsProcessed,
      failed: logEntry.recordsFailed,
      total: allOrders.length,
    };
  } catch (error) {
    logEntry.status = 'error';
    logEntry.errorMessage = error.message;
    logEntry.completedAt = new Date();

    await handleSyncError(channelId, error, 'historical_order_import');
    await db.insert(ecomChannelLogs).values(logEntry);

    return {
      success: false,
      error: error.message,
      processed: logEntry.recordsProcessed,
      failed: logEntry.recordsFailed,
    };
  }
}

export default {
  fullCatalogSync,
  historicalOrderImport,
};

