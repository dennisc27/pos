-- schema.sql (enhanced to fully support task_ui.v3.yaml)
-- MySQL 8.x

-- ========== BASE CONVENTIONS ==========
-- id BIGINT AUTO_INCREMENT PRIMARY KEY; created_at/updated_at; soft-delete via deleted_at where needed.
-- Money stored as *_cents BIGINT. All foreign keys indexed.

-- ========= ORG & AUTH =========
CREATE TABLE IF NOT EXISTS branches (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  address TEXT, phone VARCHAR(40),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name ENUM('cashier','seller','manager','marketing','admin') UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  email VARCHAR(190) UNIQUE,
  phone VARCHAR(40),
  full_name VARCHAR(140) NOT NULL,
  pin_hash VARBINARY(128),
  role_id BIGINT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ========= SETTINGS (GLOBAL/BRANCH/USER) =========
CREATE TABLE IF NOT EXISTS settings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  scope ENUM('global','branch','user') NOT NULL DEFAULT 'global',
  branch_id BIGINT NULL,
  user_id BIGINT NULL,
  k VARCHAR(160) NOT NULL,
  v JSON NOT NULL,
  UNIQUE KEY uniq_setting (scope, COALESCE(branch_id,0), COALESCE(user_id,0), k),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ========= CRM =========
CREATE TABLE IF NOT EXISTS customers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  document_no VARCHAR(64),
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(190), phone VARCHAR(40),
  blacklist BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS id_images (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  storage_path VARCHAR(512) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS contact_channels (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  channel ENUM('whatsapp','email','sms') NOT NULL,
  opted_in BOOLEAN DEFAULT TRUE,
  last_opt_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_contact_channel (customer_id, channel),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  points_delta INT NOT NULL,
  reason VARCHAR(160),
  ref_table VARCHAR(40), ref_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source ENUM('google','facebook','internal','other') DEFAULT 'other',
  author VARCHAR(160),
  rating TINYINT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  status ENUM('new','approved','hidden') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========= CATALOG & INVENTORY =========
CREATE TABLE IF NOT EXISTS categories (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  parent_id BIGINT NULL,
  name VARCHAR(120) NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS products (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(64) UNIQUE,
  name VARCHAR(240) NOT NULL,
  description TEXT,
  category_id BIGINT,
  uom VARCHAR(16) DEFAULT 'ea',
  taxable BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- price/cost version per sellable code
CREATE TABLE IF NOT EXISTS product_codes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT NOT NULL,
  code VARCHAR(64) UNIQUE NOT NULL,
  cost_cents BIGINT NOT NULL,
  price_cents BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- lineage for split/combine
CREATE TABLE IF NOT EXISTS product_code_components (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  parent_code_id BIGINT NOT NULL,
  child_code_id BIGINT NOT NULL,
  qty_ratio DECIMAL(18,6) NOT NULL, -- how many child units form the parent
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_component (parent_code_id, child_code_id),
  FOREIGN KEY (parent_code_id) REFERENCES product_codes(id),
  FOREIGN KEY (child_code_id) REFERENCES product_codes(id)
);

CREATE TABLE IF NOT EXISTS stock_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  code_id BIGINT NOT NULL,
  qty DECIMAL(18,4) NOT NULL,
  reason ENUM('init','purchase','sale','sale_return','transfer_in','transfer_out','adjust_add','adjust_sub','pawn_forfeit_in','write_off','quarantine_in','quarantine_out','count_post') NOT NULL,
  ref_table VARCHAR(40), ref_id BIGINT,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (code_id) REFERENCES product_codes(id),
  INDEX (branch_id, code_id, created_at)
);

-- inventory counts
CREATE TABLE IF NOT EXISTS inv_count_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  scope ENUM('full','cycle') DEFAULT 'cycle',
  status ENUM('open','review','posted','cancelled') DEFAULT 'open',
  snapshot_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT NOT NULL,
  posted_by BIGINT NULL,
  posted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS inv_count_lines (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  code_id BIGINT NOT NULL,
  expected_qty DECIMAL(18,4) NOT NULL,
  counted_qty DECIMAL(18,4) NOT NULL,
  variance DECIMAL(18,4) AS (counted_qty - expected_qty) STORED,
  status ENUM('counted','recount','resolved') DEFAULT 'counted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES inv_count_sessions(id),
  FOREIGN KEY (code_id) REFERENCES product_codes(id)
);

-- transfers
CREATE TABLE IF NOT EXISTS inv_transfers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  from_branch_id BIGINT NOT NULL,
  to_branch_id BIGINT NOT NULL,
  status ENUM('draft','approved','shipped','received','cancelled') DEFAULT 'draft',
  created_by BIGINT NOT NULL,
  approved_by BIGINT NULL,
  shipped_at TIMESTAMP NULL,
  received_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (from_branch_id) REFERENCES branches(id),
  FOREIGN KEY (to_branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS inv_transfer_lines (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  transfer_id BIGINT NOT NULL,
  code_id BIGINT NOT NULL,
  qty DECIMAL(18,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transfer_id) REFERENCES inv_transfers(id),
  FOREIGN KEY (code_id) REFERENCES product_codes(id)
);

CREATE TABLE IF NOT EXISTS quarantine (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  code_id BIGINT NOT NULL,
  reason TEXT,
  status ENUM('open','resolved') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (code_id) REFERENCES product_codes(id)
);

-- ========= POS / SALES =========
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  customer_id BIGINT NULL,
  status ENUM('pending','completed','cancelled') DEFAULT 'pending',
  payment_status ENUM('unpaid','partial','paid') DEFAULT 'unpaid',
  created_by BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  code_id BIGINT NOT NULL,
  qty DECIMAL(18,4) NOT NULL,
  price_cents BIGINT NOT NULL,
  discount_cents BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (code_id) REFERENCES product_codes(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  invoice_no VARCHAR(64) UNIQUE,
  total_cents BIGINT NOT NULL,
  tax_cents BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NULL,
  invoice_id BIGINT NULL,
  shift_id BIGINT NULL,
  method ENUM('cash','card','transfer','gift_card','credit_note') NOT NULL,
  amount_cents BIGINT NOT NULL,
  meta JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE TABLE IF NOT EXISTS sales_returns (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT NOT NULL,
  reason TEXT,
  condition ENUM('new','used','damaged') DEFAULT 'used',
  refund_method ENUM('cash','store_credit') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE TABLE IF NOT EXISTS sales_return_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sales_return_id BIGINT NOT NULL,
  code_id BIGINT NOT NULL,
  qty DECIMAL(18,4) NOT NULL,
  refund_cents BIGINT NOT NULL,
  FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id),
  FOREIGN KEY (code_id) REFERENCES product_codes(id)
);

-- ========= LOANS / PAWNS =========
CREATE TABLE IF NOT EXISTS loans (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  ticket_no VARCHAR(64) UNIQUE,
  principal_cents BIGINT NOT NULL,
  interest_model VARCHAR(64),
  due_date DATE NOT NULL,
  status ENUM('active','redeemed','forfeited') DEFAULT 'active',
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS loan_collateral (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  loan_id BIGINT NOT NULL,
  description TEXT NOT NULL,
  estimated_value_cents BIGINT,
  photo_path VARCHAR(512),
  FOREIGN KEY (loan_id) REFERENCES loans(id)
);

CREATE TABLE IF NOT EXISTS loan_schedules (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  loan_id BIGINT NOT NULL,
  due_on DATE NOT NULL,
  interest_cents BIGINT NOT NULL,
  fee_cents BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id) REFERENCES loans(id)
);

CREATE TABLE IF NOT EXISTS loan_payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  loan_id BIGINT NOT NULL,
  kind ENUM('interest','advance','redeem','renew','extension') NOT NULL,
  amount_cents BIGINT NOT NULL,
  method ENUM('cash','card','transfer') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id) REFERENCES loans(id)
);

CREATE TABLE IF NOT EXISTS loan_forfeitures (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  loan_id BIGINT NOT NULL,
  code_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id) REFERENCES loans(id),
  FOREIGN KEY (code_id) REFERENCES product_codes(id)
);

-- ========= LAYAWAY =========
CREATE TABLE IF NOT EXISTS layaways (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  order_id BIGINT NOT NULL,
  status ENUM('active','completed','cancelled','pawned') DEFAULT 'active',
  pawn_loan_id BIGINT NULL,
  pawned_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (pawn_loan_id) REFERENCES loans(id)
);

CREATE TABLE IF NOT EXISTS layaway_payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  layaway_id BIGINT NOT NULL,
  amount_cents BIGINT NOT NULL,
  method ENUM('cash','card','transfer') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (layaway_id) REFERENCES layaways(id)
);

-- ========= PURCHASES =========
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(190), phone VARCHAR(40),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  supplier_id BIGINT NOT NULL,
  invoice_no VARCHAR(64),
  status ENUM('open','posted') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  purchase_id BIGINT NOT NULL,
  code_id BIGINT NOT NULL,
  qty DECIMAL(18,4) NOT NULL,
  cost_cents BIGINT NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id),
  FOREIGN KEY (code_id) REFERENCES product_codes(id)
);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  purchase_id BIGINT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id)
);

