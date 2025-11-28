/**
 * Inventory Reservation Service
 * Handles inventory allocation and reservation for ecommerce orders
 */

import { db } from '../../db/connection.js';
import { ecomOrders, ecomOrderItems, ecomChannels, productCodeVersions, stockLedger } from '../../db/schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { mysqlEnum } from 'drizzle-orm/mysql-core';

/**
 * Reserve inventory for an ecommerce order
 * @param {number} ecomOrderId - Ecommerce order ID
 * @returns {Promise<void>}
 * @throws {Error} If order not found or insufficient inventory
 */
export async function reserveInventoryForOrder(ecomOrderId) {
  // Get order
  const [order] = await db
    .select()
    .from(ecomOrders)
    .where(eq(ecomOrders.id, ecomOrderId))
    .limit(1);

  if (!order) {
    throw new Error('Order not found');
  }

  // Get order items
  const items = await db
    .select()
    .from(ecomOrderItems)
    .where(eq(ecomOrderItems.ecomOrderId, ecomOrderId));

  if (items.length === 0) {
    throw new Error('Order has no items');
  }

  // Get channel to check branch restriction
  const [channel] = await db
    .select()
    .from(ecomChannels)
    .where(eq(ecomChannels.id, order.channelId))
    .limit(1);

  // Reserve inventory for each item
  for (const item of items) {
    if (!item.productCodeId) {
      throw new Error(`Order item ${item.id} has no product code ID`);
    }

    // Find available version
    const version = await findAvailableVersion(
      item.productCodeId,
      item.quantity,
      order.channelId,
      channel?.branchId
    );

    if (!version) {
      throw new Error(`Insufficient inventory for SKU: ${item.sku || 'unknown'}`);
    }

    // Reserve inventory (use transaction for atomicity)
    await db.transaction(async (tx) => {
      // Update version with reserved quantity
      await tx
        .update(productCodeVersions)
        .set({
          qtyReserved: sql`${productCodeVersions.qtyReserved} + ${item.quantity}`,
        })
        .where(eq(productCodeVersions.id, version.id));

      // Update order item with allocation
      await tx
        .update(ecomOrderItems)
        .set({
          allocatedBranchId: version.branchId,
          allocatedVersionId: version.id,
        })
        .where(eq(ecomOrderItems.id, item.id));

      // Log reservation in stock ledger
      await tx.insert(stockLedger).values({
        productCodeVersionId: version.id,
        qtyChange: -item.quantity,
        reason: 'sale',
        refTable: 'ecom_orders',
        refId: ecomOrderId,
      });
    });
  }
}

/**
 * Find available product code version with sufficient stock
 * @param {number} productCodeId - Product code ID
 * @param {number} quantity - Required quantity
 * @param {number} channelId - Channel ID (for logging)
 * @param {number|null} branchId - Optional branch restriction
 * @returns {Promise<Object|null>} Product code version or null if not found
 */
export async function findAvailableVersion(productCodeId, quantity, channelId, branchId = null) {
  // Build where conditions
  const conditions = [
    eq(productCodeVersions.productCodeId, productCodeId),
    sql`${productCodeVersions.qtyOnHand} - ${productCodeVersions.qtyReserved} >= ${quantity}`,
    eq(productCodeVersions.isActive, true),
  ];

  // Add branch restriction if specified
  if (branchId) {
    conditions.push(eq(productCodeVersions.branchId, branchId));
  }

  // Find versions with available stock, ordered by quantity (highest first)
  const versions = await db
    .select()
    .from(productCodeVersions)
    .where(and(...conditions))
    .orderBy(desc(productCodeVersions.qtyOnHand))
    .limit(1);

  return versions[0] || null;
}

/**
 * Release reserved inventory for an order (on cancellation)
 * @param {number} ecomOrderId - Ecommerce order ID
 * @returns {Promise<void>}
 * @throws {Error} If order not found
 */
export async function releaseInventoryForOrder(ecomOrderId) {
  // Get order items with allocations
  const items = await db
    .select()
    .from(ecomOrderItems)
    .where(eq(ecomOrderItems.ecomOrderId, ecomOrderId));

  if (items.length === 0) {
    return; // No items to release
  }

  // Release inventory for each allocated item
  for (const item of items) {
    if (!item.allocatedVersionId || !item.quantity) {
      continue; // Skip items without allocation
    }

    await db.transaction(async (tx) => {
      // Get current version
      const [version] = await tx
        .select()
        .from(productCodeVersions)
        .where(eq(productCodeVersions.id, item.allocatedVersionId))
        .limit(1);

      if (!version) {
        return; // Version not found, skip
      }

      // Release reserved quantity
      const newReserved = Math.max(0, version.qtyReserved - item.quantity);
      await tx
        .update(productCodeVersions)
        .set({
          qtyReserved: newReserved,
        })
        .where(eq(productCodeVersions.id, version.id));

      // Log release in stock ledger
      await tx.insert(stockLedger).values({
        productCodeVersionId: version.id,
        qtyChange: item.quantity, // Positive change (released back)
        reason: 'return', // Using 'return' reason for cancellation
        refTable: 'ecom_orders',
        refId: ecomOrderId,
      });

      // Clear allocation from order item
      await tx
        .update(ecomOrderItems)
        .set({
          allocatedBranchId: null,
          allocatedVersionId: null,
        })
        .where(eq(ecomOrderItems.id, item.id));
    });
  }
}

/**
 * Get available quantity for a product code
 * @param {number} productCodeId - Product code ID
 * @param {number|null} branchId - Optional branch restriction
 * @returns {Promise<number>} Available quantity
 */
export async function getAvailableQuantity(productCodeId, branchId = null) {
  const conditions = [
    eq(productCodeVersions.productCodeId, productCodeId),
    eq(productCodeVersions.isActive, true),
  ];

  if (branchId) {
    conditions.push(eq(productCodeVersions.branchId, branchId));
  }

  const versions = await db
    .select({
      available: sql<number>`${productCodeVersions.qtyOnHand} - ${productCodeVersions.qtyReserved}`,
    })
    .from(productCodeVersions)
    .where(and(...conditions));

  // Sum available quantities across all versions
  return versions.reduce((sum, v) => sum + (v.available || 0), 0);
}

export default {
  reserveInventoryForOrder,
  releaseInventoryForOrder,
  findAvailableVersion,
  getAvailableQuantity,
};

