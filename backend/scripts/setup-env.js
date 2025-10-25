import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const setupEnv = () => {
  try {
    console.log('🚀 Setting up environment configuration...');
    
    const envPath = join(__dirname, '../.env');
    const templatePath = join(__dirname, '../env.template');
    
    // Check if .env already exists
    if (existsSync(envPath)) {
      console.log('⚠️  .env file already exists. Skipping creation.');
      console.log('📄 Current .env file location:', envPath);
      return;
    }
    
    // Read template
    const template = readFileSync(templatePath, 'utf8');
    
    // Create .env file
    writeFileSync(envPath, template);
    
    console.log('✅ .env file created successfully!');
    console.log('📄 Location:', envPath);
    console.log('');
    console.log('🔧 Next steps:');
    console.log('1. Edit the .env file with your MySQL credentials');
    console.log('2. Set DB_PASSWORD to your MySQL root password');
    console.log('3. Run: npm run db:setup');
    console.log('4. Run: npm run dev');
    
  } catch (error) {
    console.error('❌ Error setting up environment:', error.message);
    process.exit(1);
  }
};

setupEnv();