-- ========= REPAIRS / FAB =========
CREATE TABLE IF NOT EXISTS repairs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  status ENUM('intake','waiting_approval','in_progress','ready','picked_up','cancelled') DEFAULT 'intake',
  diagnosis TEXT,
  estimate_cents BIGINT,
  paid BOOLEAN DEFAULT FALSE,
  approval BOOLEAN NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS repair_materials (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  repair_id BIGINT NOT NULL,
  code_id BIGINT NOT NULL,
  qty_issued DECIMAL(18,4) NOT NULL,
  qty_returned DECIMAL(18,4) DEFAULT 0,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  returned_at TIMESTAMP NULL,
  FOREIGN KEY (repair_id) REFERENCES repairs(id),
  FOREIGN KEY (code_id) REFERENCES product_codes(id)
);

-- ========= CASH / SHIFTS =========
CREATE TABLE IF NOT EXISTS shifts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  opened_by BIGINT NOT NULL,
  closed_by BIGINT NULL,
  opening_cash_cents BIGINT NOT NULL,
  closing_cash_cents BIGINT NULL,
  expected_cash_cents BIGINT NULL,
  over_short_cents BIGINT NULL,
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS shift_reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shift_id BIGINT NOT NULL,
  snapshot JSON NOT NULL, -- persisted Z-report
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shift_id) REFERENCES shifts(id)
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shift_id BIGINT NOT NULL,
  kind ENUM('deposit','cash_to_safe','drop','paid_in','paid_out','refund','expense','income') NOT NULL,
  amount_cents BIGINT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shift_id) REFERENCES shifts(id)
);

