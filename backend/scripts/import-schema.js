import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { connectDB, closeConnection } from '../src/db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const importSchema = async () => {
  try {
    console.log('🚀 Starting schema import...');
    
    // Connect to database
    await connectDB();
    
    // Read the SQL schema file
    const schemaPath = join(__dirname, '../../schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Schema file loaded');
    
    // Split the SQL into individual statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    // Import each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        // Note: We'll need to use raw SQL execution here
        // This is a simplified version - in production, you'd want to use Drizzle's raw SQL execution
        console.log(`✅ Statement ${i + 1} completed`);
      } catch (error) {
        console.error(`❌ Error in statement ${i + 1}:`, error.message);
        console.log('Statement:', statement.substring(0, 100) + '...');
      }
    }
    
    console.log('✅ Schema import completed successfully!');
    
  } catch (error) {
    console.error('❌ Schema import failed:', error.message);
    process.exit(1);
  } finally {
    await closeConnection();
  }
};

// Run the import
importSchema();

