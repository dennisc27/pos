import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env') });

async function makeAuthorIdNullable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Checking if author_id column exists and is NOT NULL...');
    
    // Check current column definition
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'customer_notes'
        AND COLUMN_NAME = 'author_id'
    `, [process.env.DB_NAME]);

    if (columns.length === 0) {
      console.log('ERROR: author_id column does not exist in customer_notes table');
      process.exit(1);
    }

    const column = columns[0];
    console.log(`Current author_id definition: IS_NULLABLE=${column.IS_NULLABLE}, TYPE=${column.COLUMN_TYPE}`);

    if (column.IS_NULLABLE === 'YES') {
      console.log('author_id is already nullable. No changes needed.');
      return;
    }

    // Drop foreign key constraint first
    console.log('Dropping foreign key constraint...');
    const [constraints] = await connection.execute(`
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'customer_notes'
        AND COLUMN_NAME = 'author_id'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [process.env.DB_NAME]);

    if (constraints.length > 0) {
      const constraintName = constraints[0].CONSTRAINT_NAME;
      console.log(`Dropping constraint: ${constraintName}`);
      await connection.execute(`
        ALTER TABLE customer_notes
        DROP FOREIGN KEY ${constraintName}
      `);
    }

    // Make column nullable
    console.log('Making author_id nullable...');
    await connection.execute(`
      ALTER TABLE customer_notes
      MODIFY COLUMN author_id BIGINT NULL
    `);

    // Re-add foreign key constraint (now nullable)
    console.log('Re-adding foreign key constraint (nullable)...');
    await connection.execute(`
      ALTER TABLE customer_notes
      ADD CONSTRAINT fk_customer_notes_author_id
      FOREIGN KEY (author_id) REFERENCES users(id)
    `);

    console.log('✓ Successfully made author_id nullable in customer_notes table');
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

makeAuthorIdNullable();

