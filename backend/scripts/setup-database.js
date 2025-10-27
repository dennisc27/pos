import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: join(__dirname, '../.env') });

const setupDatabase = async () => {
  let connection;
  
  try {
    console.log('🚀 Setting up database...');
    
    // Connect to MySQL (without specifying database first)
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      charset: 'utf8mb4',
    });
    
    console.log('✅ Connected to MySQL server');
    
    // Create database if it doesn't exist (use query, not execute for DDL)
    const dbName = process.env.DB_NAME || 'pos_system';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database '${dbName}' created/verified`);
    
    // Switch to the database
    await connection.query(`USE \`${dbName}\``);
    console.log(`✅ Switched to database '${dbName}'`);
    
    // Read and execute schema
    const schemaPath = join(__dirname, '../../schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Schema file loaded');
    
    // Split into statements and execute - better handling of comments
    // First, remove all comments (lines starting with -- or inline comments)
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
    
    // Now split by semicolons to get statements
    const statements = cleanSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        if (statement.trim()) {
          await connection.query(statement);
          console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
        }
      } catch (error) {
        console.error(`❌ Error in statement ${i + 1}:`, error.message);
        console.log('Statement:', statement.substring(0, 100) + '...');
        // Continue with other statements
      }
    }
    
    console.log('🎉 Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
};

// Run the setup
setupDatabase();
