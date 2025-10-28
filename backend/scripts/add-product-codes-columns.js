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
    console.log('Adding columns to product_codes table...');
    
    await connection.query('ALTER TABLE product_codes ADD COLUMN name VARCHAR(200)');
    await connection.query('ALTER TABLE product_codes ADD COLUMN sku VARCHAR(60)');
    await connection.query('ALTER TABLE product_codes ADD COLUMN description TEXT');
    await connection.query('ALTER TABLE product_codes ADD COLUMN category_id BIGINT');
    await connection.query('ALTER TABLE product_codes ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    
    console.log('✅ Columns added successfully');
    
  } catch (error) {
    if (error.message.includes('Duplicate column')) {
      console.log('✅ Columns already exist');
    } else {
      console.error('❌ Failed:', error.message);
      process.exit(1);
    }
  } finally {
    await connection.end();
  }
}

main();

