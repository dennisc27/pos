/**
 * Return Processing Service
 * Handles return restock logic and refund processing
 */

import { db } from '../../db/connection.js';
import {
  ecomReturns,
  ecomReturnItems,
  ecomOrders,
  ecomOrderItems,
  ecomChannels,
  productCodeVersions,
  stockLedger,
  creditNotes,
  creditNoteLedger,
  customers,
} from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { eBayAdapter } from './ebay-adapter.js';
import { ShopifyAdapter } from './shopify-adapter.js';

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
 * Determine if an item is restockable based on condition
 * @param {string} condition - Item condition
 * @returns {boolean} True if restockable
 */
function isRestockable(condition) {
  if (!condition) return false;
  return condition !== 'not_restockable' && condition !== 'damaged';
}

/**
 * Process return restock logic
 * @param {number} returnId - Return ID
 * @param {Array<{itemId: number, condition: string, restock: boolean}>} items - Return items with conditions
 * @returns {Promise<Object>} Restock results
 */
export async function processReturnRestock(returnId, items) {
  const [returnRecord] = await db
    .select()
    .from(ecomReturns)
    .where(eq(ecomReturns.id, returnId))
    .limit(1);

  if (!returnRecord) {
    throw new Error('Return not found');
  }

  if (returnRecord.status !== 'approved') {
    throw new Error('Return must be approved before receiving');
  }

  const restockedItems = [];
  const errors = [];

  // Process each return item
  for (const itemUpdate of items) {
    try {
      const [returnItem] = await db
        .select()
        .from(ecomReturnItems)
        .where(
          and(
            eq(ecomReturnItems.ecomReturnId, returnId),
            eq(ecomReturnItems.id, itemUpdate.itemId)
          )
        )
        .limit(1);

      if (!returnItem) {
        errors.push({ itemId: itemUpdate.itemId, error: 'Return item not found' });
        continue;
      }

      // Update return item with condition and restock status
      const updateData = {};
      if (itemUpdate.condition !== undefined) {
        updateData.condition = itemUpdate.condition;
      }
      if (itemUpdate.restock !== undefined) {
        updateData.restocked = itemUpdate.restock;
      }

      await db
        .update(ecomReturnItems)
        .set(updateData)
        .where(eq(ecomReturnItems.id, returnItem.id));

      // Check if item should be restocked
      const shouldRestock = itemUpdate.restock && isRestockable(itemUpdate.condition || returnItem.condition);

      if (shouldRestock) {
        // Get order item to find allocated version
        const [orderItem] = await db
          .select()
          .from(ecomOrderItems)
          .where(eq(ecomOrderItems.id, returnItem.ecomOrderItemId))
          .limit(1);

        if (orderItem && orderItem.allocatedVersionId) {
          const restockVersionId = orderItem.allocatedVersionId;

          // Update inventory - add back to qty_on_hand
          await db
            .update(productCodeVersions)
            .set({
              qtyOnHand: sql`${productCodeVersions.qtyOnHand} + ${returnItem.quantity}`,
            })
            .where(eq(productCodeVersions.id, restockVersionId));

          // Create stock ledger entry with reason 'return'
          await db.insert(stockLedger).values({
            productCodeVersionId: restockVersionId,
            qtyChange: returnItem.quantity,
            reason: 'return',
            refTable: 'ecom_returns',
            refId: returnId,
          });

          // Update return item with restock version
          await db
            .update(ecomReturnItems)
            .set({ restockVersionId })
            .where(eq(ecomReturnItems.id, returnItem.id));

          restockedItems.push({
            itemId: returnItem.id,
            versionId: restockVersionId,
            quantity: returnItem.quantity,
          });
        } else {
          errors.push({ itemId: returnItem.id, error: 'Order item not found or not allocated' });
        }
      }
    } catch (error) {
      errors.push({ itemId: itemUpdate.itemId, error: error.message });
    }
  }

  // Update return status to 'received'
  await db
    .update(ecomReturns)
    .set({
      status: 'received',
      restockCondition: items?.[0]?.condition || null,
      updatedAt: new Date(),
    })
    .where(eq(ecomReturns.id, returnId));

  return {
    success: errors.length === 0,
    restockedItems,
    errors,
  };
}

/**
 * Calculate refund amount based on returned items
 * @param {number} returnId - Return ID
 * @returns {Promise<number>} Refund amount in cents
 */
