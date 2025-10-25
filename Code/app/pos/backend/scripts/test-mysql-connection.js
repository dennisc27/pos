import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const testConnection = async () => {
  let connection;
  
  try {
    console.log('🔍 Testing MySQL connection...');
    console.log('Host:', process.env.DB_HOST || 'localhost');
    console.log('Port:', process.env.DB_PORT || 3306);
    console.log('User:', process.env.DB_USER || 'root');
    console.log('Password:', process.env.DB_PASSWORD ? '***' : 'NOT SET');
    console.log('Database:', process.env.DB_NAME || 'pos_system');
    console.log('');
    
    // Try different connection configurations for MySQL 5.1
    const configs = [
      {
        name: 'Standard connection',
        config: {
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || '',
          port: process.env.DB_PORT || 3306,
          charset: 'utf8',
        }
      },
      {
        name: 'Connection with auth plugin',
        config: {
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || '',
          port: process.env.DB_PORT || 3306,
          charset: 'utf8',
          authPlugins: {
            mysql_native_password: () => () => Buffer.alloc(0)
          }
        }
      },
      {
        name: 'Connection without charset',
        config: {
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || '',
          port: process.env.DB_PORT || 3306,
        }
      }
    ];
    
    for (const { name, config } of configs) {
      try {
        console.log(`🔄 Trying ${name}...`);
        connection = await mysql.createConnection(config);
        
        // Test the connection
        const [rows] = await connection.execute('SELECT VERSION() as version, USER() as user, DATABASE() as database');
        console.log(`✅ ${name} successful!`);
        console.log('MySQL Version:', rows[0].version);
        console.log('Connected as:', rows[0].user);
        console.log('Current database:', rows[0].database);
        console.log('');
        
        await connection.end();
        return true;
        
      } catch (error) {
        console.log(`❌ ${name} failed:`, error.message);
        if (connection) {
          try {
            await connection.end();
          } catch (e) {
            // Ignore close errors
          }
        }
      }
    }
    
    console.log('❌ All connection attempts failed');
    return false;
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
};

// Run the test
testConnection().then(success => {
  if (success) {
    console.log('🎉 MySQL connection test successful!');
    console.log('You can now run: npm run db:setup-mysql51');
  } else {
    console.log('💡 Troubleshooting tips:');
    console.log('1. Make sure MySQL is running');
    console.log('2. Check if the password is correct');
    console.log('3. Try connecting with MySQL client: mysql -u root -p');
    console.log('4. Check if MySQL is configured to accept connections from localhost');
  }
  process.exit(success ? 0 : 1);
});
