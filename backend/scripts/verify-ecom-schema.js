/**
 * Schema Verification Script for E-Commerce Tables
 * Compares current schema.sql with ECOMMERCE_IMPLEMENTATION.md requirements
 */

import { db } from '../src/db/connection.js';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function verifySchema() {
  console.log('🔍 Verifying E-Commerce Schema...\n');
  
  const issues = [];
  const verified = [];

  try {
    // 1. Verify ecom_channels
    console.log('1. Checking ecom_channels...');
    const channelsColumns = await db.execute(sql`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ecom_channels'
      ORDER BY ORDINAL_POSITION
    `);

    const channelsColNames = channelsColumns[0].map(col => col.COLUMN_NAME);
    
    if (!channelsColNames.includes('branch_id')) {
      issues.push('❌ ecom_channels: Missing branch_id column');
    } else {
      verified.push('✅ ecom_channels: branch_id exists');
    }

    if (!channelsColNames.includes('last_sync_at')) {
      issues.push('❌ ecom_channels: Missing last_sync_at column');
    } else {
      verified.push('✅ ecom_channels: last_sync_at exists');
    }

    // 2. Verify ecom_listings
    console.log('2. Checking ecom_listings...');
    const listingsColumns = await db.execute(sql`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ecom_listings'
      ORDER BY ORDINAL_POSITION
    `);

    const listingsColNames = listingsColumns[0].map(col => col.COLUMN_NAME);
    const requiredListingsFields = [
      'channel_id', 'external_id', 'sync_status', 'last_synced_at',
      'sync_error', 'seo_slug', 'meta_description', 'primary_image_url',
      'image_urls', 'category_mapping', 'attributes'
    ];

    requiredListingsFields.forEach(field => {
      if (!listingsColNames.includes(field)) {
        issues.push(`❌ ecom_listings: Missing ${field} column`);
      } else {
        verified.push(`✅ ecom_listings: ${field} exists`);
      }
    });

    // Check if price_cents is nullable
    const priceCentsCol = listingsColumns[0].find(col => col.COLUMN_NAME === 'price_cents');
    if (priceCentsCol && priceCentsCol.IS_NULLABLE === 'NO') {
      issues.push('❌ ecom_listings: price_cents should be nullable (NULL = use product_code_version price)');
    } else if (priceCentsCol) {
      verified.push('✅ ecom_listings: price_cents is nullable');
    }

    // 3. Verify ecom_orders
    console.log('3. Checking ecom_orders...');
    const ordersColumns = await db.execute(sql`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ecom_orders'
      ORDER BY ORDINAL_POSITION
    `);

    const ordersColNames = ordersColumns[0].map(col => col.COLUMN_NAME);
    const requiredOrdersFields = [
      'customer_email', 'payment_status', 'billing_address',
      'subtotal_cents', 'tax_cents', 'shipping_cents',
      'internal_order_id', 'tracking_number', 'shipping_carrier',
      'fulfillment_status'
    ];

    requiredOrdersFields.forEach(field => {
      if (!ordersColNames.includes(field)) {
        issues.push(`❌ ecom_orders: Missing ${field} column`);
      } else {
        verified.push(`✅ ecom_orders: ${field} exists`);
      }
    });

    // 4. Verify ecom_order_items
    console.log('4. Checking ecom_order_items...');
    const orderItemsColumns = await db.execute(sql`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ecom_order_items'
      ORDER BY ORDINAL_POSITION
    `);

    const orderItemsColNames = orderItemsColumns[0].map(col => col.COLUMN_NAME);
    const requiredOrderItemsFields = [
      'external_item_id', 'sku', 'title',
      'allocated_branch_id', 'allocated_version_id'
    ];

    requiredOrderItemsFields.forEach(field => {
      if (!orderItemsColNames.includes(field)) {
        issues.push(`❌ ecom_order_items: Missing ${field} column`);
      } else {
        verified.push(`✅ ecom_order_items: ${field} exists`);
      }
    });

    // 5. Verify ecom_returns
    console.log('5. Checking ecom_returns...');
    const returnsColumns = await db.execute(sql`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ecom_returns'
      ORDER BY ORDINAL_POSITION
    `);

    const returnsColNames = returnsColumns[0].map(col => col.COLUMN_NAME);
    const requiredReturnsFields = [
      'external_rma_id', 'refund_method', 'refund_cents', 'restock_condition'
    ];

    requiredReturnsFields.forEach(field => {
      if (!returnsColNames.includes(field)) {
        issues.push(`❌ ecom_returns: Missing ${field} column`);
      } else {
        verified.push(`✅ ecom_returns: ${field} exists`);
      }
    });

    // 6. Verify ecom_return_items
    console.log('6. Checking ecom_return_items...');
    const returnItemsColumns = await db.execute(sql`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ecom_return_items'
      ORDER BY ORDINAL_POSITION
    `);

    const returnItemsColNames = returnItemsColumns[0].map(col => col.COLUMN_NAME);
    
    if (!returnItemsColNames.includes('restock_version_id')) {
      issues.push('❌ ecom_return_items: Missing restock_version_id column');
    } else {
      verified.push('✅ ecom_return_items: restock_version_id exists');
    }

    if (!returnItemsColNames.includes('restocked')) {
      issues.push('❌ ecom_return_items: Missing restocked boolean column');
    } else {
      verified.push('✅ ecom_return_items: restocked exists');
    }

    // Check condition enum includes 'not_restockable'
    const conditionCol = returnItemsColumns[0].find(col => col.COLUMN_NAME === 'condition');
    if (conditionCol && !conditionCol.COLUMN_TYPE.includes('not_restockable')) {
      issues.push('❌ ecom_return_items: condition enum missing "not_restockable" value');
    } else if (conditionCol) {
      verified.push('✅ ecom_return_items: condition enum includes "not_restockable"');
    }

    // 7. Verify ecom_channel_logs
    console.log('7. Checking ecom_channel_logs...');
    const channelLogsColumns = await db.execute(sql`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ecom_channel_logs'
      ORDER BY ORDINAL_POSITION
    `);

    const channelLogsColNames = channelLogsColumns[0].map(col => col.COLUMN_NAME);
    const requiredChannelLogsFields = [
      'operation', 'status', 'records_processed', 'records_failed',
      'error_message', 'metadata', 'started_at', 'completed_at'
    ];

    requiredChannelLogsFields.forEach(field => {
      if (!channelLogsColNames.includes(field)) {
        issues.push(`❌ ecom_channel_logs: Missing ${field} column`);
      } else {
        verified.push(`✅ ecom_channel_logs: ${field} exists`);
      }
    });

    // 8. Verify ecom_webhook_logs
    console.log('8. Checking ecom_webhook_logs...');
    const webhookLogsColumns = await db.execute(sql`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ecom_webhook_logs'
      ORDER BY ORDINAL_POSITION
    `);

    const webhookLogsColNames = webhookLogsColumns[0].map(col => col.COLUMN_NAME);
    
    if (!webhookLogsColNames.includes('processed')) {
      issues.push('❌ ecom_webhook_logs: Missing processed boolean column');
    } else {
      verified.push('✅ ecom_webhook_logs: processed exists');
    }

    if (!webhookLogsColNames.includes('error_message')) {
      issues.push('❌ ecom_webhook_logs: Missing error_message column');
    } else {
      verified.push('✅ ecom_webhook_logs: error_message exists');
    }

    if (!webhookLogsColNames.includes('event_type') && !webhookLogsColNames.includes('event')) {
      issues.push('❌ ecom_webhook_logs: Missing event_type or event column');
    } else {
      verified.push('✅ ecom_webhook_logs: event/event_type exists');
    }

    // 9. Check indexes
    console.log('9. Checking indexes...');
    const indexes = await db.execute(sql`
      SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME LIKE 'ecom_%'
      ORDER BY TABLE_NAME, INDEX_NAME
    `);

    const indexMap = {};
    indexes[0].forEach(idx => {
      if (!indexMap[idx.TABLE_NAME]) {
        indexMap[idx.TABLE_NAME] = {};
      }
      if (!indexMap[idx.TABLE_NAME][idx.INDEX_NAME]) {
        indexMap[idx.TABLE_NAME][idx.INDEX_NAME] = [];
      }
      indexMap[idx.TABLE_NAME][idx.INDEX_NAME].push(idx.COLUMN_NAME);
    });

    // Check for required indexes
    if (!indexMap['ecom_listings'] || !indexMap['ecom_listings']['idx_external_id']) {
      issues.push('❌ ecom_listings: Missing idx_external_id index');
    } else {
      verified.push('✅ ecom_listings: idx_external_id index exists');
    }

    if (!indexMap['ecom_orders'] || !indexMap['ecom_orders']['idx_status']) {
      issues.push('❌ ecom_orders: Missing idx_status index');
    } else {
      verified.push('✅ ecom_orders: idx_status index exists');
    }

    if (!indexMap['ecom_orders'] || !indexMap['ecom_orders']['idx_created_at']) {
      issues.push('❌ ecom_orders: Missing idx_created_at index');
    } else {
      verified.push('✅ ecom_orders: idx_created_at index exists');
    }

    // Print results
    console.log('\n📊 Verification Results:\n');
    console.log('✅ Verified Fields:');
    verified.forEach(v => console.log(`  ${v}`));
    
    if (issues.length > 0) {
      console.log('\n❌ Issues Found:');
      issues.forEach(issue => console.log(`  ${issue}`));
      console.log(`\n⚠️  Total issues: ${issues.length}`);
      process.exit(1);
    } else {
      console.log('\n✅ All schema verifications passed!');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Error during verification:', error);
    process.exit(1);
  }
}

verifySchema();

