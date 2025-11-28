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

    // Check if character column exists
    console.log('Checking if character column exists...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'categories' 
      AND COLUMN_NAME = 'character'
    `, [process.env.DB_NAME || 'pos']);

    if (columns.length === 0) {
      console.log('ℹ️  Column character does not exist. Checking if caracter column exists...');
      const [caracterColumns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'categories' 
        AND COLUMN_NAME = 'caracter'
      `, [process.env.DB_NAME || 'pos']);

      if (caracterColumns.length > 0) {
        console.log('ℹ️  Column caracter already exists. Nothing to do.');
        return;
      } else {
        console.log('ℹ️  Neither column exists. Adding caracter column...');
        await connection.query(`
          ALTER TABLE categories
          ADD COLUMN \`caracter\` VARCHAR(1) NULL AFTER name
        `);
        console.log('✅ Column caracter added successfully.');
        return;
      }
    }

    // Check if caracter column already exists
    console.log('Checking if caracter column already exists...');
    const [caracterColumns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'categories' 
      AND COLUMN_NAME = 'caracter'
    `, [process.env.DB_NAME || 'pos']);

    if (caracterColumns.length > 0) {
      console.log('ℹ️  Column caracter already exists. Dropping character column...');
      await connection.query(`
        ALTER TABLE categories
        DROP COLUMN \`character\`
      `);
      console.log('✅ Column character dropped successfully.');
      return;
    }

    console.log('Renaming character column to caracter...');
    
    await connection.query(`
      ALTER TABLE categories
      CHANGE COLUMN \`character\` \`caracter\` VARCHAR(1) NULL
    `);

    console.log('✅ Column renamed from character to caracter successfully.');
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