export async function calculateRefundAmount(returnId) {
  const [returnRecord] = await db
    .select()
    .from(ecomReturns)
    .where(eq(ecomReturns.id, returnId))
    .limit(1);

  if (!returnRecord) {
    throw new Error('Return not found');
  }

  // Get return items
  const returnItems = await db
    .select()
    .from(ecomReturnItems)
    .where(eq(ecomReturnItems.ecomReturnId, returnId));

  // Get order
  const [order] = await db
    .select()
    .from(ecomOrders)
    .where(eq(ecomOrders.id, returnRecord.ecomOrderId))
    .limit(1);

  if (!order) {
    throw new Error('Order not found');
  }

  // Calculate refund based on returned items
  let refundAmount = 0;

  for (const returnItem of returnItems) {
    // Get order item to get price
    const [orderItem] = await db
      .select()
      .from(ecomOrderItems)
      .where(eq(ecomOrderItems.id, returnItem.ecomOrderItemId))
      .limit(1);

    if (orderItem) {
      // Calculate item refund: quantity * unit price
      const itemRefund = returnItem.quantity * orderItem.priceCents;
      refundAmount += itemRefund;
    }
  }

  // If no items found, return full order amount
  if (refundAmount === 0) {
    refundAmount = order.totalCents;
  }

  return refundAmount;
}

/**
 * Process refund for a return
 * @param {number} returnId - Return ID
 * @param {number|null} refundCents - Optional refund amount (if null, calculates automatically)
 * @param {string} refundMethod - Refund method ('original', 'store_credit', 'cash', 'check', 'manual')
 * @returns {Promise<Object>} Refund result
 */
export async function processRefund(returnId, refundCents = null, refundMethod = 'original') {
  const [returnRecord] = await db
    .select()
    .from(ecomReturns)
    .where(eq(ecomReturns.id, returnId))
    .limit(1);

  if (!returnRecord) {
    throw new Error('Return not found');
  }

  if (returnRecord.status !== 'received') {
    throw new Error('Return must be received before refunding');
  }

  // Calculate refund amount if not provided
  let refundAmount = refundCents;
  if (!refundAmount) {
    refundAmount = await calculateRefundAmount(returnId);
  }

  // Get order and channel for marketplace sync
  const [order] = await db
    .select()
    .from(ecomOrders)
    .where(eq(ecomOrders.id, returnRecord.ecomOrderId))
    .limit(1);

  if (!order) {
    throw new Error('Order not found');
  }

  const [channel] = await db
    .select()
    .from(ecomChannels)
    .where(eq(ecomChannels.id, order.channelId))
    .limit(1);

  if (!channel) {
    throw new Error('Channel not found');
  }

  let creditNoteId = null;
  let paymentId = null;

  // Process refund based on method
  if (refundMethod === 'store_credit') {
    // Create credit note
    // First, try to find customer from order
    let customerId = null;
    if (order.customerEmail) {
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.email, order.customerEmail))
        .limit(1);
      customerId = customer?.id || null;
    }

    const [creditNote] = await db
      .insert(creditNotes)
      .values({
        customerId,
        balanceCents: refundAmount,
        reason: `Return #${returnId} - ${returnRecord.reason || 'Customer return'}`,
      });

    creditNoteId = creditNote.id;

    // Create credit note ledger entry
    await db.insert(creditNoteLedger).values({
      creditNoteId: creditNote.id,
      deltaCents: refundAmount,
      refTable: 'ecom_returns',
      refId: returnId,
    });
  } else if (refundMethod === 'cash' || refundMethod === 'check') {
    // TODO: Create payment entry for cash/check refund
    // This would require integration with the payments table
    // For now, we'll just log it
    console.log(`Manual refund processed: ${refundAmount} cents via ${refundMethod}`);
  }

  // Sync refund to marketplace if needed
  if (refundMethod === 'original' && channel.status === 'connected') {
    try {
      const adapter = getAdapter(channel);
      
      // Get return items for marketplace refund
      const returnItems = await db
        .select()
        .from(ecomReturnItems)
        .where(eq(ecomReturnItems.ecomReturnId, returnId));

      // Get order items
      const orderItems = await db
        .select()
        .from(ecomOrderItems)
        .where(eq(ecomOrderItems.ecomOrderId, order.id));

      // Map return items to order items
      const refundItems = returnItems.map(returnItem => {
        const orderItem = orderItems.find(oi => oi.id === returnItem.ecomOrderItemId);
        return {
          orderItemId: orderItem?.externalItemId || null,
          quantity: returnItem.quantity,
          amount: orderItem ? orderItem.priceCents * returnItem.quantity : 0,
        };
      });

      // Call marketplace refund API (if available)
      // Note: This depends on adapter implementation
      if (adapter.processRefund) {
        const refundResult = await adapter.processRefund(
          order.externalId,
          refundAmount,
          refundItems
        );

        if (!refundResult.success) {
          console.error('Marketplace refund failed:', refundResult.error);
          // Continue - refund is still processed locally
        }
      }
    } catch (error) {
      console.error('Error syncing refund to marketplace:', error.message);
      // Continue - refund is still processed locally
    }
  }

  // Update return with refund info
  await db
    .update(ecomReturns)
    .set({
      status: 'refunded',
      refundCents: refundAmount,
      refundMethod,
      updatedAt: new Date(),
    })
    .where(eq(ecomReturns.id, returnId));

  return {
    success: true,
    refundAmountCents: refundAmount,
    refundMethod,
    creditNoteId,
    paymentId,
  };
}

export default {
  processReturnRestock,
  calculateRefundAmount,
  processRefund,
  isRestockable,
};

