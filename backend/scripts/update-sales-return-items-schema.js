import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'pos_system',
  });

  try {
    console.log('Updating sales_return_items table schema...');
    
    // Helper function to check if column exists
    async function columnExists(table, column) {
      const [rows] = await connection.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [process.env.DB_NAME || 'pos_system', table, column]
      );
      return rows[0].count > 0;
    }

    // Helper function to add column if it doesn't exist
    async function addColumnIfNotExists(table, column, definition) {
      const exists = await columnExists(table, column);
      if (exists) {
        console.log(`ℹ️  Column ${table}.${column} already exists`);
        return false;
      }
      try {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`✅ Added column ${table}.${column}`);
        return true;
      } catch (error) {
        console.error(`❌ Failed to add column ${table}.${column}:`, error.message);
        throw error;
      }
    }

    // Helper function to drop column if it exists
    async function dropColumnIfExists(table, column) {
      const exists = await columnExists(table, column);
      if (!exists) {
        console.log(`ℹ️  Column ${table}.${column} does not exist`);
        return false;
      }
      try {
        await connection.query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
        console.log(`✅ Dropped column ${table}.${column}`);
        return true;
      } catch (error) {
        console.error(`❌ Failed to drop column ${table}.${column}:`, error.message);
        throw error;
      }
    }

    // Helper function to add foreign key if it doesn't exist
    async function addForeignKeyIfNotExists(table, constraintName, definition) {
      try {
        const [rows] = await connection.query(
          `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
          [process.env.DB_NAME || 'pos_system', table, constraintName]
        );
        
        if (rows[0].count > 0) {
          console.log(`ℹ️  Foreign key ${constraintName} already exists`);
          return;
        }
        
        await connection.query(`ALTER TABLE ${table} ADD CONSTRAINT ${constraintName} ${definition}`);
        console.log(`✅ Added foreign key ${constraintName}`);
      } catch (error) {
        console.error(`❌ Failed to add foreign key ${constraintName}:`, error.message);
        throw error;
      }
    }

    // Drop old foreign key constraint on code_id if it exists
    try {
      await connection.query('ALTER TABLE sales_return_items DROP FOREIGN KEY sales_return_items_ibfk_2');
      console.log('✅ Dropped old foreign key on code_id');
    } catch (error) {
      // Foreign key might have a different name or not exist
      console.log('ℹ️  Old foreign key on code_id not found or already removed');
    }

    // Add new columns first (before dropping old ones to preserve data if possible)
    await addColumnIfNotExists('sales_return_items', 'order_item_id', 'BIGINT NULL');
    await addColumnIfNotExists('sales_return_items', 'product_code_version_id', 'BIGINT NULL');
    await addColumnIfNotExists('sales_return_items', 'unit_price_cents', 'BIGINT NULL');
    await addColumnIfNotExists('sales_return_items', 'tax_cents', 'BIGINT DEFAULT 0');
    await addColumnIfNotExists('sales_return_items', 'restock', 'BOOLEAN DEFAULT TRUE');
    await addColumnIfNotExists('sales_return_items', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

    // Try to populate new columns from existing data
    console.log('Attempting to populate new columns from existing data...');
    
    // Try to find order_item_id and product_code_version_id from related data
    // This is complex, so we'll set defaults and let the application handle it
    // For existing data, we'll need to make these nullable initially
    
    // Set unit_price_cents from refund_cents if it exists
    const refundCentsExists = await columnExists('sales_return_items', 'refund_cents');
    if (refundCentsExists) {
      await connection.query(`
        UPDATE sales_return_items 
        SET unit_price_cents = refund_cents 
        WHERE unit_price_cents IS NULL AND refund_cents IS NOT NULL
      `);
      console.log('✅ Populated unit_price_cents from refund_cents');
    }

    // Set default values
    await connection.query(`
      UPDATE sales_return_items 
      SET 
        tax_cents = 0 
      WHERE tax_cents IS NULL
    `);
    
    await connection.query(`
      UPDATE sales_return_items 
      SET 
        restock = TRUE 
      WHERE restock IS NULL
    `);

    // Now make required columns NOT NULL (but only if we can populate them)
    console.log('Making required columns NOT NULL...');
    
    // Check if there are any NULLs before making NOT NULL
    const [orderItemIdCheck] = await connection.query(
      'SELECT COUNT(*) as count FROM sales_return_items WHERE order_item_id IS NULL'
    );
    if (orderItemIdCheck[0].count > 0) {
      console.warn(`⚠️  Warning: ${orderItemIdCheck[0].count} rows have NULL order_item_id. These need to be fixed manually.`);
      console.log('⚠️  Keeping order_item_id nullable for now. You may need to populate it manually.');
    } else {
      await connection.query('ALTER TABLE sales_return_items MODIFY COLUMN order_item_id BIGINT NOT NULL');
      console.log('✅ Made order_item_id NOT NULL');
    }

    const [productCodeVersionIdCheck] = await connection.query(
      'SELECT COUNT(*) as count FROM sales_return_items WHERE product_code_version_id IS NULL'
    );
    if (productCodeVersionIdCheck[0].count > 0) {
      console.warn(`⚠️  Warning: ${productCodeVersionIdCheck[0].count} rows have NULL product_code_version_id. These need to be fixed manually.`);
      console.log('⚠️  Keeping product_code_version_id nullable for now. You may need to populate it manually.');
    } else {
      await connection.query('ALTER TABLE sales_return_items MODIFY COLUMN product_code_version_id BIGINT NOT NULL');
      console.log('✅ Made product_code_version_id NOT NULL');
    }

    const [unitPriceCentsCheck] = await connection.query(
      'SELECT COUNT(*) as count FROM sales_return_items WHERE unit_price_cents IS NULL'
    );
    if (unitPriceCentsCheck[0].count > 0) {
      console.warn(`⚠️  Warning: ${unitPriceCentsCheck[0].count} rows have NULL unit_price_cents. Setting to 0.`);
      await connection.query('UPDATE sales_return_items SET unit_price_cents = 0 WHERE unit_price_cents IS NULL');
    }
    await connection.query('ALTER TABLE sales_return_items MODIFY COLUMN unit_price_cents BIGINT NOT NULL');
    console.log('✅ Made unit_price_cents NOT NULL');

    // Change qty from DECIMAL to INT
    try {
      await connection.query('ALTER TABLE sales_return_items MODIFY COLUMN qty INT NOT NULL');
      console.log('✅ Changed qty from DECIMAL to INT');
    } catch (error) {
      console.log('ℹ️  qty column type update skipped (may already be INT or have incompatible data)');
    }

    // Drop old columns
    await dropColumnIfExists('sales_return_items', 'code_id');
    await dropColumnIfExists('sales_return_items', 'refund_cents');

    // Add foreign key constraints
    console.log('Adding foreign key constraints...');
    await addForeignKeyIfNotExists(
      'sales_return_items',
      'fk_sales_return_items_order_item_id',
      'FOREIGN KEY (order_item_id) REFERENCES order_items(id)'
    );
    await addForeignKeyIfNotExists(
      'sales_return_items',
      'fk_sales_return_items_product_code_version_id',
      'FOREIGN KEY (product_code_version_id) REFERENCES product_code_versions(id)'
    );
    
    console.log('✅ sales_return_items table updated successfully');
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();

