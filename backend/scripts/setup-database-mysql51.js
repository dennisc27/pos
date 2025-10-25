import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const setupDatabase = async () => {
  let connection;
  
  try {
    console.log('🚀 Setting up database for MySQL 5.1...');
    console.log('📋 Environment variables:');
    console.log('  DB_HOST:', process.env.DB_HOST || 'localhost');
    console.log('  DB_PORT:', process.env.DB_PORT || 3306);
    console.log('  DB_USER:', process.env.DB_USER || 'root');
    console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'NOT SET');
    console.log('  DB_NAME:', process.env.DB_NAME || 'pos_system');
    console.log('');
    
    // Connect to MySQL (without specifying database first)
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      charset: 'utf8', // Use utf8 instead of utf8mb4 for MySQL 5.1
    });
    
    console.log('✅ Connected to MySQL server');
    
    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'pos_system';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database '${dbName}' created/verified`);
    
    // Switch to the database
    await connection.query(`USE \`${dbName}\``);
    console.log(`✅ Switched to database '${dbName}'`);
    
    // Read and execute MySQL 5.1 compatible schema
    const schemaPath = join(__dirname, '../schema-mysql51.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    
    console.log('📄 MySQL 5.1 compatible schema file loaded');
    
    // Split into statements and execute
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
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
    
    console.log('🎉 Database setup completed successfully for MySQL 5.1!');
    console.log('');
    console.log('⚠️  Note: Some features may be limited due to MySQL 5.1:');
    console.log('   - JSON columns are stored as TEXT');
    console.log('   - Some modern MySQL features are not available');
    console.log('   - Consider upgrading to MySQL 5.7+ for full functionality');
    
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
