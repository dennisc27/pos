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
    database: process.env.DB_NAME || 'defaultdb',
  });

  try {
    console.log('Adding missing columns to orders table...');
    
    // Helper function to add column if it doesn't exist
    async function addColumnIfNotExists(table, column, definition) {
      try {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`✅ Added column ${table}.${column}`);
      } catch (error) {
        if (error.message.includes('Duplicate column')) {
          console.log(`ℹ️  Column ${table}.${column} already exists`);
        } else {
          throw error;
        }
      }
    }
    
    // Add columns that exist in Drizzle schema but not in database
    await addColumnIfNotExists('orders', 'user_id', 'BIGINT NULL');
    await addColumnIfNotExists('orders', 'order_number', 'VARCHAR(40)');
    await addColumnIfNotExists('orders', 'subtotal_cents', 'BIGINT DEFAULT 0');
    await addColumnIfNotExists('orders', 'tax_cents', 'BIGINT DEFAULT 0');
    await addColumnIfNotExists('orders', 'total_cents', 'BIGINT DEFAULT 0');
    await addColumnIfNotExists('orders', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    
    // If user_id is NULL, set it to created_by
    await connection.query('UPDATE orders SET user_id = created_by WHERE user_id IS NULL');
    
    // Set order_number if it's NULL
    await connection.query("UPDATE orders SET order_number = CONCAT('ORD-', id) WHERE order_number IS NULL");
    
    // Calculate totals from order_items if not set
    const [rows] = await connection.query('SELECT id FROM orders WHERE subtotal_cents = 0 OR subtotal_cents IS NULL');
    for (const row of rows) {
      const [results] = await connection.query(
        'SELECT COALESCE(SUM((price_cents - discount_cents) * qty), 0) as total FROM order_items WHERE order_id = ?', 
        [row.id]
      );
      const total = results[0]?.total || 0;
      await connection.query('UPDATE orders SET subtotal_cents = ?, tax_cents = 0, total_cents = ? WHERE id = ?', [total, total, row.id]);
    }
    
    console.log('✅ Orders table updated successfully');
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
