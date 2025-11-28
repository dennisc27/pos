import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env') });

async function addDateOfBirthColumn() {
  let connection;
  try {
    console.log('Connecting to database...');
    console.log('Host:', process.env.DB_HOST || 'localhost');
    console.log('Port:', process.env.DB_PORT || '3306');
    console.log('User:', process.env.DB_USER || 'root');
    console.log('Database:', process.env.DB_NAME || 'pos');
    
    const connectionConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pos',
      connectTimeout: 30000, // 30 seconds timeout
    };
    
    // Add SSL if CA certificate is provided (for Aiven/cloud databases)
    if (process.env.DB_CA_CERT) {
      connectionConfig.ssl = {
        ca: process.env.DB_CA_CERT,
      };
    } else if (process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud.com')) {
      // For Aiven, require SSL but don't verify certificate
      connectionConfig.ssl = {
        rejectUnauthorized: false,
      };
    }
    
    connection = await mysql.createConnection(connectionConfig);
    
    console.log('✓ Connected to database');

    console.log('Adding date_of_birth column to customers table...');

    await connection.execute(`
      ALTER TABLE customers 
      ADD COLUMN date_of_birth DATE NULL 
      AFTER address
    `);

    console.log('✓ Successfully added date_of_birth column to customers table');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('✓ Column date_of_birth already exists, skipping...');
    } else {
      console.error('Error adding date_of_birth column:', error);
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addDateOfBirthColumn();

