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

    // Check if column already exists
    console.log('Checking if cedula_no column exists...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'customers' 
      AND COLUMN_NAME = 'cedula_no'
    `, [process.env.DB_NAME || 'pos']);

    if (columns.length > 0) {
      console.log('ℹ️  Column cedula_no already exists. Skipping...');
      return;
    }

    console.log('Adding cedula_no column to customers table...');
    
    await connection.query(`
      ALTER TABLE customers
      ADD COLUMN cedula_no VARCHAR(20) AFTER last_name
    `);

    console.log('✅ Column cedula_no added successfully to customers table.');
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

