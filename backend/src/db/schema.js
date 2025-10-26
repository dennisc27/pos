import { 
  bigint, 
  boolean, 
  char, 
  datetime, 
  decimal, 
  int, 
  json, 
  mysqlEnum, 
  mysqlTable, 
  text, 
  timestamp, 
  varchar 
} from 'drizzle-orm/mysql-core';

// ========= ORG & AUTH =========
export const branches = mysqlTable('branches', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  code: varchar('code', { length: 32 }).unique().notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 40 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const roles = mysqlTable('roles', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  name: mysqlEnum('name', ['cashier', 'seller', 'manager', 'marketing', 'admin']).unique().notNull(),
});

export const users = mysqlTable('users', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  email: varchar('email', { length: 190 }).unique(),
  phone: varchar('phone', { length: 40 }),
  fullName: varchar('full_name', { length: 140 }).notNull(),
  pinHash: varchar('pin_hash', { length: 128 }),
  roleId: bigint('role_id', { mode: 'number' }).notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ========= SETTINGS =========
export const settings = mysqlTable('settings', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  scope: mysqlEnum('scope', ['global', 'branch', 'user']).notNull().default('global'),
  branchId: bigint('branch_id', { mode: 'number' }),
  userId: bigint('user_id', { mode: 'number' }),
  k: varchar('k', { length: 160 }).notNull(),
  v: json('v').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ========= PRODUCTS & INVENTORY =========
export const productCategories = mysqlTable('product_categories', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  name: varchar('name', { length: 80 }).notNull(),
  parentId: bigint('parent_id', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const productCodes = mysqlTable('product_codes', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  code: varchar('code', { length: 40 }).unique().notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  categoryId: bigint('category_id', { mode: 'number' }),
  sku: varchar('sku', { length: 60 }),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const productCodeVersions = mysqlTable('product_code_versions', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  productCodeId: bigint('product_code_id', { mode: 'number' }).notNull(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
  costCents: bigint('cost_cents', { mode: 'number' }),
  qtyOnHand: int('qty_on_hand').default(0),
  qtyReserved: int('qty_reserved').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ========= CASH & SHIFTS =========
export const shifts = mysqlTable('shifts', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  openedAt: timestamp('opened_at').defaultNow(),
  closedAt: timestamp('closed_at'),
  expectedCashCents: bigint('expected_cash_cents', { mode: 'number' }).default(0),
  actualCashCents: bigint('actual_cash_cents', { mode: 'number' }),
  varianceCents: bigint('variance_cents', { mode: 'number' }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const cashMovements = mysqlTable('cash_movements', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  shiftId: bigint('shift_id', { mode: 'number' }).notNull(),
  kind: mysqlEnum('kind', ['deposit', 'cash_to_safe', 'drop', 'paid_in', 'paid_out', 'expense', 'income']).notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  description: varchar('description', { length: 200 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ========= SALES & ORDERS =========
export const orders = mysqlTable('orders', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  customerId: bigint('customer_id', { mode: 'number' }),
  orderNumber: varchar('order_number', { length: 40 }).unique().notNull(),
  status: mysqlEnum('status', ['draft', 'pending', 'completed', 'cancelled']).default('draft'),
  subtotalCents: bigint('subtotal_cents', { mode: 'number' }).notNull(),
  taxCents: bigint('tax_cents', { mode: 'number' }).default(0),
  totalCents: bigint('total_cents', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const orderItems = mysqlTable('order_items', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  orderId: bigint('order_id', { mode: 'number' }).notNull(),
  productCodeVersionId: bigint('product_code_version_id', { mode: 'number' }).notNull(),
  qty: int('qty').notNull(),
  unitPriceCents: bigint('unit_price_cents', { mode: 'number' }).notNull(),
  totalCents: bigint('total_cents', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const invoices = mysqlTable('invoices', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  orderId: bigint('order_id', { mode: 'number' }).notNull(),
  invoiceNo: varchar('invoice_no', { length: 64 }),
  totalCents: bigint('total_cents', { mode: 'number' }).notNull(),
  taxCents: bigint('tax_cents', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const payments = mysqlTable('payments', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  orderId: bigint('order_id', { mode: 'number' }),
  invoiceId: bigint('invoice_id', { mode: 'number' }),
  shiftId: bigint('shift_id', { mode: 'number' }),
  method: mysqlEnum('method', ['cash', 'card', 'transfer', 'gift_card', 'credit_note']).notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  meta: json('meta'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ========= CUSTOMERS =========
export const customers = mysqlTable('customers', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  firstName: varchar('first_name', { length: 80 }).notNull(),
  lastName: varchar('last_name', { length: 80 }).notNull(),
  email: varchar('email', { length: 190 }),
  phone: varchar('phone', { length: 40 }),
  address: text('address'),
  isBlacklisted: boolean('is_blacklisted').default(false),
  loyaltyPoints: int('loyalty_points').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ========= LOANS/PAWNS =========
export const loans = mysqlTable('loans', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull(),
  ticketNumber: varchar('ticket_number', { length: 40 }).unique().notNull(),
  principalCents: bigint('principal_cents', { mode: 'number' }).notNull(),
  interestRate: decimal('interest_rate', { precision: 5, scale: 4 }).notNull(),
  dueDate: datetime('due_date').notNull(),
  status: mysqlEnum('status', ['active', 'renewed', 'redeemed', 'forfeited']).default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ========= LAYAWAYS =========
export const layaways = mysqlTable('layaways', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull(),
  orderId: bigint('order_id', { mode: 'number' }).notNull(),
  totalCents: bigint('total_cents', { mode: 'number' }).notNull(),
  paidCents: bigint('paid_cents', { mode: 'number' }).default(0),
  dueDate: datetime('due_date').notNull(),
  status: mysqlEnum('status', ['active', 'completed', 'cancelled', 'pawned']).default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ========= REPAIRS =========
export const repairs = mysqlTable('repairs', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull(),
  jobNumber: varchar('job_number', { length: 40 }).unique().notNull(),
  description: text('description').notNull(),
  estimateCents: bigint('estimate_cents', { mode: 'number' }),
  status: mysqlEnum('status', ['intake', 'diagnosing', 'waiting_approval', 'in_progress', 'qa', 'ready', 'completed', 'cancelled']).default('intake'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ========= STOCK LEDGER =========
export const stockLedger = mysqlTable('stock_ledger', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  productCodeVersionId: bigint('product_code_version_id', { mode: 'number' }).notNull(),
  reason: mysqlEnum('reason', ['sale', 'purchase', 'count_post', 'transfer_in', 'transfer_out', 'pawn_forfeit_in', 'return', 'adjustment']).notNull(),
  qtyChange: int('qty_change').notNull(),
  referenceId: bigint('reference_id', { mode: 'number' }),
  referenceType: varchar('reference_type', { length: 40 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const giftCards = mysqlTable('gift_cards', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  code: varchar('code', { length: 32 }).notNull(),
  balanceCents: bigint('balance_cents', { mode: 'number' }).notNull(),
  expiresOn: datetime('expires_on'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const giftCardLedger = mysqlTable('gift_card_ledger', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  giftCardId: bigint('gift_card_id', { mode: 'number' }).notNull(),
  deltaCents: bigint('delta_cents', { mode: 'number' }).notNull(),
  refTable: varchar('ref_table', { length: 40 }),
  refId: bigint('ref_id', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const creditNotes = mysqlTable('credit_notes', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull(),
  balanceCents: bigint('balance_cents', { mode: 'number' }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const creditNoteLedger = mysqlTable('credit_note_ledger', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  creditNoteId: bigint('credit_note_id', { mode: 'number' }).notNull(),
  deltaCents: bigint('delta_cents', { mode: 'number' }).notNull(),
  refTable: varchar('ref_table', { length: 40 }),
  refId: bigint('ref_id', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Export all relations
export const relations = {
  // Add relations here as needed
};

