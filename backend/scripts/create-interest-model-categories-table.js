import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    console.log(`Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`Port: ${process.env.DB_PORT || 3306}`);
    console.log(`Database: ${process.env.DB_NAME || 'pos'}`);
    console.log(`User: ${process.env.DB_USER || 'root'}`);
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pos',
      connectTimeout: 10000, // 10 seconds timeout
    });

    console.log('✅ Connected to database successfully');

    // Check if table exists
    console.log('Checking if interest_model_categories table exists...');
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'interest_model_categories'
    `, [process.env.DB_NAME || 'pos']);

    if (tables.length > 0) {
      console.log('ℹ️  Table interest_model_categories already exists. Skipping...');
      return;
    }

    console.log('Creating interest_model_categories table...');
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS interest_model_categories (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        interest_model_id BIGINT NOT NULL,
        category_id BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_interest_model_category (interest_model_id, category_id),
        FOREIGN KEY (interest_model_id) REFERENCES interest_models(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Table interest_model_categories created successfully.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('❌ Cannot connect to database. Please check:');
      console.error('   1. MySQL server is running');
      console.error('   2. Connection credentials in .env file are correct');
      console.error('   3. Database host and port are accessible');
    } else {
      process.exitCode = 1;
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});




