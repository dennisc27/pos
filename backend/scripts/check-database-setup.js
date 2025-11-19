import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const checkDatabaseSetup = async () => {
  let connection;
  
  try {
    console.log('🔍 Checking MySQL database setup...');
    console.log('Host:', process.env.DB_HOST || 'localhost');
    console.log('Port:', process.env.DB_PORT || 3306);
    console.log('User:', process.env.DB_USER || 'root');
    console.log('Password:', process.env.DB_PASSWORD ? '***' : 'NOT SET');
    console.log('Database:', process.env.DB_NAME || 'pos_system');
    console.log('');
    
    // Connect without specifying database first to check if it exists
    const config = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      charset: 'utf8mb4',
    };
    
    console.log('🔄 Connecting to MySQL server...');
    connection = await mysql.createConnection(config);
    
    // Get MySQL version
    const [versionRows] = await connection.execute('SELECT VERSION() as version');
    console.log('✅ Connected to MySQL server');
    console.log('MySQL Version:', versionRows[0].version);
    console.log('');
    
    // Check if database exists
    const dbName = process.env.DB_NAME || 'pos_system';
    console.log(`🔍 Checking if database '${dbName}' exists...`);
    
    const [dbRows] = await connection.execute(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [dbName]
    );
    
    if (dbRows.length === 0) {
      console.log(`❌ Database '${dbName}' does NOT exist`);
      console.log('');
      console.log('💡 To create the database, run:');
      console.log(`   CREATE DATABASE ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await connection.end();
      return false;
    }
    
    console.log(`✅ Database '${dbName}' exists`);
    console.log('');
    
    // Connect to the specific database
    await connection.end();
    config.database = dbName;
    connection = await mysql.createConnection(config);
    
    // Get list of tables
    console.log(`🔍 Checking tables in database '${dbName}'...`);
    const [tables] = await connection.execute(
      'SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
      [dbName]
    );
    
    if (tables.length === 0) {
      console.log('❌ No tables found in the database');
      console.log('');
      console.log('💡 The database exists but has no tables. You may need to run:');
      console.log('   - npm run db:setup (to create tables)');
      console.log('   - npm run db:seed (to seed initial data)');
      await connection.end();
      return false;
    }
    
    console.log(`✅ Found ${tables.length} tables:`);
    console.log('');
    
    // Display table information
    const tableInfo = tables.map(table => ({
      name: table.TABLE_NAME,
      rows: table.TABLE_ROWS || 0,
      dataSize: table.DATA_LENGTH ? (table.DATA_LENGTH / 1024 / 1024).toFixed(2) + ' MB' : '0 MB',
      indexSize: table.INDEX_LENGTH ? (table.INDEX_LENGTH / 1024 / 1024).toFixed(2) + ' MB' : '0 MB',
    }));
    
    // Group tables by category
    const coreTables = ['branches', 'users', 'roles', 'settings'];
    const productTables = ['categories', 'products', 'product_codes', 'product_code_versions'];
    const inventoryTables = ['stock_ledger', 'inventory_transfers', 'inventory_counts'];
    const posTables = ['orders', 'order_lines', 'invoices', 'payments', 'sales_returns'];
    const loanTables = ['loans', 'loan_schedules', 'collateral', 'interest_models'];
    const cashTables = ['shifts', 'cash_movements', 'shift_reports'];
    const otherTables = [];
    
    tableInfo.forEach(table => {
      if (coreTables.includes(table.name) || productTables.includes(table.name) || 
          inventoryTables.includes(table.name) || posTables.includes(table.name) || 
          loanTables.includes(table.name) || cashTables.includes(table.name)) {
        // Already categorized
      } else {
        otherTables.push(table);
      }
    });
    
    if (coreTables.some(t => tableInfo.find(ti => ti.name === t))) {
      console.log('📦 Core Tables:');
      coreTables.forEach(tableName => {
        const table = tableInfo.find(t => t.name === tableName);
        if (table) {
          console.log(`   - ${table.name.padEnd(30)} ${String(table.rows).padStart(8)} rows`);
        }
      });
      console.log('');
    }
    
    if (productTables.some(t => tableInfo.find(ti => ti.name === t))) {
      console.log('🛍️  Product & Inventory Tables:');
      productTables.forEach(tableName => {
        const table = tableInfo.find(t => t.name === tableName);
        if (table) {
          console.log(`   - ${table.name.padEnd(30)} ${String(table.rows).padStart(8)} rows`);
        }
      });
      console.log('');
    }
    
    if (inventoryTables.some(t => tableInfo.find(ti => ti.name === t))) {
      console.log('📊 Inventory Management Tables:');
      inventoryTables.forEach(tableName => {
        const table = tableInfo.find(t => t.name === tableName);
        if (table) {
          console.log(`   - ${table.name.padEnd(30)} ${String(table.rows).padStart(8)} rows`);
        }
      });
      console.log('');
    }
    
    if (posTables.some(t => tableInfo.find(ti => ti.name === t))) {
      console.log('💰 POS & Sales Tables:');
      posTables.forEach(tableName => {
        const table = tableInfo.find(t => t.name === tableName);
        if (table) {
          console.log(`   - ${table.name.padEnd(30)} ${String(table.rows).padStart(8)} rows`);
        }
      });
      console.log('');
    }
    
    if (loanTables.some(t => tableInfo.find(ti => ti.name === t))) {
      console.log('🏦 Loan & Pawn Tables:');
      loanTables.forEach(tableName => {
        const table = tableInfo.find(t => t.name === tableName);
        if (table) {
          console.log(`   - ${table.name.padEnd(30)} ${String(table.rows).padStart(8)} rows`);
        }
      });
      console.log('');
    }
    
    if (cashTables.some(t => tableInfo.find(ti => ti.name === t))) {
      console.log('💵 Cash & Shift Tables:');
      cashTables.forEach(tableName => {
        const table = tableInfo.find(t => t.name === tableName);
        if (table) {
          console.log(`   - ${table.name.padEnd(30)} ${String(table.rows).padStart(8)} rows`);
        }
      });
      console.log('');
    }
    
    if (otherTables.length > 0) {
      console.log('📋 Other Tables:');
      otherTables.forEach(table => {
        console.log(`   - ${table.name.padEnd(30)} ${String(table.rows).padStart(8)} rows`);
      });
      console.log('');
    }
    
    // Check for key tables that should exist
    const requiredTables = [
      'branches', 'users', 'roles', 'products', 'product_codes', 
      'orders', 'invoices', 'loans', 'shifts'
    ];
    
    const missingTables = requiredTables.filter(
      reqTable => !tableInfo.find(t => t.name === reqTable)
    );
    
    if (missingTables.length > 0) {
      console.log('⚠️  Missing required tables:');
      missingTables.forEach(table => {
        console.log(`   - ${table}`);
      });
      console.log('');
    } else {
      console.log('✅ All required core tables are present');
      console.log('');
    }
    
    // Get total database size
    const [sizeRows] = await connection.execute(
      `SELECT 
        ROUND(SUM(DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS size_mb
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ?`,
      [dbName]
    );
    
    console.log(`📊 Database Statistics:`);
    console.log(`   Total Tables: ${tables.length}`);
    console.log(`   Total Size: ${sizeRows[0].size_mb || 0} MB`);
    console.log('');
    
    await connection.end();
    console.log('🎉 Database setup check completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    if (connection) {
      try {
        await connection.end();
      } catch (e) {
        // Ignore close errors
      }
    }
    return false;
  }
};

// Run the check
checkDatabaseSetup().then(success => {
  process.exit(success ? 0 : 1);
});

