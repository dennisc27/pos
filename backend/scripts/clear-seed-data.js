import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
    console.log('🗑️  Clearing existing data...');

    const clearSQL = `
      SET FOREIGN_KEY_CHECKS = 0;
      
      TRUNCATE TABLE audit_logs;
      TRUNCATE TABLE compliance_stamps;
      TRUNCATE TABLE notifications;
      TRUNCATE TABLE ecom_return_items;
      TRUNCATE TABLE ecom_returns;
      TRUNCATE TABLE ecom_order_items;
      TRUNCATE TABLE ecom_orders;
      TRUNCATE TABLE ecom_listing_channels;
      TRUNCATE TABLE ecom_listings;
      TRUNCATE TABLE ecom_webhook_logs;
      TRUNCATE TABLE ecom_channel_logs;
      TRUNCATE TABLE ecom_channels;
      TRUNCATE TABLE marketing_sends;
      TRUNCATE TABLE marketing_campaigns;
      TRUNCATE TABLE marketing_segments;
      TRUNCATE TABLE marketing_templates;
      TRUNCATE TABLE credit_note_ledger;
      TRUNCATE TABLE credit_notes;
      TRUNCATE TABLE gift_card_ledger;
      TRUNCATE TABLE gift_cards;
      TRUNCATE TABLE cash_movements;
      TRUNCATE TABLE shift_reports;
      TRUNCATE TABLE shifts;
      TRUNCATE TABLE repair_materials;
      TRUNCATE TABLE repair_payments;
      TRUNCATE TABLE repair_photos;
      TRUNCATE TABLE repairs;
      TRUNCATE TABLE layaway_payments;
      TRUNCATE TABLE layaways;
      TRUNCATE TABLE notification_messages;
      TRUNCATE TABLE instapawn_intakes;
      TRUNCATE TABLE loan_forfeitures;
      TRUNCATE TABLE loan_payments;
      TRUNCATE TABLE loan_schedules;
      TRUNCATE TABLE loan_collateral;
      TRUNCATE TABLE loans;
      TRUNCATE TABLE interest_models;
      TRUNCATE TABLE sales_return_items;
      TRUNCATE TABLE sales_returns;
      TRUNCATE TABLE payments;
      TRUNCATE TABLE invoices;
      TRUNCATE TABLE order_items;
      TRUNCATE TABLE orders;
      TRUNCATE TABLE quarantine;
      TRUNCATE TABLE inv_transfer_lines;
      TRUNCATE TABLE inv_transfers;
      TRUNCATE TABLE inv_count_lines;
      TRUNCATE TABLE inv_count_sessions;
      TRUNCATE TABLE supplier_credit_ledger;
      TRUNCATE TABLE supplier_credits;
      TRUNCATE TABLE purchase_return_lines;
      TRUNCATE TABLE purchase_returns;
      TRUNCATE TABLE purchase_lines;
      TRUNCATE TABLE purchases;
      TRUNCATE TABLE stock_ledger;
      TRUNCATE TABLE product_code_components;
      TRUNCATE TABLE product_code_versions;
      TRUNCATE TABLE product_codes;
      TRUNCATE TABLE products;
      TRUNCATE TABLE categories;
      TRUNCATE TABLE reviews;
      TRUNCATE TABLE customer_notes;
      TRUNCATE TABLE loyalty_ledger;
      TRUNCATE TABLE id_images;
      TRUNCATE TABLE customers;
      TRUNCATE TABLE settings;
      TRUNCATE TABLE users;
      TRUNCATE TABLE roles;
      TRUNCATE TABLE branches;
      
      SET FOREIGN_KEY_CHECKS = 1;
    `;

    await connection.query(clearSQL);
    console.log('✅ Data cleared successfully');

  } catch (error) {
    console.error('❌ Failed to clear data:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('✅ Database connection closed');
  }
}

main();

