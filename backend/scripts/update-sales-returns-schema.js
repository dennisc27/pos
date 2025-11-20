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
    console.log('Updating sales_returns table schema...');
    
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

    // Remove old condition column if it exists (using backticks for reserved keyword)
    const conditionExists = await columnExists('sales_returns', 'condition');
    if (conditionExists) {
      try {
        await connection.query('ALTER TABLE sales_returns DROP COLUMN `condition`');
        console.log('✅ Dropped column sales_returns.condition');
      } catch (error) {
        console.error('❌ Failed to drop column sales_returns.condition:', error.message);
        // Continue even if this fails
      }
    }

    // Add new columns
    await addColumnIfNotExists('sales_returns', 'order_id', 'BIGINT NULL');
    await addColumnIfNotExists('sales_returns', 'branch_id', 'BIGINT NULL');
    await addColumnIfNotExists('sales_returns', 'customer_id', 'BIGINT NULL');
    await addColumnIfNotExists('sales_returns', 'created_by', 'BIGINT NULL');
    await addColumnIfNotExists('sales_returns', 'total_refund_cents', 'BIGINT NULL');
    await addColumnIfNotExists('sales_returns', 'restock_value_cents', 'BIGINT DEFAULT 0');
    await addColumnIfNotExists('sales_returns', 'notes', 'TEXT');

    // Populate order_id, branch_id, and customer_id from invoices -> orders
    console.log('Populating order_id, branch_id, and customer_id from related tables...');
    await connection.query(`
      UPDATE sales_returns sr
      INNER JOIN invoices inv ON sr.invoice_id = inv.id
      INNER JOIN orders ord ON inv.order_id = ord.id
      SET 
        sr.order_id = ord.id,
        sr.branch_id = ord.branch_id,
        sr.customer_id = ord.customer_id
      WHERE sr.order_id IS NULL OR sr.branch_id IS NULL
    `);

    // Calculate total_refund_cents from sales_return_items if not set
    console.log('Calculating total_refund_cents from sales_return_items...');
    await connection.query(`
      UPDATE sales_returns sr
      INNER JOIN (
        SELECT sales_return_id, SUM(refund_cents) as total
        FROM sales_return_items
        GROUP BY sales_return_id
      ) sri ON sr.id = sri.sales_return_id
      SET sr.total_refund_cents = sri.total
      WHERE sr.total_refund_cents IS NULL
    `);

    // Set default values for any remaining NULLs
    await connection.query(`
      UPDATE sales_returns 
      SET 
        restock_value_cents = 0 
      WHERE restock_value_cents IS NULL
    `);

    // Now make NOT NULL columns required
    console.log('Making required columns NOT NULL...');
    
    // Check if there are any NULLs before making NOT NULL
    const [orderIdCheck] = await connection.query(
      'SELECT COUNT(*) as count FROM sales_returns WHERE order_id IS NULL'
    );
    if (orderIdCheck[0].count > 0) {
      console.warn(`⚠️  Warning: ${orderIdCheck[0].count} rows have NULL order_id. These need to be fixed manually.`);
    } else {
      await connection.query('ALTER TABLE sales_returns MODIFY COLUMN order_id BIGINT NOT NULL');
      console.log('✅ Made order_id NOT NULL');
    }

    const [branchIdCheck] = await connection.query(
      'SELECT COUNT(*) as count FROM sales_returns WHERE branch_id IS NULL'
    );
    if (branchIdCheck[0].count > 0) {
      console.warn(`⚠️  Warning: ${branchIdCheck[0].count} rows have NULL branch_id. These need to be fixed manually.`);
    } else {
      await connection.query('ALTER TABLE sales_returns MODIFY COLUMN branch_id BIGINT NOT NULL');
      console.log('✅ Made branch_id NOT NULL');
    }

    const [totalRefundCheck] = await connection.query(
      'SELECT COUNT(*) as count FROM sales_returns WHERE total_refund_cents IS NULL'
    );
    if (totalRefundCheck[0].count > 0) {
      console.warn(`⚠️  Warning: ${totalRefundCheck[0].count} rows have NULL total_refund_cents. Setting to 0.`);
      await connection.query('UPDATE sales_returns SET total_refund_cents = 0 WHERE total_refund_cents IS NULL');
    }
    await connection.query('ALTER TABLE sales_returns MODIFY COLUMN total_refund_cents BIGINT NOT NULL');
    console.log('✅ Made total_refund_cents NOT NULL');

    // Add foreign key constraints
    console.log('Adding foreign key constraints...');
    await addForeignKeyIfNotExists(
      'sales_returns',
      'fk_sales_returns_order_id',
      'FOREIGN KEY (order_id) REFERENCES orders(id)'
    );
    await addForeignKeyIfNotExists(
      'sales_returns',
      'fk_sales_returns_branch_id',
      'FOREIGN KEY (branch_id) REFERENCES branches(id)'
    );
    await addForeignKeyIfNotExists(
      'sales_returns',
      'fk_sales_returns_customer_id',
      'FOREIGN KEY (customer_id) REFERENCES customers(id)'
    );
    await addForeignKeyIfNotExists(
      'sales_returns',
      'fk_sales_returns_created_by',
      'FOREIGN KEY (created_by) REFERENCES users(id)'
    );
    
    console.log('✅ sales_returns table updated successfully');
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();

