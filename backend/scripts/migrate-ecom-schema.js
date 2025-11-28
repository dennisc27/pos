/**
 * Migration Script for E-Commerce Schema Updates
 * Adds missing columns and updates existing tables to match ECOMMERCE_IMPLEMENTATION.md
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connectionConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos_system',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  charset: 'utf8mb4',
  multipleStatements: true,
};

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as count 
     FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = ? 
     AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows[0].count > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as count 
     FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = ? 
     AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return rows[0].count > 0;
}

async function migrate() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(connectionConfig);
    console.log('✅ Connected to database\n');

    // ========== ecom_channels ==========
    console.log('📦 Updating ecom_channels...');
    
    if (!(await columnExists(connection, 'ecom_channels', 'branch_id'))) {
      await connection.execute(`
        ALTER TABLE ecom_channels 
        ADD COLUMN branch_id BIGINT NULL,
        ADD FOREIGN KEY (branch_id) REFERENCES branches(id)
      `);
      console.log('  ✅ Added branch_id');
    } else {
      console.log('  ⏭️  branch_id already exists');
    }

    if (!(await columnExists(connection, 'ecom_channels', 'last_sync_at'))) {
      await connection.execute(`
        ALTER TABLE ecom_channels 
        ADD COLUMN last_sync_at TIMESTAMP NULL
      `);
      console.log('  ✅ Added last_sync_at');
    } else {
      console.log('  ⏭️  last_sync_at already exists');
    }

    // ========== ecom_channel_logs ==========
    console.log('\n📦 Updating ecom_channel_logs...');
    
    // Check if table needs restructuring (has 'event' column = old structure)
    const hasEventColumn = await columnExists(connection, 'ecom_channel_logs', 'event');
    
    if (hasEventColumn && !(await columnExists(connection, 'ecom_channel_logs', 'operation'))) {
      // Migrate from old structure to new structure
      await connection.execute(`
        ALTER TABLE ecom_channel_logs
        ADD COLUMN operation ENUM('sync_listings','sync_orders','sync_inventory','webhook') NOT NULL DEFAULT 'webhook' AFTER channel_id,
        ADD COLUMN status ENUM('success','error','partial') NOT NULL DEFAULT 'success' AFTER operation,
        ADD COLUMN records_processed INT DEFAULT 0 AFTER status,
        ADD COLUMN records_failed INT DEFAULT 0 AFTER records_processed,
        ADD COLUMN error_message TEXT AFTER records_failed,
        ADD COLUMN metadata JSON AFTER error_message,
        ADD COLUMN started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER metadata,
        ADD COLUMN completed_at TIMESTAMP NULL AFTER started_at
      `);
      
      // Migrate existing data
      await connection.execute(`
        UPDATE ecom_channel_logs 
        SET operation = 'webhook', 
            status = 'success',
            started_at = created_at,
            completed_at = created_at
        WHERE operation = 'webhook'
      `);
      
      // Drop old columns after migration
      await connection.execute(`
        ALTER TABLE ecom_channel_logs
        DROP COLUMN event,
        DROP COLUMN payload,
        DROP COLUMN created_at
      `);
      
      console.log('  ✅ Restructured table (migrated from event/payload to operation/status)');
    } else if (!hasEventColumn) {
      // New structure - just add missing columns
      if (!(await columnExists(connection, 'ecom_channel_logs', 'operation'))) {
        await connection.execute(`
          ALTER TABLE ecom_channel_logs
          ADD COLUMN operation ENUM('sync_listings','sync_orders','sync_inventory','webhook') NOT NULL AFTER channel_id
        `);
        console.log('  ✅ Added operation');
      }
      
      if (!(await columnExists(connection, 'ecom_channel_logs', 'status'))) {
        await connection.execute(`
          ALTER TABLE ecom_channel_logs
          ADD COLUMN status ENUM('success','error','partial') NOT NULL AFTER operation
        `);
        console.log('  ✅ Added status');
      }
      
      // Add other missing columns
      const missingColumns = [
        { name: 'records_processed', type: 'INT DEFAULT 0' },
        { name: 'records_failed', type: 'INT DEFAULT 0' },
        { name: 'error_message', type: 'TEXT' },
        { name: 'metadata', type: 'JSON' },
        { name: 'started_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
        { name: 'completed_at', type: 'TIMESTAMP NULL' },
      ];
      
      for (const col of missingColumns) {
        if (!(await columnExists(connection, 'ecom_channel_logs', col.name))) {
          await connection.execute(`
            ALTER TABLE ecom_channel_logs
            ADD COLUMN ${col.name} ${col.type}
          `);
          console.log(`  ✅ Added ${col.name}`);
        }
      }
    }

    // Add index
    if (!(await indexExists(connection, 'ecom_channel_logs', 'idx_channel_operation'))) {
      await connection.execute(`
        CREATE INDEX idx_channel_operation ON ecom_channel_logs(channel_id, operation, started_at)
      `);
      console.log('  ✅ Added idx_channel_operation index');
    }

    // ========== ecom_webhook_logs ==========
    console.log('\n📦 Updating ecom_webhook_logs...');
    
    // Rename event to event_type if needed
    if (await columnExists(connection, 'ecom_webhook_logs', 'event') && 
        !(await columnExists(connection, 'ecom_webhook_logs', 'event_type'))) {
      await connection.execute(`
        ALTER TABLE ecom_webhook_logs
        CHANGE COLUMN event event_type VARCHAR(60) NOT NULL
      `);
      console.log('  ✅ Renamed event to event_type');
    }
    
    // Rename received_at to created_at if needed
    if (await columnExists(connection, 'ecom_webhook_logs', 'received_at') && 
        !(await columnExists(connection, 'ecom_webhook_logs', 'created_at'))) {
      await connection.execute(`
        ALTER TABLE ecom_webhook_logs
        CHANGE COLUMN received_at created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('  ✅ Renamed received_at to created_at');
    }
    
    // Add missing columns
    if (!(await columnExists(connection, 'ecom_webhook_logs', 'processed'))) {
      await connection.execute(`
        ALTER TABLE ecom_webhook_logs
        ADD COLUMN processed BOOLEAN DEFAULT FALSE
      `);
      console.log('  ✅ Added processed');
    }
    
    if (!(await columnExists(connection, 'ecom_webhook_logs', 'error_message'))) {
      await connection.execute(`
        ALTER TABLE ecom_webhook_logs
        ADD COLUMN error_message TEXT
      `);
      console.log('  ✅ Added error_message');
    }
    
    // Make payload NOT NULL if it isn't
    await connection.execute(`
      ALTER TABLE ecom_webhook_logs
      MODIFY COLUMN payload JSON NOT NULL
    `);
    console.log('  ✅ Ensured payload is NOT NULL');
    
    // Add index
    if (!(await indexExists(connection, 'ecom_webhook_logs', 'idx_processed'))) {
      await connection.execute(`
        CREATE INDEX idx_processed ON ecom_webhook_logs(processed, created_at)
      `);
      console.log('  ✅ Added idx_processed index');
    }

    // ========== ecom_listings ==========
    console.log('\n📦 Updating ecom_listings...');
    
    // Add channel_id as nullable first (to handle existing data)
    if (!(await columnExists(connection, 'ecom_listings', 'channel_id'))) {
      // Check if there are existing listings
      const [existingListings] = await connection.execute(`
        SELECT COUNT(*) as count FROM ecom_listings
      `);
      
      if (existingListings[0].count > 0) {
        // Create a default "Unassigned" channel for existing listings
        const [defaultChannel] = await connection.execute(`
          SELECT id FROM ecom_channels WHERE name = 'Unassigned' LIMIT 1
        `);
        
        let defaultChannelId;
        if (defaultChannel.length === 0) {
          const [result] = await connection.execute(`
            INSERT INTO ecom_channels (name, provider, status, config)
            VALUES ('Unassigned', 'custom', 'disconnected', '{}')
          `);
          defaultChannelId = result.insertId;
          console.log('  ✅ Created default "Unassigned" channel for existing listings');
        } else {
          defaultChannelId = defaultChannel[0].id;
        }
        
        // Add column as nullable first
        await connection.execute(`
          ALTER TABLE ecom_listings
          ADD COLUMN channel_id BIGINT NULL AFTER product_code_id
        `);
        console.log('  ✅ Added channel_id (nullable)');
        
        // Update existing listings to point to default channel
        await connection.execute(`
          UPDATE ecom_listings
          SET channel_id = ?
          WHERE channel_id IS NULL
        `, [defaultChannelId]);
        console.log(`  ✅ Assigned ${existingListings[0].count} existing listings to default channel`);
        
        // Now make it NOT NULL
        await connection.execute(`
          ALTER TABLE ecom_listings
          MODIFY COLUMN channel_id BIGINT NOT NULL
        `);
        console.log('  ✅ Made channel_id NOT NULL');
        
        // Add foreign key
        try {
          await connection.execute(`
            ALTER TABLE ecom_listings
            ADD FOREIGN KEY (channel_id) REFERENCES ecom_channels(id)
          `);
          console.log('  ✅ Added foreign key for channel_id');
        } catch (err) {
          if (!err.message.includes('Duplicate foreign key')) {
            throw err;
          }
        }
      } else {
        // No existing data, can add as NOT NULL directly
        await connection.execute(`
          ALTER TABLE ecom_listings
          ADD COLUMN channel_id BIGINT NOT NULL AFTER product_code_id,
          ADD FOREIGN KEY (channel_id) REFERENCES ecom_channels(id)
        `);
        console.log('  ✅ Added channel_id with foreign key');
      }
    } else {
      console.log('  ⏭️  channel_id already exists');
    }
    
    // Add other missing columns
    const listingColumns = [
      { name: 'external_id', type: 'VARCHAR(160)', after: 'channel_id' },
      { name: 'sync_status', type: "ENUM('pending','synced','error') DEFAULT 'pending'", after: 'status' },
      { name: 'last_synced_at', type: 'TIMESTAMP NULL', after: 'sync_status' },
      { name: 'sync_error', type: 'TEXT', after: 'last_synced_at' },
      { name: 'seo_slug', type: 'VARCHAR(200)', after: 'description' },
      { name: 'meta_description', type: 'TEXT', after: 'seo_slug' },
      { name: 'primary_image_url', type: 'VARCHAR(500)', after: 'meta_description' },
      { name: 'image_urls', type: 'JSON', after: 'primary_image_url' },
      { name: 'category_mapping', type: 'JSON', after: 'image_urls' },
      { name: 'attributes', type: 'JSON', after: 'category_mapping' },
    ];
    
    for (const col of listingColumns) {
      if (!(await columnExists(connection, 'ecom_listings', col.name))) {
        await connection.execute(`
          ALTER TABLE ecom_listings
          ADD COLUMN ${col.name} ${col.type} ${col.after ? `AFTER ${col.after}` : ''}
        `);
        console.log(`  ✅ Added ${col.name}`);
      }
    }
    
    // Update status enum to include 'archived'
    await connection.execute(`
      ALTER TABLE ecom_listings
      MODIFY COLUMN status ENUM('draft','active','inactive','archived') DEFAULT 'draft'
    `);
    console.log('  ✅ Updated status enum to include archived');
    
    // Make price_cents nullable
    await connection.execute(`
      ALTER TABLE ecom_listings
      MODIFY COLUMN price_cents BIGINT NULL
    `);
    console.log('  ✅ Made price_cents nullable');
    
    // Add unique constraint
    try {
      await connection.execute(`
        ALTER TABLE ecom_listings
        ADD UNIQUE KEY uniq_listing (product_code_id, channel_id)
      `);
      console.log('  ✅ Added unique constraint uniq_listing');
    } catch (err) {
      if (!err.message.includes('Duplicate key name')) {
        throw err;
      }
      console.log('  ⏭️  Unique constraint uniq_listing already exists');
    }
    
    // Add indexes
    if (!(await indexExists(connection, 'ecom_listings', 'idx_external_id'))) {
      await connection.execute(`
        CREATE INDEX idx_external_id ON ecom_listings(external_id)
      `);
      console.log('  ✅ Added idx_external_id index');
    }
    
    if (!(await indexExists(connection, 'ecom_listings', 'idx_status'))) {
      await connection.execute(`
        CREATE INDEX idx_status ON ecom_listings(status, sync_status)
      `);
      console.log('  ✅ Added idx_status index');
    }

    // ========== ecom_orders ==========
    console.log('\n📦 Updating ecom_orders...');
    
    // Add missing columns
    const orderColumns = [
      { name: 'customer_email', type: 'VARCHAR(255)' },
      { name: 'payment_status', type: "ENUM('unpaid','partial','paid','refunded') DEFAULT 'unpaid'" },
      { name: 'billing_address', type: 'JSON' },
      { name: 'subtotal_cents', type: 'BIGINT NOT NULL DEFAULT 0' },
      { name: 'tax_cents', type: 'BIGINT DEFAULT 0' },
      { name: 'shipping_cents', type: 'BIGINT DEFAULT 0' },
      { name: 'internal_order_id', type: 'BIGINT NULL', fk: 'FOREIGN KEY (internal_order_id) REFERENCES orders(id)' },
      { name: 'tracking_number', type: 'VARCHAR(120)' },
      { name: 'shipping_carrier', type: 'VARCHAR(60)' },
      { name: 'fulfillment_status', type: "ENUM('unfulfilled','picking','packed','shipped') DEFAULT 'unfulfilled'" },
    ];
    
    for (const col of orderColumns) {
      if (!(await columnExists(connection, 'ecom_orders', col.name))) {
        await connection.execute(`
          ALTER TABLE ecom_orders
          ADD COLUMN ${col.name} ${col.type}
        `);
        console.log(`  ✅ Added ${col.name}`);
        
        // Add foreign key if specified
        if (col.fk && col.name === 'internal_order_id') {
          try {
            await connection.execute(`ALTER TABLE ecom_orders ADD ${col.fk}`);
            console.log(`  ✅ Added foreign key for ${col.name}`);
          } catch (err) {
            if (!err.message.includes('Duplicate foreign key')) {
              throw err;
            }
          }
        }
      }
    }
    
    // Update status enum to include 'refunded'
    await connection.execute(`
      ALTER TABLE ecom_orders
      MODIFY COLUMN status ENUM('pending','paid','fulfilled','cancelled','refunded') DEFAULT 'pending'
    `);
    console.log('  ✅ Updated status enum to include refunded');
    
    // Set default values for existing rows
    await connection.execute(`
      UPDATE ecom_orders
      SET subtotal_cents = total_cents,
          tax_cents = 0,
          shipping_cents = 0,
          payment_status = CASE 
            WHEN status = 'paid' OR status = 'fulfilled' THEN 'paid'
            ELSE 'unpaid'
          END,
          fulfillment_status = CASE
            WHEN status = 'fulfilled' THEN 'shipped'
            ELSE 'unfulfilled'
          END
      WHERE subtotal_cents = 0 OR subtotal_cents IS NULL
    `);
    console.log('  ✅ Set default values for existing orders');
    
    // Add unique constraint
    try {
      await connection.execute(`
        ALTER TABLE ecom_orders
        ADD UNIQUE KEY uniq_external_order (channel_id, external_id)
      `);
      console.log('  ✅ Added unique constraint uniq_external_order');
    } catch (err) {
      if (!err.message.includes('Duplicate key name')) {
        throw err;
      }
      console.log('  ⏭️  Unique constraint uniq_external_order already exists');
    }
    
    // Add indexes
    if (!(await indexExists(connection, 'ecom_orders', 'idx_status'))) {
      await connection.execute(`
        CREATE INDEX idx_status ON ecom_orders(status, fulfillment_status)
      `);
      console.log('  ✅ Added idx_status index');
    }
    
    if (!(await indexExists(connection, 'ecom_orders', 'idx_created_at'))) {
      await connection.execute(`
        CREATE INDEX idx_created_at ON ecom_orders(created_at)
      `);
      console.log('  ✅ Added idx_created_at index');
    }

    // ========== ecom_order_items ==========
    console.log('\n📦 Updating ecom_order_items...');
    
    // Rename order_id to ecom_order_id if needed
    if (await columnExists(connection, 'ecom_order_items', 'order_id') && 
        !(await columnExists(connection, 'ecom_order_items', 'ecom_order_id'))) {
      await connection.execute(`
        ALTER TABLE ecom_order_items
        CHANGE COLUMN order_id ecom_order_id BIGINT NOT NULL
      `);
      console.log('  ✅ Renamed order_id to ecom_order_id');
      
      // Update foreign key
      try {
        await connection.execute(`
          ALTER TABLE ecom_order_items
          DROP FOREIGN KEY ecom_order_items_ibfk_1
        `);
      } catch (err) {
        // Foreign key might have different name, try to find it
        const [fks] = await connection.execute(`
          SELECT CONSTRAINT_NAME 
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'ecom_order_items' 
          AND COLUMN_NAME = 'ecom_order_id'
          AND REFERENCED_TABLE_NAME = 'ecom_orders'
        `);
        if (fks.length > 0) {
          await connection.execute(`
            ALTER TABLE ecom_order_items
            DROP FOREIGN KEY ${fks[0].CONSTRAINT_NAME}
          `);
        }
      }
      
      await connection.execute(`
        ALTER TABLE ecom_order_items
        ADD FOREIGN KEY (ecom_order_id) REFERENCES ecom_orders(id) ON DELETE CASCADE
      `);
      console.log('  ✅ Updated foreign key');
    }
    
    // Add missing columns
    const orderItemColumns = [
      { name: 'external_item_id', type: 'VARCHAR(160)' },
      { name: 'sku', type: 'VARCHAR(64)' },
      { name: 'title', type: 'VARCHAR(240)' },
      { name: 'allocated_branch_id', type: 'BIGINT NULL', fk: 'FOREIGN KEY (allocated_branch_id) REFERENCES branches(id)' },
      { name: 'allocated_version_id', type: 'BIGINT NULL', fk: 'FOREIGN KEY (allocated_version_id) REFERENCES product_code_versions(id)' },
    ];
    
    for (const col of orderItemColumns) {
      if (!(await columnExists(connection, 'ecom_order_items', col.name))) {
        await connection.execute(`
          ALTER TABLE ecom_order_items
          ADD COLUMN ${col.name} ${col.type}
        `);
        console.log(`  ✅ Added ${col.name}`);
        
        // Add foreign key if specified
        if (col.fk) {
          try {
            await connection.execute(`ALTER TABLE ecom_order_items ADD ${col.fk}`);
            console.log(`  ✅ Added foreign key for ${col.name}`);
          } catch (err) {
            if (!err.message.includes('Duplicate foreign key')) {
              throw err;
            }
          }
        }
      }
    }

    // ========== ecom_returns ==========
    console.log('\n📦 Updating ecom_returns...');
    
    // Rename order_id to ecom_order_id if needed
    if (await columnExists(connection, 'ecom_returns', 'order_id') && 
        !(await columnExists(connection, 'ecom_returns', 'ecom_order_id'))) {
      await connection.execute(`
        ALTER TABLE ecom_returns
        CHANGE COLUMN order_id ecom_order_id BIGINT NOT NULL
      `);
      console.log('  ✅ Renamed order_id to ecom_order_id');
    }
    
    // Add missing columns
    const returnColumns = [
      { name: 'external_rma_id', type: 'VARCHAR(160)' },
      { name: 'refund_method', type: "ENUM('original','store_credit','manual') DEFAULT 'original'" },
      { name: 'refund_cents', type: 'BIGINT' },
      { name: 'restock_condition', type: "ENUM('new','used','damaged','not_restockable') NULL" },
    ];
    
    for (const col of returnColumns) {
      if (!(await columnExists(connection, 'ecom_returns', col.name))) {
        await connection.execute(`
          ALTER TABLE ecom_returns
          ADD COLUMN ${col.name} ${col.type}
        `);
        console.log(`  ✅ Added ${col.name}`);
      }
    }
    
    // Update status enum order
    await connection.execute(`
      ALTER TABLE ecom_returns
      MODIFY COLUMN status ENUM('requested','approved','denied','received','refunded') DEFAULT 'requested'
    `);
    console.log('  ✅ Updated status enum order');
    
    // Add index
    if (!(await indexExists(connection, 'ecom_returns', 'idx_status'))) {
      await connection.execute(`
        CREATE INDEX idx_status ON ecom_returns(status)
      `);
      console.log('  ✅ Added idx_status index');
    }

    // ========== ecom_return_items ==========
    console.log('\n📦 Updating ecom_return_items...');
    
    // Rename columns if needed
    if (await columnExists(connection, 'ecom_return_items', 'return_id') && 
        !(await columnExists(connection, 'ecom_return_items', 'ecom_return_id'))) {
      await connection.execute(`
        ALTER TABLE ecom_return_items
        CHANGE COLUMN return_id ecom_return_id BIGINT NOT NULL
      `);
      console.log('  ✅ Renamed return_id to ecom_return_id');
      
      // Update foreign key
      try {
        await connection.execute(`
          ALTER TABLE ecom_return_items
          DROP FOREIGN KEY ecom_return_items_ibfk_1
        `);
      } catch (err) {
        // Try to find actual FK name
        const [fks] = await connection.execute(`
          SELECT CONSTRAINT_NAME 
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'ecom_return_items' 
          AND COLUMN_NAME = 'ecom_return_id'
          AND REFERENCED_TABLE_NAME = 'ecom_returns'
        `);
        if (fks.length > 0) {
          await connection.execute(`
            ALTER TABLE ecom_return_items
            DROP FOREIGN KEY ${fks[0].CONSTRAINT_NAME}
          `);
        }
      }
      
      await connection.execute(`
        ALTER TABLE ecom_return_items
        ADD FOREIGN KEY (ecom_return_id) REFERENCES ecom_returns(id) ON DELETE CASCADE
      `);
      console.log('  ✅ Updated foreign key');
    }
    
    if (await columnExists(connection, 'ecom_return_items', 'order_item_id') && 
        !(await columnExists(connection, 'ecom_return_items', 'ecom_order_item_id'))) {
      await connection.execute(`
        ALTER TABLE ecom_return_items
        CHANGE COLUMN order_item_id ecom_order_item_id BIGINT NOT NULL
      `);
      console.log('  ✅ Renamed order_item_id to ecom_order_item_id');
    }
    
    // Add missing columns
    if (!(await columnExists(connection, 'ecom_return_items', 'quantity'))) {
      await connection.execute(`
        ALTER TABLE ecom_return_items
        ADD COLUMN quantity INT NOT NULL DEFAULT 1 AFTER ecom_order_item_id
      `);
      console.log('  ✅ Added quantity');
    }
    
    if (!(await columnExists(connection, 'ecom_return_items', 'restock_version_id'))) {
      await connection.execute(`
        ALTER TABLE ecom_return_items
        ADD COLUMN restock_version_id BIGINT NULL,
        ADD FOREIGN KEY (restock_version_id) REFERENCES product_code_versions(id)
      `);
      console.log('  ✅ Added restock_version_id');
    }
    
    // Update condition enum to include 'not_restockable' and make nullable
    await connection.execute(`
      ALTER TABLE ecom_return_items
      MODIFY COLUMN \`condition\` ENUM('new','used','damaged','not_restockable') NULL
    `);
    console.log('  ✅ Updated condition enum to include not_restockable and made nullable');
    
    // Rename restock to restocked if needed
    if (await columnExists(connection, 'ecom_return_items', 'restock') && 
        !(await columnExists(connection, 'ecom_return_items', 'restocked'))) {
      await connection.execute(`
        ALTER TABLE ecom_return_items
        CHANGE COLUMN restock restocked BOOLEAN DEFAULT FALSE
      `);
      console.log('  ✅ Renamed restock to restocked and changed default to FALSE');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('  - All missing columns have been added');
    console.log('  - Column renames have been applied');
    console.log('  - Indexes have been created');
    console.log('  - Foreign keys have been updated');
    console.log('  - Default values have been set for existing data');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

migrate();

