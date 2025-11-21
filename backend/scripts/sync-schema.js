import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

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
    multipleStatements: true,
  });

  try {
    console.log('🔄 Syncing database with schema.sql...\n');

    const dbName = process.env.DB_NAME || 'pos_system';

    // Helper function to check if table exists
    async function tableExists(table) {
      const [rows] = await connection.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [dbName, table]
      );
      return rows[0].count > 0;
    }

    // Helper function to check if column exists
    async function columnExists(table, column) {
      const [rows] = await connection.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [dbName, table, column]
      );
      return rows[0].count > 0;
    }

    // Helper function to check if foreign key exists
    async function foreignKeyExists(table, column, referencedTable) {
      const [rows] = await connection.query(
        `SELECT CONSTRAINT_NAME 
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
         WHERE TABLE_SCHEMA = ? 
           AND TABLE_NAME = ? 
           AND COLUMN_NAME = ? 
           AND REFERENCED_TABLE_NAME = ?`,
        [dbName, table, column, referencedTable]
      );
      return rows.length > 0;
    }

    // Helper function to get column definition from schema
    function parseColumnDefinition(columnDef) {
      const trimmed = columnDef.trim();
      const parts = trimmed.split(/\s+/);
      const name = parts[0].replace(/[`"]/g, '');
      const type = parts.slice(1).join(' ');
      return { name, definition: type };
    }

    // Read and parse schema.sql
    const schemaPath = join(__dirname, '../../schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');

    // Extract CREATE TABLE statements
    const createTableRegex = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\);/g;
    const tables = [];
    let match;

    while ((match = createTableRegex.exec(schemaSQL)) !== null) {
      const tableName = match[1];
      const tableBody = match[2];
      
      // Parse columns
      const columns = [];
      const foreignKeys = [];
      
      // Split by comma, but be careful with nested parentheses
      const lines = tableBody.split(',').map(l => l.trim());
      
      for (const line of lines) {
        if (line.startsWith('FOREIGN KEY')) {
          // Parse foreign key
          const fkMatch = line.match(/FOREIGN KEY\s*\((\w+)\)\s*REFERENCES\s+(\w+)\((\w+)\)/);
          if (fkMatch) {
            foreignKeys.push({
              column: fkMatch[1],
              referencedTable: fkMatch[2],
              referencedColumn: fkMatch[3],
            });
          }
        } else if (line && !line.startsWith('--') && !line.startsWith('UNIQUE KEY') && !line.startsWith('INDEX')) {
          // Parse column
          const colMatch = line.match(/^(\w+)\s+(.+)$/);
          if (colMatch) {
            const colName = colMatch[1];
            const colDef = colMatch[2];
            // Remove trailing constraints that are on the same line
            const cleanDef = colMatch[2].split(/\s+(FOREIGN KEY|UNIQUE|INDEX)/)[0];
            columns.push({ name: colName, definition: cleanDef });
          }
        }
      }

      tables.push({ name: tableName, columns, foreignKeys });
    }

    console.log(`📋 Found ${tables.length} tables in schema.sql\n`);

    // Process each table
    for (const table of tables) {
      const exists = await tableExists(table.name);
      
      if (!exists) {
        // Table doesn't exist, create it using the original CREATE TABLE statement
        console.log(`📦 Creating table: ${table.name}`);
        const tableMatch = schemaSQL.match(
          new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table.name}\\s*\\([\\s\\S]*?\\);`, 'i')
        );
        if (tableMatch) {
          try {
            await connection.query(tableMatch[0]);
            console.log(`✅ Created table: ${table.name}\n`);
          } catch (error) {
            console.error(`❌ Failed to create table ${table.name}:`, error.message);
          }
        }
      } else {
        // Table exists, check for missing columns
        console.log(`🔍 Checking table: ${table.name}`);
        let changesMade = false;

        for (const column of table.columns) {
          const colExists = await columnExists(table.name, column.name);
          if (!colExists) {
            console.log(`  ➕ Adding column: ${column.name}`);
            try {
              // Determine position (after id if it's not id, otherwise at the end)
              let afterClause = '';
              if (column.name !== 'id' && table.columns.find(c => c.name === 'id')) {
                afterClause = ' AFTER id';
              }
              
              await connection.query(
                `ALTER TABLE \`${table.name}\` ADD COLUMN \`${column.name}\` ${column.definition}${afterClause}`
              );
              changesMade = true;
              console.log(`  ✅ Added column: ${column.name}`);
            } catch (error) {
              console.error(`  ❌ Failed to add column ${column.name}:`, error.message);
            }
          }
        }

        // Check for missing foreign keys
        for (const fk of table.foreignKeys) {
          const fkExists = await foreignKeyExists(table.name, fk.column, fk.referencedTable);
          if (!fkExists) {
            console.log(`  🔗 Adding foreign key: ${fk.column} -> ${fk.referencedTable}(${fk.referencedColumn})`);
            try {
              const constraintName = `fk_${table.name}_${fk.column}`;
              await connection.query(
                `ALTER TABLE \`${table.name}\` 
                 ADD CONSTRAINT \`${constraintName}\` 
                 FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.referencedTable}\`(\`${fk.referencedColumn}\`)`
              );
              changesMade = true;
              console.log(`  ✅ Added foreign key: ${fk.column}`);
            } catch (error) {
              if (error.message.includes('Duplicate key name') || error.message.includes('already exists')) {
                console.log(`  ℹ️  Foreign key already exists: ${fk.column}`);
              } else {
                console.error(`  ❌ Failed to add foreign key ${fk.column}:`, error.message);
              }
            }
          }
        }

        if (!changesMade) {
          console.log(`  ✓ Table ${table.name} is up to date`);
        }
        console.log('');
      }
    }

    // Handle indexes (they're at the end of schema.sql)
    const indexRegex = /CREATE INDEX\s+(\w+)\s+ON\s+(\w+)\(([^)]+)\)/g;
    while ((match = indexRegex.exec(schemaSQL)) !== null) {
      const indexName = match[1];
      const tableName = match[2];
      const columns = match[3];

      // Check if index exists
      const [indexRows] = await connection.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [dbName, tableName, indexName]
      );

      if (indexRows[0].count === 0) {
        console.log(`📊 Creating index: ${indexName} on ${tableName}`);
        try {
          await connection.query(`CREATE INDEX \`${indexName}\` ON \`${tableName}\`(${columns})`);
          console.log(`✅ Created index: ${indexName}\n`);
        } catch (error) {
          if (error.message.includes('Duplicate key name')) {
            console.log(`ℹ️  Index ${indexName} already exists\n`);
          } else {
            console.error(`❌ Failed to create index ${indexName}:`, error.message);
          }
        }
      }
    }

    console.log('\n✅ Schema sync completed successfully!');
  } catch (error) {
    console.error('❌ Schema sync failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

