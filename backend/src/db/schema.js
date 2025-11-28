import {
  bigint,
  boolean,
  char,
  date,
  datetime,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
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
export const productCategories = mysqlTable('categories', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  name: varchar('name', { length: 120 }).notNull(),
  parentId: bigint('parent_id', { mode: 'number' }),
  caracter: varchar('caracter', { length: 1 }),
});

export const products = mysqlTable('products', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  sku: varchar('sku', { length: 64 }),
  name: varchar('name', { length: 240 }).notNull(),
  description: text('description'),
  categoryId: bigint('category_id', { mode: 'number' }),
  uom: varchar('uom', { length: 16 }).default('ea'),
  taxable: boolean('taxable').default(true),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const productCodes = mysqlTable('product_codes', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  productId: bigint('product_id', { mode: 'number' }).notNull(),
  code: varchar('code', { length: 64 }).unique().notNull(),
  name: varchar('name', { length: 200 }),
  sku: varchar('sku', { length: 60 }),
  description: text('description'),
  categoryId: bigint('category_id', { mode: 'number' }),
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
  reorderPoint: int('reorder_point').default(0),
  reorderQty: int('reorder_qty').default(0),
  binLocation: varchar('bin_location', { length: 120 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const productCodeComponents = mysqlTable(
  'product_code_components',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    parentCodeId: bigint('parent_code_id', { mode: 'number' }).notNull(),
    childCodeId: bigint('child_code_id', { mode: 'number' }).notNull(),
    qtyRatio: decimal('qty_ratio', { precision: 18, scale: 6 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
  },
  (table) => ({
    componentUnique: uniqueIndex('uniq_component').on(table.parentCodeId, table.childCodeId),
  }),
);

export const inventoryCountSessions = mysqlTable('inv_count_sessions', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  locationScope: varchar('location_scope', { length: 200 }),
  startDate: date('start_date'),
  dueDate: date('due_date'),
  freezeMovements: boolean('freeze_movements').default(false),
  scope: mysqlEnum('scope', ['full', 'cycle']).notNull().default('cycle'),
  status: mysqlEnum('status', ['open', 'review', 'posted', 'cancelled']).notNull().default('open'),
  snapshotAt: timestamp('snapshot_at').defaultNow(),
  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  postedBy: bigint('posted_by', { mode: 'number' }),
  postedAt: timestamp('posted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const inventoryCountLines = mysqlTable('inv_count_lines', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  sessionId: bigint('session_id', { mode: 'number' }).notNull(),
  productCodeVersionId: bigint('product_code_version_id', { mode: 'number' }).notNull(),
  expectedQty: decimal('expected_qty', { precision: 18, scale: 4 }).notNull(),
  countedQty: decimal('counted_qty', { precision: 18, scale: 4 }).notNull(),
  status: mysqlEnum('status', ['counted', 'recount', 'resolved']).notNull().default('counted'),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const inventoryCountAssignments = mysqlTable(
  'inv_count_assignments',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    sessionId: bigint('session_id', { mode: 'number' }).notNull(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    deviceLabel: varchar('device_label', { length: 120 }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqAssignment: uniqueIndex('uniq_session_user').on(table.sessionId, table.userId),
  }),
);

export const inventoryTransfers = mysqlTable('inv_transfers', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  fromBranchId: bigint('from_branch_id', { mode: 'number' }).notNull(),
  toBranchId: bigint('to_branch_id', { mode: 'number' }).notNull(),
  status: mysqlEnum('status', ['draft', 'approved', 'shipped', 'received', 'cancelled']).notNull().default('draft'),
  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  approvedBy: bigint('approved_by', { mode: 'number' }),
  shippedBy: bigint('shipped_by', { mode: 'number' }),
  receivedBy: bigint('received_by', { mode: 'number' }),
  shippedAt: timestamp('shipped_at'),
  receivedAt: timestamp('received_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const inventoryTransferLines = mysqlTable('inv_transfer_lines', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  transferId: bigint('transfer_id', { mode: 'number' }).notNull(),
  productCodeVersionId: bigint('product_code_version_id', { mode: 'number' }).notNull(),
  qty: decimal('qty', { precision: 18, scale: 4 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const inventoryQuarantines = mysqlTable('quarantine', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  productCodeVersionId: bigint('product_code_version_id', { mode: 'number' }).notNull(),
  qty: decimal('qty', { precision: 18, scale: 4 }).notNull(),
  reason: text('reason'),
  status: mysqlEnum('status', ['open', 'resolved']).notNull().default('open'),
  outcome: mysqlEnum('outcome', ['return', 'dispose']).default('return'),
  createdBy: bigint('created_by', { mode: 'number' }),
  resolvedBy: bigint('resolved_by', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
});

// ========= CASH & SHIFTS =========
export const shifts = mysqlTable('shifts', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  openedBy: bigint('opened_by', { mode: 'number' }).notNull(),
  closedBy: bigint('closed_by', { mode: 'number' }),
  openingCashCents: bigint('opening_cash_cents', { mode: 'number' }).notNull(),
  closingCashCents: bigint('closing_cash_cents', { mode: 'number' }),
  expectedCashCents: bigint('expected_cash_cents', { mode: 'number' }),
  overShortCents: bigint('over_short_cents', { mode: 'number' }),
  openedAt: timestamp('opened_at').defaultNow(),
  closedAt: timestamp('closed_at'),
});

export const shiftReports = mysqlTable('shift_reports', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  shiftId: bigint('shift_id', { mode: 'number' }).notNull(),
  snapshot: json('snapshot').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const cashMovements = mysqlTable('cash_movements', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  shiftId: bigint('shift_id', { mode: 'number' }).notNull(),
  kind: mysqlEnum('kind', ['deposit', 'cash_to_safe', 'drop', 'paid_in', 'paid_out', 'refund', 'expense', 'income']).notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  reason: text('reason'),
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
  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const orderItems = mysqlTable('order_items', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  orderId: bigint('order_id', { mode: 'number' }).notNull(),
  codeId: bigint('code_id', { mode: 'number' }).notNull(),
  qty: decimal('qty', { precision: 18, scale: 4 }).notNull(),
  priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
  discountCents: bigint('discount_cents', { mode: 'number' }).default(0),
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

export const salesReturns = mysqlTable('sales_returns', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  invoiceId: bigint('invoice_id', { mode: 'number' }).notNull(),
  orderId: bigint('order_id', { mode: 'number' }).notNull(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  customerId: bigint('customer_id', { mode: 'number' }),
  createdBy: bigint('created_by', { mode: 'number' }),
  refundMethod: mysqlEnum('refund_method', ['cash', 'store_credit']).notNull(),
  totalRefundCents: bigint('total_refund_cents', { mode: 'number' }).notNull(),
  restockValueCents: bigint('restock_value_cents', { mode: 'number' }).default(0),
  reason: text('reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const salesReturnItems = mysqlTable('sales_return_items', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  salesReturnId: bigint('sales_return_id', { mode: 'number' }).notNull(),
  orderItemId: bigint('order_item_id', { mode: 'number' }).notNull(),
  productCodeVersionId: bigint('product_code_version_id', { mode: 'number' }).notNull(),
  qty: int('qty').notNull(),
  unitPriceCents: bigint('unit_price_cents', { mode: 'number' }).notNull(),
  taxCents: bigint('tax_cents', { mode: 'number' }).default(0),
  restock: boolean('restock').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// ========= CUSTOMERS =========
export const customers = mysqlTable('customers', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  firstName: varchar('first_name', { length: 80 }).notNull(),
  lastName: varchar('last_name', { length: 80 }).notNull(),
  cedulaNo: varchar('cedula_no', { length: 20 }),
  email: varchar('email', { length: 190 }),
  phone: varchar('phone', { length: 40 }),
  address: text('address'),
  dateOfBirth: date('date_of_birth'),
  isBlacklisted: boolean('is_blacklisted').default(false),
  loyaltyPoints: int('loyalty_points').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const idImages = mysqlTable('id_images', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull(),
  storagePath: varchar('storage_path', { length: 512 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const idImageUploadTokens = mysqlTable(
  'id_image_upload_tokens',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    path: varchar('path', { length: 512 }).notNull(),
    signature: varchar('signature', { length: 128 }).notNull(),
    expiresAt: datetime('expires_at').notNull(),
    issuedTo: bigint('issued_to', { mode: 'number' }),
    issuedAt: timestamp('issued_at').defaultNow(),
    usedAt: timestamp('used_at'),
  },
  (table) => ({
    pathUnique: uniqueIndex('uniq_id_image_upload_path').on(table.path),
  })
);

export const customerNotes = mysqlTable('customer_notes', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull(),
  authorId: bigint('author_id', { mode: 'number' }),
  note: text('note').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const reviews = mysqlTable('reviews', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  source: mysqlEnum('source', ['google', 'facebook', 'internal', 'other']).default('other'),
  author: varchar('author', { length: 160 }),
  rating: int('rating').notNull(),
  comment: text('comment'),
  status: mysqlEnum('status', ['new', 'approved', 'hidden']).default('new'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const loyaltyLedger = mysqlTable('loyalty_ledger', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull(),
  pointsDelta: int('points_delta').notNull(),
  reason: varchar('reason', { length: 160 }),
  refTable: varchar('ref_table', { length: 80 }),
  refId: bigint('ref_id', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ========= LOANS/PAWNS =========
export const loans = mysqlTable('loans', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull(),
  ticketNumber: varchar('ticket_number', { length: 40 }).unique().notNull(),
  principalCents: bigint('principal_cents', { mode: 'number' }).notNull(),
  interestModelId: bigint('interest_model_id', { mode: 'number' }).notNull(),
  interestRate: decimal('interest_rate', { precision: 5, scale: 4 }).notNull(),
  dueDate: date('due_date').notNull(),
  status: mysqlEnum('status', ['active', 'renewed', 'redeemed', 'forfeited']).default('active'),
  comments: text('comments'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const interestModels = mysqlTable('interest_models', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  rateType: mysqlEnum('rate_type', ['flat', 'simple', 'compound']).default('simple'),
  periodDays: int('period_days').default(30).notNull(),
  interestRateBps: int('interest_rate_bps').notNull(),
  graceDays: int('grace_days').default(0),
  minPrincipalCents: bigint('min_principal_cents', { mode: 'number' }).default(0),
  maxPrincipalCents: bigint('max_principal_cents', { mode: 'number' }),
  lateFeeBps: int('late_fee_bps').default(0),
  defaultTermCount: int('default_term_count').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const interestModelCategories = mysqlTable(
  'interest_model_categories',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
    interestModelId: bigint('interest_model_id', { mode: 'number' }).notNull(),
    categoryId: bigint('category_id', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqInterestModelCategory: uniqueIndex('uniq_interest_model_category').on(table.interestModelId, table.categoryId),
  })
);

export const loanCollateral = mysqlTable('loan_collateral', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  loanId: bigint('loan_id', { mode: 'number' }).notNull(),
  description: text('description').notNull(),
  estimatedValueCents: bigint('estimated_value_cents', { mode: 'number' }),
  photoPath: varchar('photo_path', { length: 512 }),
});

export const loanSchedules = mysqlTable('loan_schedules', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  loanId: bigint('loan_id', { mode: 'number' }).notNull(),
  dueOn: date('due_on').notNull(),
  interestCents: bigint('interest_cents', { mode: 'number' }).notNull(),
  feeCents: bigint('fee_cents', { mode: 'number' }).default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const loanPayments = mysqlTable('loan_payments', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  loanId: bigint('loan_id', { mode: 'number' }).notNull(),
  kind: mysqlEnum('kind', ['interest', 'advance', 'redeem', 'renew', 'extension']).notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  method: mysqlEnum('method', ['cash', 'card', 'transfer']).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const loanForfeitures = mysqlTable('loan_forfeitures', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  loanId: bigint('loan_id', { mode: 'number' }).notNull(),
  codeId: bigint('code_id', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const instapawnIntakes = mysqlTable('instapawn_intakes', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  customerFirstName: varchar('customer_first_name', { length: 120 }).notNull(),
  customerLastName: varchar('customer_last_name', { length: 120 }),
  customerPhone: varchar('customer_phone', { length: 40 }).notNull(),
  customerEmail: varchar('customer_email', { length: 190 }),
  governmentId: varchar('government_id', { length: 32 }),
  itemCategory: varchar('item_category', { length: 120 }),
  itemDescription: text('item_description').notNull(),
  collateral: json('collateral'),
  requestedPrincipalCents: bigint('requested_principal_cents', { mode: 'number' }),
  autoAppraisedValueCents: bigint('auto_appraised_value_cents', { mode: 'number' }),
  interestModelId: bigint('interest_model_id', { mode: 'number' }),
  notes: text('notes'),
  status: mysqlEnum('status', ['pending', 'notified', 'converted', 'expired', 'cancelled']).default('pending'),
  barcodeToken: char('barcode_token', { length: 32 }).notNull().unique(),
  barcodeExpiresAt: datetime('barcode_expires_at').notNull(),
  barcodeScannedAt: datetime('barcode_scanned_at'),
  notifiedAt: datetime('notified_at'),
  convertedLoanId: bigint('converted_loan_id', { mode: 'number' }),
  convertedAt: datetime('converted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const notificationMessages = mysqlTable('notification_messages', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  intakeId: bigint('intake_id', { mode: 'number' }),
  loanId: bigint('loan_id', { mode: 'number' }),
  repairId: bigint('repair_id', { mode: 'number' }),
  customerId: bigint('customer_id', { mode: 'number' }),
  channel: mysqlEnum('channel', ['sms', 'whatsapp', 'email']).notNull(),
  recipient: varchar('recipient', { length: 120 }).notNull(),
  message: text('message').notNull(),
  status: mysqlEnum('status', ['pending', 'sent', 'failed']).default('pending'),
  error: text('error'),
  sentAt: datetime('sent_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ========= LAYAWAYS =========
export const layaways = mysqlTable('layaways', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull(),
  orderId: bigint('order_id', { mode: 'number' }).notNull(),
  status: mysqlEnum('status', ['active', 'completed', 'cancelled', 'pawned']).default('active'),
  totalCents: bigint('total_cents', { mode: 'number' }).notNull(),
  paidCents: bigint('paid_cents', { mode: 'number' }).default(0),
  dueDate: datetime('due_date').notNull(),
  pawnLoanId: bigint('pawn_loan_id', { mode: 'number' }),
  pawnedAt: datetime('pawned_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const layawayPayments = mysqlTable('layaway_payments', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  layawayId: bigint('layaway_id', { mode: 'number' }).notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  method: mysqlEnum('method', ['cash', 'card', 'transfer']).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ========= REPAIRS =========
export const repairs = mysqlTable('repairs', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull(),
  jobNumber: varchar('job_number', { length: 40 }).unique().notNull(),
  itemDescription: text('item_description'),
  issueDescription: text('issue_description'),
  diagnosis: text('diagnosis'),
  estimateCents: bigint('estimate_cents', { mode: 'number' }).default(0),
  depositCents: bigint('deposit_cents', { mode: 'number' }).default(0),
  approvalStatus: mysqlEnum('approval_status', ['not_requested', 'pending', 'approved', 'denied']).default('not_requested'),
  approvalRequestedAt: timestamp('approval_requested_at'),
  approvalDecisionAt: timestamp('approval_decision_at'),
  status: mysqlEnum('status', [
    'intake',
    'diagnosing',
    'waiting_approval',
    'in_progress',
    'qa',
    'ready',
    'completed',
    'cancelled',
  ]).default('intake'),
  promisedAt: timestamp('promised_at'),
  totalPaidCents: bigint('total_paid_cents', { mode: 'number' }).default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const repairPhotos = mysqlTable('repair_photos', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  repairId: bigint('repair_id', { mode: 'number' }).notNull(),
  storagePath: varchar('storage_path', { length: 512 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const repairPayments = mysqlTable('repair_payments', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  repairId: bigint('repair_id', { mode: 'number' }).notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  method: mysqlEnum('method', ['cash', 'card', 'transfer', 'store_credit', 'other']).default('cash'),
  reference: varchar('reference', { length: 120 }),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const repairMaterials = mysqlTable('repair_materials', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  repairId: bigint('repair_id', { mode: 'number' }).notNull(),
  productCodeVersionId: bigint('product_code_version_id', { mode: 'number' }).notNull(),
  qtyIssued: int('qty_issued').default(0).notNull(),
  qtyReturned: int('qty_returned').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// ========= STOCK LEDGER =========
export const stockLedger = mysqlTable('stock_ledger', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  productCodeVersionId: bigint('product_code_version_id', { mode: 'number' }).notNull(),
  reason: mysqlEnum('reason', [
    'sale',
    'purchase',
    'count_post',
    'transfer_in',
    'transfer_out',
    'pawn_forfeit_in',
    'return',
    'adjustment',
    'quarantine_in',
    'quarantine_out',
    'split_out',
    'split_in',
    'combine_out',
    'combine_in',
    'repair_issue',
    'repair_return',
  ]).notNull(),
  qtyChange: int('qty_change').notNull(),
  refId: bigint('ref_id', { mode: 'number' }),
  refTable: varchar('ref_table', { length: 40 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const purchases = mysqlTable('purchases', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  supplierName: varchar('supplier_name', { length: 160 }),
  supplierInvoice: varchar('supplier_invoice', { length: 80 }),
  referenceNo: varchar('reference_no', { length: 80 }),
  receivedAt: datetime('received_at'),
  createdBy: bigint('created_by', { mode: 'number' }),
  totalCostCents: bigint('total_cost_cents', { mode: 'number' }).default(0).notNull(),
  totalQuantity: int('total_quantity').default(0).notNull(),
  labelLayout: varchar('label_layout', { length: 16 }),
  labelIncludePrice: boolean('label_include_price').default(true),
  labelCount: int('label_count').default(0),
  labelNote: varchar('label_note', { length: 140 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const purchaseLines = mysqlTable('purchase_lines', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  purchaseId: bigint('purchase_id', { mode: 'number' }).notNull(),
  productCodeVersionId: bigint('product_code_version_id', { mode: 'number' }).notNull(),
  quantity: int('quantity').notNull(),
  unitCostCents: bigint('unit_cost_cents', { mode: 'number' }).notNull(),
  lineTotalCents: bigint('line_total_cents', { mode: 'number' }).notNull(),
  labelQuantity: int('label_quantity').default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const purchaseReturns = mysqlTable('purchase_returns', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  purchaseId: bigint('purchase_id', { mode: 'number' }).notNull(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  supplierName: varchar('supplier_name', { length: 160 }),
  supplierInvoice: varchar('supplier_invoice', { length: 80 }),
  reason: text('reason'),
  notes: text('notes'),
  createdBy: bigint('created_by', { mode: 'number' }),
  totalQuantity: int('total_quantity').default(0).notNull(),
  totalCostCents: bigint('total_cost_cents', { mode: 'number' }).default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const purchaseReturnLines = mysqlTable('purchase_return_lines', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  purchaseReturnId: bigint('purchase_return_id', { mode: 'number' }).notNull(),
  purchaseLineId: bigint('purchase_line_id', { mode: 'number' }).notNull(),
  productCodeVersionId: bigint('product_code_version_id', { mode: 'number' }).notNull(),
  quantity: int('quantity').notNull(),
  unitCostCents: bigint('unit_cost_cents', { mode: 'number' }).notNull(),
  lineTotalCents: bigint('line_total_cents', { mode: 'number' }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const suppliers = mysqlTable('suppliers', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  name: varchar('name', { length: 160 }).notNull().unique(),
  taxId: varchar('tax_id', { length: 40 }),
  contact: varchar('contact', { length: 120 }),
  phone: varchar('phone', { length: 40 }),
  email: varchar('email', { length: 190 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const supplierCredits = mysqlTable('supplier_credits', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  branchId: bigint('branch_id', { mode: 'number' }).notNull(),
  supplierId: bigint('supplier_id', { mode: 'number' }),
  supplierName: varchar('supplier_name', { length: 160 }),
  supplierInvoice: varchar('supplier_invoice', { length: 80 }),
  purchaseId: bigint('purchase_id', { mode: 'number' }),
  purchaseReturnId: bigint('purchase_return_id', { mode: 'number' }),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  balanceCents: bigint('balance_cents', { mode: 'number' }).notNull(),
  reason: text('reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const supplierCreditLedger = mysqlTable('supplier_credit_ledger', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  supplierCreditId: bigint('supplier_credit_id', { mode: 'number' }).notNull(),
  deltaCents: bigint('delta_cents', { mode: 'number' }).notNull(),
  referenceType: varchar('reference_type', { length: 40 }),
  referenceId: bigint('reference_id', { mode: 'number' }),
  reason: text('reason'),
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

// ========= MARKETING =========
export const marketingTemplates = mysqlTable('marketing_templates', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  name: varchar('name', { length: 160 }).notNull(),
  channel: mysqlEnum('channel', ['sms', 'whatsapp', 'email']).notNull().default('sms'),
  subject: varchar('subject', { length: 180 }),
  body: text('body').notNull(),
  variables: json('variables'),
  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  updatedBy: bigint('updated_by', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const marketingSegments = mysqlTable('marketing_segments', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),
  filters: json('filters'),
  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  updatedBy: bigint('updated_by', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const marketingCampaigns = mysqlTable('marketing_campaigns', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  templateId: bigint('template_id', { mode: 'number' }).notNull(),
  segmentId: bigint('segment_id', { mode: 'number' }).notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  scheduledAt: datetime('scheduled_at'),
  status: mysqlEnum('status', ['draft', 'scheduled', 'sending', 'completed', 'failed']).default('draft'),
  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const marketingSends = mysqlTable('marketing_sends', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  campaignId: bigint('campaign_id', { mode: 'number' }).notNull(),
  customerId: bigint('customer_id', { mode: 'number' }).notNull(),
  notificationId: bigint('notification_id', { mode: 'number' }),
  channel: mysqlEnum('channel', ['sms', 'whatsapp', 'email']).notNull(),
  status: mysqlEnum('status', ['pending', 'sent', 'failed']).default('pending'),
  error: text('error'),
  sentAt: datetime('sent_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ========= E-COMMERCE =========
export const ecomChannels = mysqlTable('ecom_channels', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  name: varchar('name', { length: 120 }).notNull(),
  provider: mysqlEnum('provider', ['shopify', 'woocommerce', 'amazon', 'ebay', 'custom']).notNull(),
  status: mysqlEnum('status', ['disconnected', 'connected', 'error']).default('disconnected'),
  config: json('config'),
  branchId: bigint('branch_id', { mode: 'number' }),
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const ecomChannelLogs = mysqlTable('ecom_channel_logs', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  channelId: bigint('channel_id', { mode: 'number' }).notNull(),
  operation: mysqlEnum('operation', ['sync_listings', 'sync_orders', 'sync_inventory', 'webhook']).notNull(),
  status: mysqlEnum('status', ['success', 'error', 'partial']).notNull(),
  recordsProcessed: int('records_processed').default(0),
  recordsFailed: int('records_failed').default(0),
  errorMessage: text('error_message'),
  metadata: json('metadata'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const ecomWebhookLogs = mysqlTable('ecom_webhook_logs', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  channelId: bigint('channel_id', { mode: 'number' }).notNull(),
  eventType: varchar('event_type', { length: 60 }).notNull(),
  payload: json('payload').notNull(),
  processed: boolean('processed').default(false),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const ecomListings = mysqlTable('ecom_listings', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  productCodeId: bigint('product_code_id', { mode: 'number' }).notNull(),
  channelId: bigint('channel_id', { mode: 'number' }).notNull(),
  externalId: varchar('external_id', { length: 160 }),
  title: varchar('title', { length: 240 }).notNull(),
  description: text('description'),
  priceCents: bigint('price_cents', { mode: 'number' }),
  status: mysqlEnum('status', ['draft', 'active', 'inactive', 'archived']).default('draft'),
  seoSlug: varchar('seo_slug', { length: 200 }),
  metaDescription: text('meta_description'),
  primaryImageUrl: varchar('primary_image_url', { length: 500 }),
  imageUrls: json('image_urls'),
  categoryMapping: json('category_mapping'),
  attributes: json('attributes'),
  syncStatus: mysqlEnum('sync_status', ['pending', 'synced', 'error']).default('pending'),
  lastSyncedAt: timestamp('last_synced_at'),
  syncError: text('sync_error'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const ecomListingChannels = mysqlTable('ecom_listing_channels', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  listingId: bigint('listing_id', { mode: 'number' }).notNull(),
  channelId: bigint('channel_id', { mode: 'number' }).notNull(),
  channelListingId: varchar('channel_listing_id', { length: 120 }),
  lastSyncedAt: datetime('last_synced_at'),
  status: mysqlEnum('status', ['pending', 'synced', 'error']).default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const ecomOrders = mysqlTable('ecom_orders', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  channelId: bigint('channel_id', { mode: 'number' }).notNull(),
  externalId: varchar('external_id', { length: 160 }).notNull(),
  customerName: varchar('customer_name', { length: 160 }).notNull(),
  customerEmail: varchar('customer_email', { length: 255 }),
  status: mysqlEnum('status', ['pending', 'paid', 'fulfilled', 'cancelled', 'refunded']).default('pending'),
  paymentStatus: mysqlEnum('payment_status', ['unpaid', 'partial', 'paid', 'refunded']).default('unpaid'),
  shippingAddress: json('shipping_address'),
  billingAddress: json('billing_address'),
  subtotalCents: bigint('subtotal_cents', { mode: 'number' }).notNull(),
  taxCents: bigint('tax_cents', { mode: 'number' }).default(0),
  shippingCents: bigint('shipping_cents', { mode: 'number' }).default(0),
  totalCents: bigint('total_cents', { mode: 'number' }).notNull(),
  currency: char('currency', { length: 3 }).default('DOP'),
  internalOrderId: bigint('internal_order_id', { mode: 'number' }),
  trackingNumber: varchar('tracking_number', { length: 120 }),
  shippingCarrier: varchar('shipping_carrier', { length: 60 }),
  fulfillmentStatus: mysqlEnum('fulfillment_status', ['unfulfilled', 'picking', 'packed', 'shipped']).default('unfulfilled'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const ecomOrderItems = mysqlTable('ecom_order_items', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  ecomOrderId: bigint('ecom_order_id', { mode: 'number' }).notNull(),
  listingId: bigint('listing_id', { mode: 'number' }),
  productCodeId: bigint('product_code_id', { mode: 'number' }),
  externalItemId: varchar('external_item_id', { length: 160 }),
  quantity: int('quantity').notNull(),
  priceCents: bigint('price_cents', { mode: 'number' }).notNull(),
  sku: varchar('sku', { length: 64 }),
  title: varchar('title', { length: 240 }),
  allocatedBranchId: bigint('allocated_branch_id', { mode: 'number' }),
  allocatedVersionId: bigint('allocated_version_id', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const ecomReturns = mysqlTable('ecom_returns', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  ecomOrderId: bigint('ecom_order_id', { mode: 'number' }).notNull(),
  externalRmaId: varchar('external_rma_id', { length: 160 }),
  status: mysqlEnum('status', ['requested', 'approved', 'denied', 'received', 'refunded']).default('requested'),
  reason: text('reason'),
  refundMethod: mysqlEnum('refund_method', ['original', 'store_credit', 'manual']).default('original'),
  refundCents: bigint('refund_cents', { mode: 'number' }),
  restockCondition: mysqlEnum('restock_condition', ['new', 'used', 'damaged', 'not_restockable']),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

export const ecomReturnItems = mysqlTable('ecom_return_items', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  ecomReturnId: bigint('ecom_return_id', { mode: 'number' }).notNull(),
  ecomOrderItemId: bigint('ecom_order_item_id', { mode: 'number' }).notNull(),
  quantity: int('quantity').notNull(),
  condition: mysqlEnum('condition', ['new', 'used', 'damaged', 'not_restockable']),
  restocked: boolean('restocked').default(false),
  restockVersionId: bigint('restock_version_id', { mode: 'number' }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ========= SECURITY & AUDIT =========
export const auditLogs = mysqlTable('audit_logs', {
  id: bigint('id', { mode: 'number' }).primaryKey().autoincrement(),
  actorId: bigint('actor_id', { mode: 'number' }),
  action: varchar('action', { length: 160 }).notNull(),
  resourceType: varchar('resource_type', { length: 120 }).notNull(),
  resourceId: bigint('resource_id', { mode: 'number' }),
  payload: json('payload'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ========= TABLE ALIASES FOR SELF-JOINS =========
// Note: These are just references. For actual self-joins in queries,
// use separate queries or raw SQL to avoid alias conflicts.
export const fromBranchAlias = branches;
export const toBranchAlias = branches;
export const componentParentCodes = productCodes;
export const componentChildCodes = productCodes;
export const shiftOpenedByUsers = users;
export const shiftClosedByUsers = users;

// Export all relations
export const relations = {
  // Add relations here as needed
};

