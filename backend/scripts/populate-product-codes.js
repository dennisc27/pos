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
    console.log('Populating product_codes with data from products...');
    
    await connection.query(`
      UPDATE product_codes pc 
      JOIN products p ON pc.product_id = p.id 
      SET pc.name = p.name, 
          pc.sku = p.sku, 
          pc.description = p.description, 
          pc.category_id = p.category_id
    `);
    
    console.log('✅ Data populated successfully');
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();

