import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

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
    charset: 'utf8mb4',
    multipleStatements: true,
  });

  try {
    console.log('🚀 Seeding database with dummy data...');

    // Read the SQL file
    const sqlPath = join(__dirname, 'seed-dummy-data.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');

    // Clean comments but keep SQL structure intact for MySQL variables to work
    console.log('📊 Executing seed SQL file...');
    
    const cleanSQL = sqlContent
      .split('\n')
      .map(line => {
        const commentIndex = line.indexOf('--');
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex);
        }
        return line;
      })
      .join('\n');

    console.log('Executing SQL as single batch to preserve MySQL variables...');
    
    try {
      await connection.query(cleanSQL);
      console.log('✅ Seeding completed successfully');
    } catch (error) {
      console.error('❌ SQL Execution Error:', error.message);
      if (error.code) {
        console.error('Error Code:', error.code);
      }
    }

  } catch (error) {
    console.error('❌ Failed to seed data:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('✅ Database connection closed');
  }
}

main();

