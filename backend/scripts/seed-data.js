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
    console.log('🚀 Seeding database...');

    // Branch 1
    await connection.query(`
      INSERT INTO branches (code, name, address, phone) VALUES
      ('SDQ', 'Sucursal Santo Domingo', 'Av. 27 de Febrero 101, Santo Domingo', '+1-809-555-0101')
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `);

    // Roles
    await connection.query(`
      INSERT INTO roles (name) VALUES
      ('cashier'), ('seller'), ('manager'), ('marketing'), ('admin')
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `);

    // Categories
    await connection.query(`
      INSERT INTO categories (name) VALUES
      ('Electrónica'), ('Joyas')
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `);

    // Simple product
    await connection.query(`
      INSERT INTO products (sku, name, description, category_id, uom, taxable, is_active) 
      SELECT 'IPH12-128', 'iPhone 12 128GB', 'Smartphone en excelente estado', id, 'ea', TRUE, TRUE
      FROM categories WHERE name = 'Electrónica' LIMIT 1
      ON DUPLICATE KEY UPDATE description=VALUES(description)
    `);

    // Product code
    await connection.query(`
      INSERT INTO product_codes (product_id, code)
      SELECT p.id, 'SKU-1001'
      FROM products p WHERE p.sku = 'IPH12-128'
      ON DUPLICATE KEY UPDATE code=VALUES(code)
    `);

    // Customer
    await connection.query(`
      INSERT INTO customers (branch_id, first_name, last_name, email, phone, address, is_blacklisted, loyalty_points)
      SELECT b.id, 'Ana', 'Ramírez', 'ana.ramirez@example.com', '+1-809-555-1001', 'Ensanche Naco, Santo Domingo', FALSE, 120
      FROM branches b WHERE b.code = 'SDQ' LIMIT 1
      ON DUPLICATE KEY UPDATE loyalty_points=VALUES(loyalty_points)
    `);
    console.log('✅ Seed data inserted successfully.');

  } catch (error) {
    console.error('❌ Failed to seed data:', error.message);
    if (error.message.includes('Duplicate entry') || error.message.includes('already exists')) {
      console.log('ℹ️  Data already seeded.');
    } else {
      process.exitCode = 1;
    }
  } finally {
    await connection.end();
    console.log('✅ Database connection closed');
  }
}

main();