-- ========= GIFT CARDS & CREDIT NOTES =========
CREATE TABLE IF NOT EXISTS gift_cards (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL,
  balance_cents BIGINT NOT NULL,
  expires_on DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gift_card_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  gift_card_id BIGINT NOT NULL,
  delta_cents BIGINT NOT NULL,
  ref_table VARCHAR(40), ref_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id)
);

CREATE TABLE IF NOT EXISTS credit_notes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  balance_cents BIGINT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS credit_note_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  credit_note_id BIGINT NOT NULL,
  delta_cents BIGINT NOT NULL,
  ref_table VARCHAR(40), ref_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id)
);

-- ========= MARKETING =========
CREATE TABLE IF NOT EXISTS mkt_templates (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  channel ENUM('whatsapp','email','sms') NOT NULL,
  content TEXT NOT NULL,
  variables JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_segments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  filter_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mkt_campaigns (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  template_id BIGINT NOT NULL,
  segment_id BIGINT NOT NULL,
  scheduled_at TIMESTAMP NULL,
  status ENUM('draft','scheduled','sending','done','cancelled') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES mkt_templates(id),
  FOREIGN KEY (segment_id) REFERENCES mkt_segments(id)
);

CREATE TABLE IF NOT EXISTS mkt_sends (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  notification_id BIGINT NULL,
  status ENUM('queued','sent','failed') DEFAULT 'queued',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- ========= E-COMMERCE =========
CREATE TABLE IF NOT EXISTS ecom_channels (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(64) UNIQUE,
  status ENUM('active','disabled') DEFAULT 'active',
  last_sync TIMESTAMP NULL,
  error_count INT DEFAULT 0,
  config JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ecom_listings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code_id BIGINT NOT NULL,
  channel_id BIGINT NOT NULL,
  published BOOLEAN DEFAULT FALSE,
  title VARCHAR(240),
  description TEXT,
  slug VARCHAR(190),
  seo JSON,
  last_synced TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_listing (code_id, channel_id),
  FOREIGN KEY (code_id) REFERENCES product_codes(id),
  FOREIGN KEY (channel_id) REFERENCES ecom_channels(id)
);

CREATE TABLE IF NOT EXISTS ecom_orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  channel_id BIGINT NOT NULL,
  external_id VARCHAR(190) UNIQUE,
  customer_id BIGINT NULL,
  status ENUM('pending','picking','packed','shipped','cancelled') DEFAULT 'pending',
  shipping_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES ecom_channels(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS ecom_order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ecom_order_id BIGINT NOT NULL,
  code_id BIGINT NOT NULL,
  qty DECIMAL(18,4) NOT NULL,
  price_cents BIGINT NOT NULL,
  FOREIGN KEY (ecom_order_id) REFERENCES ecom_orders(id),
  FOREIGN KEY (code_id) REFERENCES product_codes(id)
);

CREATE TABLE IF NOT EXISTS ecom_shipments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ecom_order_id BIGINT NOT NULL,
  label_provider VARCHAR(64),
  tracking_no VARCHAR(190),
  status ENUM('created','shipped','delivered','cancelled') DEFAULT 'created',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ecom_order_id) REFERENCES ecom_orders(id)
);

