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
    database: process.env.DB_NAME || 'pos_system',
  });

  try {
    console.log('Fixing NULL values in sales_return_items...');
    
    // Find rows with NULL order_item_id or product_code_version_id
    const [nullRows] = await connection.query(`
      SELECT sri.id, sri.sales_return_id, sri.qty, sri.unit_price_cents
      FROM sales_return_items sri
      WHERE sri.order_item_id IS NULL OR sri.product_code_version_id IS NULL
    `);

    if (nullRows.length === 0) {
      console.log('✅ No rows with NULL values found. All data is already fixed.');
      return;
    }

    console.log(`Found ${nullRows.length} row(s) with NULL values. Attempting to fix...`);

    for (const row of nullRows) {
      console.log(`\nProcessing row ID ${row.id}...`);

      // Try to find order_item_id from sales_return -> invoice -> order -> order_items
      // We'll try to match by finding the first order_item from the order
      const [orderItemRows] = await connection.query(`
        SELECT oi.id as order_item_id, oi.code_id
        FROM sales_return_items sri
        INNER JOIN sales_returns sr ON sri.sales_return_id = sr.id
        INNER JOIN invoices inv ON sr.invoice_id = inv.id
        INNER JOIN orders ord ON inv.order_id = ord.id
        INNER JOIN order_items oi ON ord.id = oi.order_id
        WHERE sri.id = ?
        ORDER BY oi.id
        LIMIT 1
      `, [row.id]);

      let orderItemId = null;
      let codeId = null;
      if (orderItemRows.length > 0) {
        orderItemId = orderItemRows[0].order_item_id;
        codeId = orderItemRows[0].code_id;
        console.log(`  Found order_item_id: ${orderItemId}, code_id: ${codeId}`);
      } else {
        console.log(`  ⚠️  Could not find order_item_id for row ${row.id}`);
      }

      // Try to find product_code_version_id from code_id and branch_id
      let productCodeVersionId = null;
      if (codeId) {
        const [productCodeVersionRows] = await connection.query(`
          SELECT pcv.id as product_code_version_id
          FROM sales_returns sr
          INNER JOIN product_code_versions pcv ON pcv.product_code_id = ? AND pcv.branch_id = sr.branch_id
          WHERE sr.id = ?
          LIMIT 1
        `, [codeId, row.sales_return_id]);

        if (productCodeVersionRows.length > 0) {
          productCodeVersionId = productCodeVersionRows[0].product_code_version_id;
          console.log(`  Found product_code_version_id: ${productCodeVersionId}`);
        } else {
          console.log(`  ⚠️  Could not find product_code_version_id for row ${row.id}`);
        }
      }

      // Update the row if we found both values
      if (orderItemId && productCodeVersionId) {
        await connection.query(`
          UPDATE sales_return_items
          SET order_item_id = ?, product_code_version_id = ?
          WHERE id = ?
        `, [orderItemId, productCodeVersionId, row.id]);
        console.log(`  ✅ Fixed row ${row.id}`);
      } else {
        console.log(`  ❌ Could not fix row ${row.id} - missing required data`);
        console.log(`     This row may need to be manually fixed or deleted.`);
      }
    }

    // Check if we can now make columns NOT NULL
    const [remainingNulls] = await connection.query(`
      SELECT COUNT(*) as count FROM sales_return_items
      WHERE order_item_id IS NULL OR product_code_version_id IS NULL
    `);

    if (remainingNulls[0].count === 0) {
      console.log('\n✅ All NULL values fixed! Making columns NOT NULL...');
      await connection.query('ALTER TABLE sales_return_items MODIFY COLUMN order_item_id BIGINT NOT NULL');
      await connection.query('ALTER TABLE sales_return_items MODIFY COLUMN product_code_version_id BIGINT NOT NULL');
      console.log('✅ Columns are now NOT NULL');
    } else {
      console.log(`\n⚠️  ${remainingNulls[0].count} row(s) still have NULL values.`);
      console.log('   These rows cannot be automatically fixed and may need manual intervention.');
    }

    console.log('\n✅ Fix completed');
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();

