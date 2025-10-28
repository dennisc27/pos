import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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
    charset: 'utf8mb4',
    multipleStatements: true,
  });

  try {
    console.log('🗑️  Dropping existing database...');
    const dbName = process.env.DB_NAME || 'defaultdb';
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    
    console.log('📊 Creating new database...');
    await connection.query(`CREATE DATABASE \`${dbName}\``);
    
    console.log('📄 Applying schema...');
    await connection.query(`USE \`${dbName}\``);
    
    // Disable foreign key checks during schema creation
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    const schemaPath = join(__dirname, '../../schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    
    // Clean and execute schema
    const cleanSQL = schemaSQL
      .split('\n')
      .map(line => {
        const commentIndex = line.indexOf('--');
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex);
        }
        return line;
      })
      .join('\n');

    await connection.query(cleanSQL);
    
    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('✅ Database recreated successfully');

  } catch (error) {
    console.error('❌ Failed to recreate database:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('✅ Database connection closed');
  }
}

main();

