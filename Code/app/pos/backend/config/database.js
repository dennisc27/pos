const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos_system',
  port: process.env.DB_PORT || 3306,
  charset: 'utf8mb4',
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

let connection;

const connectDB = async () => {
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL database');
    return connection;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
};

const getConnection = () => {
  if (!connection) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return connection;
};

const closeConnection = async () => {
  if (connection) {
    await connection.end();
    connection = null;
    console.log('✅ Database connection closed');
  }
};

module.exports = {
  connectDB,
  getConnection,
  closeConnection,
  dbConfig
};