CREATE TABLE IF NOT EXISTS ecom_returns (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ecom_order_id BIGINT NOT NULL,
  state ENUM('requested','approved','received','refunded','denied') DEFAULT 'requested',
  reason TEXT,
  refund_method ENUM('card','transfer','store_credit') NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ecom_order_id) REFERENCES ecom_orders(id)
);

CREATE TABLE IF NOT EXISTS ecom_return_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ecom_return_id BIGINT NOT NULL,
  code_id BIGINT NOT NULL,
  qty DECIMAL(18,4) NOT NULL,
  condition ENUM('new','used','damaged') DEFAULT 'used',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ecom_return_id) REFERENCES ecom_returns(id),
  FOREIGN KEY (code_id) REFERENCES product_codes(id)
);

CREATE TABLE IF NOT EXISTS ecom_webhook_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  channel_id BIGINT NOT NULL,
  event VARCHAR(120),
  payload JSON,
  status ENUM('ok','error') DEFAULT 'ok',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES ecom_channels(id)
);

-- ========= NOTIFICATIONS & COMPLIANCE =========
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  channel ENUM('whatsapp','email','sms') NOT NULL,
  to_ref VARCHAR(190) NOT NULL,
  template_key VARCHAR(64),
  payload JSON,
  status ENUM('queued','sent','failed') DEFAULT 'queued',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_stamps (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ref_table VARCHAR(40), ref_id BIGINT,
  camera_id VARCHAR(64),
  snapshot_path VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========= AUDIT =========
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT,
  action VARCHAR(64),
  entity VARCHAR(40),
  entity_id BIGINT,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========= INDEXES =========
CREATE INDEX IF NOT EXISTS idx_orders_branch_created ON orders(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loans_branch_status_due ON loans(branch_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_stock_branch_code ON stock_ledger(branch_id, code_id, created_at);
