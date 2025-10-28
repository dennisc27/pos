import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, '../src/server.js');
let content = readFileSync(serverPath, 'utf8');

// Fix the inventory query to join products table
const oldQuery = `
  let query = db
    .select({
      productCodeId: productCodes.id,
      productCodeVersionId: productCodeVersions.id,
      code: productCodes.code,
      name: productCodes.name,
      sku: productCodes.sku,
      description: productCodes.description,
      categoryId: productCodes.categoryId,
      categoryName: includeCategories ? productCategories.name : sql\`NULL\`,
      branchId: productCodeVersions.branchId,
      branchName: branches.name,
      priceCents: productCodeVersions.priceCents,
      costCents: productCodeVersions.costCents,
      qtyOnHand: productCodeVersions.qtyOnHand,
      qtyReserved: productCodeVersions.qtyReserved,
      isActive: productCodeVersions.isActive,
      updatedAt: productCodeVersions.updatedAt,
    })
    .from(productCodeVersions)
    .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
    .leftJoin(branches, eq(productCodeVersions.branchId, branches.id));

  if (includeCategories) {
    query = query.leftJoin(productCategories, eq(productCodes.categoryId, product Benjamin));
  }
`;

const newQuery = `
  let query = db
    .select({
      productCodeId: productCodes.id,
      productCodeVersionId: productCodeVersions.id,
      code: productCodes.code,
      name: products.name,
      sku: products.sku,
      description: products.description,
      categoryId: products.categoryId,
      categoryName: includeCategories ? productCategories.name : sql\`NULL\`,
      branchId: productCodeVersions.branchId,
      branchName: branches.name,
      priceCents: productCodeVersions.priceCents,
      costCents: productCodeVersions.costCents,
      qtyOnHand: productCodeVersions.qtyOnHand,
      qtyReserved: productCodeVersions.qtyReserved,
      isActive: productCodeVersions.isActive,
      updatedAt: productCodeVersions.updatedAt,
    })
    .from(productCodeVersions)
    .innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))
    .innerJoin(products, eq(productCodes.productId, products.id))
    .leftJoin(branches, eq(productCodeVersions.branchId, branches.id));

  if (includeCategories) {
    query = query.leftJoin(productCategories, eq(products.categoryId, productCategories.id));
  }
`;

content = content.replace(
  /name: productCodes\.name,\s+sku: productCodes\.sku,\s+description: productCodes\.description,\s+categoryId: productCodes\.categoryId,/,
  'name: products.name,\n      sku: products.sku,\n      description: products.description,\n      categoryId: products.categoryId,'
);

content = content.replace(
  /\.innerJoin\(productCodes, eq\(productCodeVersions\.productCodeId, productCodes\.id\)\)\s+\.leftJoin\(branches, eq\(productCodeVersions\.branchId, branches\.id\)\);/,
  '.innerJoin(productCodes, eq(productCodeVersions.productCodeId, productCodes.id))\n    .innerJoin(products, eq(productCodes.productId, products.id))\n    .leftJoin(branches, eq(productCodeVersions.branchId, branches.id));'
);

content = content.replace(
  /query = query\.leftJoin\(productCategories, eq\(productCodes\.categoryId, productCategories\.id\)\);/,
  'query = query.leftJoin(productCategories, eq(products.categoryId, productCategories.id));'
);

// Also update the sort column
content = content.replace(
  /name: productCodes\.name,/,
  'name: products.name,'
);
content = content.replace(
  /sku: productCodes\.sku,/,
  'sku: products.sku,'
);

writeFileSync(serverPath, content, 'utf8');
console.log('✅ Fixed inventory query');

