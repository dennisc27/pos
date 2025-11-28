/**
 * Real-time Sync Service
 * Handles inventory, price, and status sync on changes
 */

import { db } from '../../db/connection.js';
import { ecomChannels, ecomListings, productCodeVersions, productCodes } from '../../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { eBayAdapter } from './ebay-adapter.js';
import { ShopifyAdapter } from './shopify-adapter.js';
import { syncWithRetry } from './error-handler.js';

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
 * Sync inventory for listings when stock changes
 * @param {number|number[]} productCodeId - Product code ID(s) that changed
 * @param {number|null} branchId - Optional branch ID
 * @returns {Promise<Object>} Sync results
 */
export async function syncInventoryOnStockChange(productCodeId, branchId = null) {
  const productCodeIds = Array.isArray(productCodeId) ? productCodeId : [productCodeId];

  try {
    // Get all active listings for these product codes
    const listings = await db
      .select()
      .from(ecomListings)
      .where(
        and(
          inArray(ecomListings.productCodeId, productCodeIds),
          eq(ecomListings.status, 'active')
        )
      );

    if (listings.length === 0) {
      return { success: true, synced: 0, message: 'No active listings found' };
    }

    // Group listings by channel
    const listingsByChannel = new Map();
    for (const listing of listings) {
      if (!listingsByChannel.has(listing.channelId)) {
        listingsByChannel.set(listing.channelId, []);
      }
      listingsByChannel.get(listing.channelId).push(listing);
    }

    const results = {
      success: true,
      synced: 0,
      failed: 0,
      channels: [],
    };

    // Sync each channel
    for (const [channelId, channelListings] of listingsByChannel.entries()) {
      const [channel] = await db
        .select()
        .from(ecomChannels)
        .where(
          and(
            eq(ecomChannels.id, channelId),
            eq(ecomChannels.status, 'connected')
          )
        )
        .limit(1);

      if (!channel) {
        continue;
      }

      const adapter = getAdapter(channel);
      let channelSynced = 0;
      let channelFailed = 0;

      for (const listing of channelListings) {
        try {
          // Get current product code version
          const conditions = [
            eq(productCodeVersions.productCodeId, listing.productCodeId),
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
            continue;
          }

          // Calculate available quantity
          const availableQty = version.qtyOnHand - version.qtyReserved;

          // Update inventory on marketplace
          const updateResult = await syncWithRetry(
            () => {
              if (channel.provider === 'ebay') {
                return adapter.updateInventory(listing.externalId, availableQty);
              } else if (channel.provider === 'shopify') {
                return adapter.updateInventory(listing.inventoryItemId, availableQty);
              }
            },
            { operation: 'updateInventory', channelId, listingId: listing.id }
          );

          if (updateResult.success) {
            await db
              .update(ecomListings)
              .set({
                lastSyncedAt: new Date(),
                syncStatus: 'synced',
                syncError: null,
              })
              .where(eq(ecomListings.id, listing.id));

            channelSynced++;
            results.synced++;
          } else {
            await db
              .update(ecomListings)
              .set({
                syncStatus: 'error',
                syncError: JSON.stringify(updateResult.error),
              })
              .where(eq(ecomListings.id, listing.id));

            channelFailed++;
            results.failed++;
          }
        } catch (error) {
          channelFailed++;
          results.failed++;
          console.error(`Error syncing inventory for listing ${listing.id}:`, error.message);
        }
      }

      results.channels.push({
        channelId,
        channelName: channel.name,
        synced: channelSynced,
        failed: channelFailed,
      });
    }

    return results;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Sync price for listings when price changes
 * @param {number|number[]} productCodeId - Product code ID(s) that changed
 * @returns {Promise<Object>} Sync results
 */
export async function syncPriceOnChange(productCodeId) {
  const productCodeIds = Array.isArray(productCodeId) ? productCodeId : [productCodeId];

  try {
    // Get all active listings for these product codes
    const listings = await db
      .select()
      .from(ecomListings)
      .where(
        and(
          inArray(ecomListings.productCodeId, productCodeIds),
          eq(ecomListings.status, 'active')
        )
      );

    if (listings.length === 0) {
      return { success: true, synced: 0, message: 'No active listings found' };
    }

    // Group listings by channel
    const listingsByChannel = new Map();
    for (const listing of listings) {
      if (!listingsByChannel.has(listing.channelId)) {
        listingsByChannel.set(listing.channelId, []);
      }
      listingsByChannel.get(listing.channelId).push(listing);
    }

    const results = {
      success: true,
      synced: 0,
      failed: 0,
      channels: [],
    };

    // Sync each channel
    for (const [channelId, channelListings] of listingsByChannel.entries()) {
      const [channel] = await db
        .select()
        .from(ecomChannels)
        .where(
          and(
            eq(ecomChannels.id, channelId),
            eq(ecomChannels.status, 'connected')
          )
        )
        .limit(1);

      if (!channel) {
        continue;
      }

      const adapter = getAdapter(channel);
      let channelSynced = 0;
      let channelFailed = 0;

      for (const listing of channelListings) {
        try {
          // Use listing price override or get from product code
          let priceCents = listing.priceCents;

          if (!priceCents) {
            const [productCode] = await db
              .select()
              .from(productCodes)
              .where(eq(productCodes.id, listing.productCodeId))
              .limit(1);

            if (productCode && productCode.priceCents) {
              priceCents = productCode.priceCents;
            } else {
              continue; // Skip if no price available
            }
          }

          // Update listing on marketplace (price is part of createOrUpdateListing)
          const updateResult = await syncWithRetry(
            async () => {
              // Get product code version for full listing data
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
                throw new Error('No active version found');
              }

              // Create updated listing object with new price
              const updatedListing = {
                ...listing,
                priceCents,
              };

              return adapter.createOrUpdateListing(updatedListing, version);
            },
            { operation: 'updatePrice', channelId, listingId: listing.id }
          );

          if (updateResult.success) {
            await db
              .update(ecomListings)
              .set({
                priceCents,
                lastSyncedAt: new Date(),
                syncStatus: 'synced',
                syncError: null,
              })
              .where(eq(ecomListings.id, listing.id));

            channelSynced++;
            results.synced++;
          } else {
            await db
              .update(ecomListings)
              .set({
                syncStatus: 'error',
                syncError: JSON.stringify(updateResult.error),
              })
              .where(eq(ecomListings.id, listing.id));

            channelFailed++;
            results.failed++;
          }
        } catch (error) {
          channelFailed++;
          results.failed++;
          console.error(`Error syncing price for listing ${listing.id}:`, error.message);
        }
      }

      results.channels.push({
        channelId,
        channelName: channel.name,
        synced: channelSynced,
        failed: channelFailed,
      });
    }

    return results;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Sync listing status (active/inactive)
 * @param {number} listingId - Listing ID
 * @param {string} status - New status ('active' or 'inactive')
 * @returns {Promise<Object>} Sync result
 */
export async function syncListingStatus(listingId, status) {
  try {
    const [listing] = await db
      .select()
      .from(ecomListings)
      .where(eq(ecomListings.id, listingId))
      .limit(1);

    if (!listing) {
      throw new Error('Listing not found');
    }

    const [channel] = await db
      .select()
      .from(ecomChannels)
      .where(
        and(
          eq(ecomChannels.id, listing.channelId),
          eq(ecomChannels.status, 'connected')
        )
      )
      .limit(1);

    if (!channel) {
      throw new Error('Channel not found or not connected');
    }

    const adapter = getAdapter(channel);

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
      throw new Error('No active version found');
    }

    // Update listing status on marketplace
    const updateResult = await syncWithRetry(
      () => {
        const updatedListing = {
          ...listing,
          status,
        };
        return adapter.createOrUpdateListing(updatedListing, version);
      },
      { operation: 'updateStatus', channelId: channel.id, listingId }
    );

    if (updateResult.success) {
      await db
        .update(ecomListings)
        .set({
          status,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          syncError: null,
        })
        .where(eq(ecomListings.id, listingId));

      return {
        success: true,
        message: 'Listing status synced successfully',
      };
    } else {
      await db
        .update(ecomListings)
        .set({
          syncStatus: 'error',
          syncError: JSON.stringify(updateResult.error),
        })
        .where(eq(ecomListings.id, listingId));

      return {
        success: false,
        error: updateResult.error,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Resolve conflicts between marketplace and POS changes
 * @param {number} listingId - Listing ID
 * @param {string} conflictType - Type of conflict ('inventory', 'price', 'status')
 * @param {string} resolution - Resolution strategy ('pos_wins', 'marketplace_wins', 'manual')
 * @returns {Promise<Object>} Resolution result
 */
export async function resolveConflict(listingId, conflictType, resolution) {
  try {
    const [listing] = await db
      .select()
      .from(ecomListings)
      .where(eq(ecomListings.id, listingId))
      .limit(1);

    if (!listing) {
      throw new Error('Listing not found');
    }

    if (resolution === 'pos_wins') {
      // Sync POS values to marketplace
      if (conflictType === 'inventory') {
        return await syncInventoryOnStockChange(listing.productCodeId);
      } else if (conflictType === 'price') {
        return await syncPriceOnChange(listing.productCodeId);
      } else if (conflictType === 'status') {
        return await syncListingStatus(listingId, listing.status);
      }
    } else if (resolution === 'marketplace_wins') {
      // TODO: Fetch from marketplace and update POS
      // This would require fetching the listing from marketplace and updating local values
      return {
        success: false,
        error: 'Marketplace-wins resolution not yet implemented',
      };
    } else {
      // Manual resolution - just mark as resolved
      await db
        .update(ecomListings)
        .set({
          syncStatus: 'synced',
          syncError: null,
        })
        .where(eq(ecomListings.id, listingId));

      return {
        success: true,
        message: 'Conflict marked as manually resolved',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export default {
  syncInventoryOnStockChange,
  syncPriceOnChange,
  syncListingStatus,
  resolveConflict,
};

