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
    database: process.env.DB_NAME || 'pos',
  });

  try {
    console.log('Checking if default_term_count column exists...');
    
    // Helper function to check if column exists
    async function columnExists(table, column) {
      const [rows] = await connection.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [process.env.DB_NAME || 'pos', table, column]
      );
      return rows[0].count > 0;
    }

    const columnExistsResult = await columnExists('interest_models', 'default_term_count');
    
    if (columnExistsResult) {
      console.log('ℹ️  Column default_term_count already exists. Skipping migration.');
      return;
    }

    console.log('Adding default_term_count column to interest_models table...');
    
    await connection.query(`
      ALTER TABLE interest_models 
      ADD COLUMN default_term_count INT NOT NULL DEFAULT 1
    `);

    console.log('✅ Successfully added default_term_count column to interest_models table.');
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

