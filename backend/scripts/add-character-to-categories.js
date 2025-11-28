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

    // Check if table exists, if not create it
    console.log('Checking if categories table exists...');
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'categories'
    `, [process.env.DB_NAME || 'pos']);

    if (tables.length === 0) {
      console.log('Creating categories table...');
      await connection.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          parent_id BIGINT NULL,
          name VARCHAR(120) NOT NULL,
          \`character\` VARCHAR(1) NULL,
          FOREIGN KEY (parent_id) REFERENCES categories(id)
        )
      `);
      console.log('✅ Categories table created successfully with character column.');
    } else {
      // Table exists, check if column exists
      console.log('Categories table exists. Checking if character column exists...');
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'categories' 
        AND COLUMN_NAME = 'character'
      `, [process.env.DB_NAME || 'pos']);

      if (columns.length > 0) {
        console.log('ℹ️  Column character already exists. Skipping...');
        return;
      }

      console.log('Adding character column to categories table...');
      
      await connection.query(`
        ALTER TABLE categories
        ADD COLUMN \`character\` VARCHAR(1) NULL AFTER name
      `);

      console.log('✅ Column character added successfully to categories table.');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('❌ Cannot connect to database. Please check:');
      console.error('   1. MySQL server is running');
      console.error('   2. Connection credentials in .env file are correct');
      console.error('   3. Database host and port are accessible');
    } else if (error.message.includes('Duplicate column name')) {
      console.log('ℹ️  Column already exists.');
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

