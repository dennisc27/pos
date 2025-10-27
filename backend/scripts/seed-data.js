import crypto from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { connectDB, closeConnection, db } from '../src/db/connection.js';
import {
  branches,
  roles,
  users,
  productCategories,
  productCodes,
  productCodeVersions,
  customers,
  giftCards,
  creditNotes,
  settings,
  interestModels,
} from '../src/db/schema.js';

async function main() {
  await connectDB();

  const seedRoles = [
    { name: 'cashier' },
    { name: 'seller' },
    { name: 'manager' },
    { name: 'marketing' },
    { name: 'admin' },
  ];

  await db
    .insert(roles)
    .values(seedRoles)
    .onDuplicateKeyUpdate({ set: { name: sql`VALUES(name)` } });

  const seedBranches = [
    {
      code: 'SDQ',
      name: 'Sucursal Santo Domingo',
      address: 'Av. 27 de Febrero 101, Santo Domingo',
      phone: '+1-809-555-0101',
    },
    {
      code: 'POP',
      name: 'Sucursal Puerto Plata',
      address: 'Calle Duarte 55, Puerto Plata',
      phone: '+1-809-555-0202',
    },
  ];

  await db
    .insert(branches)
    .values(seedBranches)
    .onDuplicateKeyUpdate({
      set: {
        name: sql`VALUES(name)`,
        address: sql`VALUES(address)`,
        phone: sql`VALUES(phone)`,
      },
    });

  const [mainBranch] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.code, 'SDQ'))
    .limit(1);

  if (!mainBranch) {
    throw new Error('Primary branch not found after seeding');
  }

  const [managerRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, 'manager'))
    .limit(1);

  const [cashierRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, 'cashier'))
    .limit(1);

  if (!managerRole || !cashierRole) {
    throw new Error('Required roles not found after seeding');
  }

  const hashedPin = crypto.createHash('sha256').update('1234').digest('hex');

  await db
    .insert(users)
    .values([
      {
        branchId: mainBranch.id,
        email: 'gerente@pawn.test',
        phone: '+1-809-555-0303',
        fullName: 'Gerente General',
        pinHash: hashedPin,
        roleId: managerRole.id,
      },
      {
        branchId: mainBranch.id,
        email: 'cajero@pawn.test',
        phone: '+1-809-555-0404',
        fullName: 'Cajero Principal',
        pinHash: hashedPin,
        roleId: cashierRole.id,
      },
    ])
    .onDuplicateKeyUpdate({
      set: {
        branchId: sql`VALUES(branch_id)`,
        fullName: sql`VALUES(full_name)`,
        phone: sql`VALUES(phone)`,
        roleId: sql`VALUES(role_id)`,
        pinHash: sql`VALUES(pin_hash)`,
      },
    });

  await db
    .insert(productCategories)
    .values([
      { name: 'Electrónica' },
      { name: 'Herramientas' },
    ])
    .onDuplicateKeyUpdate({ set: { name: sql`VALUES(name)` } });

  const [electronicsCategory] = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(eq(productCategories.name, 'Electrónica'))
    .limit(1);

  await db
    .insert(productCodes)
    .values([
      {
        code: 'SKU-1001',
        name: 'iPhone 12 128GB',
        categoryId: electronicsCategory?.id ?? null,
        sku: 'IPH12-128-BLK',
        description: 'Apple iPhone 12 color negro, 128GB, excelente estado.',
      },
      {
        code: 'SKU-2001',
        name: 'Taladro Makita 18V',
        categoryId: electronicsCategory?.id ?? null,
        sku: 'MAK-18V',
        description: 'Taladro inalámbrico Makita con batería y cargador.',
      },
    ])
    .onDuplicateKeyUpdate({
      set: {
        name: sql`VALUES(name)`,
        categoryId: sql`VALUES(category_id)`,
        description: sql`VALUES(description)`,
      },
    });

  const products = await db
    .select({ id: productCodes.id, code: productCodes.code })
    .from(productCodes)
    .where(inArray(productCodes.code, ['SKU-1001', 'SKU-2001']));

  const productMap = new Map(products.map((row) => [row.code, row.id]));

  if (!productMap.get('SKU-1001') || !productMap.get('SKU-2001')) {
    throw new Error('Seed product codes missing required entries');
  }

  await db
    .insert(productCodeVersions)
    .values([
      {
        productCodeId: productMap.get('SKU-1001'),
        branchId: mainBranch.id,
        priceCents: 450000,
        costCents: 320000,
        qtyOnHand: 5,
        qtyReserved: 0,
      },
      {
        productCodeId: productMap.get('SKU-2001'),
        branchId: mainBranch.id,
        priceCents: 120000,
        costCents: 80000,
        qtyOnHand: 10,
        qtyReserved: 0,
      },
    ])
    .onDuplicateKeyUpdate({
      set: {
        priceCents: sql`VALUES(price_cents)`,
        costCents: sql`VALUES(cost_cents)`,
        qtyOnHand: sql`VALUES(qty_on_hand)`,
        qtyReserved: sql`VALUES(qty_reserved)`,
      },
    });

  await db
    .insert(customers)
    .values({
      branchId: mainBranch.id,
      firstName: 'Juan',
      lastName: 'Pérez',
      email: 'juan.perez@pawn.test',
      phone: '+1-809-555-0505',
      address: 'Calle El Conde 123, Zona Colonial',
    })
    .onDuplicateKeyUpdate({
      set: {
        branchId: sql`VALUES(branch_id)`,
        firstName: sql`VALUES(first_name)`,
        lastName: sql`VALUES(last_name)`,
        phone: sql`VALUES(phone)`,
        address: sql`VALUES(address)`,
      },
    });

  const [sampleCustomer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.email, 'juan.perez@pawn.test'))
    .limit(1);

  if (!sampleCustomer) {
    throw new Error('Sample customer not found after seeding');
  }

  await db
    .insert(giftCards)
    .values({
      code: 'GC-0001-TEST',
      balanceCents: 150000,
      expiresOn: new Date(Date.now() + 31536000000),
    })
    .onDuplicateKeyUpdate({
      set: {
        balanceCents: sql`VALUES(balance_cents)`,
        expiresOn: sql`VALUES(expires_on)`,
      },
    });

  await db
    .insert(creditNotes)
    .values({
      customerId: sampleCustomer.id,
      balanceCents: 50000,
      reason: 'Saldo inicial de nota de crédito demo',
    })
    .onDuplicateKeyUpdate({
      set: {
        balanceCents: sql`VALUES(balance_cents)`,
        reason: sql`VALUES(reason)`,
      },
    });

  await db
    .insert(settings)
    .values([
      {
        scope: 'global',
        k: 'pos.tenders',
        v: {
          cash: { enabled: true },
          card: { enabled: true },
          transfer: { enabled: true },
          gift_card: { enabled: true },
        },
      },
      {
        scope: 'global',
        k: 'pos.drawer',
        v: {
          openThresholdCents: 50000,
          discrepancyAlertCents: 20000,
        },
      },
    ])
    .onDuplicateKeyUpdate({
      set: {
        v: sql`VALUES(v)`,
      },
    });

  await db
    .insert(interestModels)
    .values({
      name: 'Modelo estándar 30 días',
      description: 'Interés simple 10% mensual',
      rateType: 'simple',
      periodDays: 30,
      interestRateBps: 1000,
      graceDays: 5,
      minPrincipalCents: 10000,
      maxPrincipalCents: 5000000,
      lateFeeBps: 150,
    })
    .onDuplicateKeyUpdate({
      set: {
        description: sql`VALUES(description)`,
        interestRateBps: sql`VALUES(interest_rate_bps)`,
        graceDays: sql`VALUES(grace_days)`,
        lateFeeBps: sql`VALUES(late_fee_bps)`,
      },
    });

  console.log('✅ Seed data inserted successfully.');
}

main()
  .catch((error) => {
    console.error('❌ Failed to seed data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeConnection();
  });
