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
    console.log('Creating suppliers table and updating supplier_credits...');
    
    // Helper function to check if table exists
    async function tableExists(table) {
      const [rows] = await connection.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [process.env.DB_NAME || 'pos_system', table]
      );
      return rows[0].count > 0;
    }

    // Helper function to check if column exists
    async function columnExists(table, column) {
      const [rows] = await connection.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [process.env.DB_NAME || 'pos_system', table, column]
      );
      return rows[0].count > 0;
    }

    // Create suppliers table
    const suppliersExists = await tableExists('suppliers');
    if (!suppliersExists) {
      console.log('Creating suppliers table...');
      await connection.query(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(160) NOT NULL,
          tax_id VARCHAR(40),
          contact VARCHAR(120),
          phone VARCHAR(40),
          email VARCHAR(190),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_supplier_name (name)
        )
      `);
      console.log('✅ Created suppliers table');
    } else {
      console.log('ℹ️  suppliers table already exists');
    }

    // Update supplier_credits table to add supplier_id column
    const supplierCreditsExists = await tableExists('supplier_credits');
    if (supplierCreditsExists) {
      const supplierIdExists = await columnExists('supplier_credits', 'supplier_id');
      if (!supplierIdExists) {
        console.log('Adding supplier_id column to supplier_credits table...');
        await connection.query(`
          ALTER TABLE supplier_credits 
          ADD COLUMN supplier_id BIGINT NULL AFTER branch_id
        `);
        console.log('✅ Added supplier_id column to supplier_credits');
      } else {
        console.log('ℹ️  supplier_id column already exists in supplier_credits');
      }

      // Add foreign key constraint if it doesn't exist
      const [fkRows] = await connection.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = 'supplier_credits' 
          AND COLUMN_NAME = 'supplier_id' 
          AND REFERENCED_TABLE_NAME = 'suppliers'
      `, [process.env.DB_NAME || 'pos_system']);

      if (fkRows.length === 0) {
        console.log('Adding foreign key constraint for supplier_id...');
        await connection.query(`
          ALTER TABLE supplier_credits 
          ADD CONSTRAINT fk_supplier_credits_supplier_id 
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        `);
        console.log('✅ Added foreign key constraint for supplier_id');
      } else {
        console.log('ℹ️  Foreign key constraint for supplier_id already exists');
      }
    } else {
      console.log('⚠️  supplier_credits table does not exist, skipping updates');
    }

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

