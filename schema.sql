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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Note: Unique constraint across (scope, branch_id, user_id, k) should be enforced at application level
-- due to NULL handling complexity

-- ========= CRM =========
CREATE TABLE IF NOT EXISTS customers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  cedula_no VARCHAR(20),
  email VARCHAR(190),
  phone VARCHAR(40),
  address TEXT,
  date_of_birth DATE,
  is_blacklisted BOOLEAN DEFAULT FALSE,
  loyalty_points INT DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS id_image_upload_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  path VARCHAR(512) NOT NULL,
  signature VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  issued_to BIGINT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP NULL,
  UNIQUE KEY uniq_id_image_upload_path (path),
  FOREIGN KEY (issued_to) REFERENCES users(id)
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

CREATE TABLE IF NOT EXISTS customer_notes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  author_id BIGINT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
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
  caracter VARCHAR(1) NULL,
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
-- Note: The following columns (name, sku, description, category_id, updated_at) were added
-- to denormalize product data in product_codes for improved query performance in the inventory API
CREATE TABLE IF NOT EXISTS product_codes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT NOT NULL,
  code VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(200),
  sku VARCHAR(60),
  description TEXT,
  category_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- price/cost version per sellable code per branch
CREATE TABLE IF NOT EXISTS product_code_versions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_code_id BIGINT NOT NULL,
  branch_id BIGINT NOT NULL,
  price_cents BIGINT NOT NULL,
  cost_cents BIGINT,
  qty_on_hand INT DEFAULT 0,
  qty_reserved INT DEFAULT 0,
  reorder_point INT DEFAULT 0,
  reorder_qty INT DEFAULT 0,
  bin_location VARCHAR(120),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_code_id) REFERENCES product_codes(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

-- lineage for split/combine
CREATE TABLE IF NOT EXISTS product_code_components (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  parent_code_id BIGINT NOT NULL,
  child_code_id BIGINT NOT NULL,
  qty_ratio DECIMAL(18,6) NOT NULL, -- how many child units form the parent
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_component (parent_code_id, child_code_id),
  FOREIGN KEY (parent_code_id) REFERENCES product_codes(id),
  FOREIGN KEY (child_code_id) REFERENCES product_codes(id)
);

CREATE TABLE IF NOT EXISTS stock_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_code_version_id BIGINT NOT NULL,
  qty_change INT NOT NULL,
  reason ENUM('sale','purchase','count_post','transfer_in','transfer_out','pawn_forfeit_in','return','adjustment','quarantine_in','quarantine_out','split_out','split_in','combine_out','combine_in','repair_issue','repair_return') NOT NULL,
  ref_table VARCHAR(40),
  ref_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_code_version_id) REFERENCES product_code_versions(id),
  INDEX (product_code_version_id, created_at)
);

-- purchases & receiving
CREATE TABLE IF NOT EXISTS purchases (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  supplier_name VARCHAR(160),
  supplier_invoice VARCHAR(80),
  reference_no VARCHAR(80),
  received_at DATETIME,
  created_by BIGINT NULL,
  total_cost_cents BIGINT NOT NULL DEFAULT 0,
  total_quantity INT NOT NULL DEFAULT 0,
  label_layout VARCHAR(16),
  label_include_price BOOLEAN DEFAULT TRUE,
  label_count INT DEFAULT 0,
  label_note VARCHAR(140),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchase_lines (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  purchase_id BIGINT NOT NULL,
  product_code_version_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  unit_cost_cents BIGINT NOT NULL,
  line_total_cents BIGINT NOT NULL,
  label_quantity INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id),
  FOREIGN KEY (product_code_version_id) REFERENCES product_code_versions(id)
);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  purchase_id BIGINT NOT NULL,
  branch_id BIGINT NOT NULL,
  supplier_name VARCHAR(160),
  supplier_invoice VARCHAR(80),
  reason TEXT,
  notes TEXT,
  created_by BIGINT NULL,
  total_quantity INT NOT NULL DEFAULT 0,
  total_cost_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchase_return_lines (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  purchase_return_id BIGINT NOT NULL,
  purchase_line_id BIGINT NOT NULL,
  product_code_version_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  unit_cost_cents BIGINT NOT NULL,
  line_total_cents BIGINT NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id),
  FOREIGN KEY (purchase_line_id) REFERENCES purchase_lines(id),
  FOREIGN KEY (product_code_version_id) REFERENCES product_code_versions(id)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  tax_id VARCHAR(40),
  contact VARCHAR(120),
  phone VARCHAR(40),
  email VARCHAR(190),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_supplier_name (name)
);

CREATE TABLE IF NOT EXISTS supplier_credits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  supplier_id BIGINT NULL,
  supplier_name VARCHAR(160),
  supplier_invoice VARCHAR(80),
  purchase_id BIGINT NULL,
  purchase_return_id BIGINT NULL,
  amount_cents BIGINT NOT NULL,
  balance_cents BIGINT NOT NULL,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (purchase_id) REFERENCES purchases(id),
  FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id)
);

CREATE TABLE IF NOT EXISTS supplier_credit_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  supplier_credit_id BIGINT NOT NULL,
  delta_cents BIGINT NOT NULL,
  reference_type VARCHAR(40),
  reference_id BIGINT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_credit_id) REFERENCES supplier_credits(id)
);

-- inventory counts
CREATE TABLE IF NOT EXISTS inv_count_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  name VARCHAR(200) NOT NULL,
  location_scope VARCHAR(200) NULL,
  start_date DATE NULL,
  due_date DATE NULL,
  freeze_movements BOOLEAN DEFAULT FALSE,
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

CREATE TABLE IF NOT EXISTS inv_count_assignments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  device_label VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_session_user (session_id, user_id),
  FOREIGN KEY (session_id) REFERENCES inv_count_sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inv_count_lines (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  product_code_version_id BIGINT NOT NULL,
  expected_qty DECIMAL(18,4) NOT NULL,
  counted_qty DECIMAL(18,4) NOT NULL,
  status ENUM('counted','recount','resolved') DEFAULT 'counted',
  comment TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES inv_count_sessions(id),
  FOREIGN KEY (product_code_version_id) REFERENCES product_code_versions(id)
);

-- transfers
CREATE TABLE IF NOT EXISTS inv_transfers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  from_branch_id BIGINT NOT NULL,
  to_branch_id BIGINT NOT NULL,
  status ENUM('draft','approved','shipped','received','cancelled') DEFAULT 'draft',
  created_by BIGINT NOT NULL,
  approved_by BIGINT NULL,
  shipped_by BIGINT NULL,
  received_by BIGINT NULL,
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
  product_code_version_id BIGINT NOT NULL,
  qty DECIMAL(18,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transfer_id) REFERENCES inv_transfers(id),
  FOREIGN KEY (product_code_version_id) REFERENCES product_code_versions(id)
);

CREATE TABLE IF NOT EXISTS quarantine (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  product_code_version_id BIGINT NOT NULL,
  qty DECIMAL(18,4) NOT NULL,
  reason TEXT,
  status ENUM('open','resolved') DEFAULT 'open',
  outcome ENUM('return','dispose') DEFAULT 'return',
  created_by BIGINT NULL,
  resolved_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (product_code_version_id) REFERENCES product_code_versions(id)
);

-- ========= POS / SALES =========
-- Note: The following columns were added to align with Drizzle schema:
-- user_id, order_number, subtotal_cents, tax_cents, total_cents, updated_at
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  user_id BIGINT NULL,
  customer_id BIGINT NULL,
  order_number VARCHAR(40),
  status ENUM('pending','completed','cancelled') DEFAULT 'pending',
  payment_status ENUM('unpaid','partial','paid') DEFAULT 'unpaid',
  subtotal_cents BIGINT DEFAULT 0,
  tax_cents BIGINT DEFAULT 0,
  total_cents BIGINT DEFAULT 0,
  created_by BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
  order_id BIGINT NOT NULL,
  branch_id BIGINT NOT NULL,
  customer_id BIGINT NULL,
  created_by BIGINT NULL,
  refund_method ENUM('cash','store_credit') NOT NULL,
  total_refund_cents BIGINT NOT NULL,
  restock_value_cents BIGINT DEFAULT 0,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sales_return_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sales_return_id BIGINT NOT NULL,
  order_item_id BIGINT NOT NULL,
  product_code_version_id BIGINT NOT NULL,
  qty INT NOT NULL,
  unit_price_cents BIGINT NOT NULL,
  tax_cents BIGINT DEFAULT 0,
  restock BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id),
  FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  FOREIGN KEY (product_code_version_id) REFERENCES product_code_versions(id)
);

-- ========= LOANS / PAWNS =========
CREATE TABLE IF NOT EXISTS loans (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  ticket_number VARCHAR(64) UNIQUE,
  principal_cents BIGINT NOT NULL,
  interest_model_id BIGINT NOT NULL,
  interest_rate DECIMAL(5,4) NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('active','redeemed','forfeited','renewed') DEFAULT 'active',
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (interest_model_id) REFERENCES interest_models(id)
);

CREATE TABLE IF NOT EXISTS interest_models (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  rate_type ENUM('flat','simple','compound') DEFAULT 'simple',
  period_days INT NOT NULL DEFAULT 30,
  interest_rate_bps INT NOT NULL,
  grace_days INT DEFAULT 0,
  min_principal_cents BIGINT DEFAULT 0,
  max_principal_cents BIGINT NULL,
  late_fee_bps INT DEFAULT 0,
  default_term_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interest_model_categories (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  interest_model_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_interest_model_category (interest_model_id, category_id),
  FOREIGN KEY (interest_model_id) REFERENCES interest_models(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS instapawn_intakes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  customer_first_name VARCHAR(120) NOT NULL,
  customer_last_name VARCHAR(120),
  customer_phone VARCHAR(40) NOT NULL,
  customer_email VARCHAR(190),
  government_id VARCHAR(32),
  item_category VARCHAR(120),
  item_description TEXT NOT NULL,
  collateral JSON,
  requested_principal_cents BIGINT,
  auto_appraised_value_cents BIGINT,
  interest_model_id BIGINT,
  notes TEXT,
  status ENUM('pending','notified','converted','expired','cancelled') DEFAULT 'pending',
  barcode_token CHAR(32) NOT NULL UNIQUE,
  barcode_expires_at DATETIME NOT NULL,
  barcode_scanned_at DATETIME,
  notified_at DATETIME,
  converted_loan_id BIGINT,
  converted_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (interest_model_id) REFERENCES interest_models(id),
  FOREIGN KEY (converted_loan_id) REFERENCES loans(id)
);

CREATE TABLE IF NOT EXISTS notification_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  intake_id BIGINT,
  loan_id BIGINT,
  repair_id BIGINT,
  customer_id BIGINT,
  channel ENUM('sms','whatsapp','email') NOT NULL,
  recipient VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('pending','sent','failed') DEFAULT 'pending',
  error TEXT,
  sent_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (intake_id) REFERENCES instapawn_intakes(id),
  FOREIGN KEY (loan_id) REFERENCES loans(id),
  FOREIGN KEY (repair_id) REFERENCES repairs(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- ========= LAYAWAY =========
CREATE TABLE IF NOT EXISTS layaways (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  order_id BIGINT NOT NULL,
  total_cents BIGINT NOT NULL,
  paid_cents BIGINT DEFAULT 0,
  due_date DATETIME NOT NULL,
  status ENUM('active','completed','cancelled','pawned') DEFAULT 'active',
  pawn_loan_id BIGINT NULL,
  pawned_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
  note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (layaway_id) REFERENCES layaways(id)
);

-- ========= REPAIRS / FAB =========
CREATE TABLE IF NOT EXISTS repairs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  job_number VARCHAR(40) UNIQUE NOT NULL,
  item_description TEXT,
  issue_description TEXT,
  diagnosis TEXT,
  estimate_cents BIGINT DEFAULT 0,
  deposit_cents BIGINT DEFAULT 0,
  approval_status ENUM('not_requested','pending','approved','denied') DEFAULT 'not_requested',
  approval_requested_at TIMESTAMP NULL,
  approval_decision_at TIMESTAMP NULL,
  status ENUM('intake','diagnosing','waiting_approval','in_progress','qa','ready','completed','cancelled') DEFAULT 'intake',
  promised_at TIMESTAMP NULL,
  total_paid_cents BIGINT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS repair_photos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  repair_id BIGINT NOT NULL,
  storage_path VARCHAR(512) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repair_id) REFERENCES repairs(id)
);

CREATE TABLE IF NOT EXISTS repair_payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  repair_id BIGINT NOT NULL,
  amount_cents BIGINT NOT NULL,
  method ENUM('cash','card','transfer','store_credit','other') DEFAULT 'cash',
  reference VARCHAR(120),
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repair_id) REFERENCES repairs(id)
);

CREATE TABLE IF NOT EXISTS repair_materials (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  repair_id BIGINT NOT NULL,
  product_code_version_id BIGINT NOT NULL,
  qty_issued INT NOT NULL DEFAULT 0,
  qty_returned INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (repair_id) REFERENCES repairs(id),
  FOREIGN KEY (product_code_version_id) REFERENCES product_code_versions(id)
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
CREATE TABLE IF NOT EXISTS marketing_templates (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  channel ENUM('sms','whatsapp','email') NOT NULL DEFAULT 'sms',
  subject VARCHAR(180),
  body TEXT NOT NULL,
  variables JSON,
  created_by BIGINT NOT NULL,
  updated_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS marketing_segments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  filters JSON,
  created_by BIGINT NOT NULL,
  updated_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  template_id BIGINT NOT NULL,
  segment_id BIGINT NOT NULL,
  name VARCHAR(160) NOT NULL,
  scheduled_at DATETIME NULL,
  status ENUM('draft','scheduled','sending','completed','failed') DEFAULT 'draft',
  created_by BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES marketing_templates(id),
  FOREIGN KEY (segment_id) REFERENCES marketing_segments(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS marketing_sends (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  campaign_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  notification_id BIGINT,
  channel ENUM('sms','whatsapp','email') NOT NULL,
  status ENUM('pending','sent','failed') DEFAULT 'pending',
  error TEXT,
  sent_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (notification_id) REFERENCES notification_messages(id)
);

-- ========= E-COMMERCE =========
CREATE TABLE IF NOT EXISTS ecom_channels (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  provider ENUM('shopify','woocommerce','amazon','ebay','custom') NOT NULL,
  status ENUM('disconnected','connected','error') DEFAULT 'disconnected',
  config JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ecom_channel_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  channel_id BIGINT NOT NULL,
  event VARCHAR(160) NOT NULL,
  payload JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES ecom_channels(id)
);

CREATE TABLE IF NOT EXISTS ecom_webhook_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  channel_id BIGINT NOT NULL,
  event VARCHAR(160) NOT NULL,
  payload JSON,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES ecom_channels(id)
);

CREATE TABLE IF NOT EXISTS ecom_listings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_code_id BIGINT NOT NULL,
  title VARCHAR(240) NOT NULL,
  description TEXT,
  price_cents BIGINT NOT NULL,
  status ENUM('draft','active','inactive') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_code_id) REFERENCES product_codes(id)
);

CREATE TABLE IF NOT EXISTS ecom_listing_channels (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  listing_id BIGINT NOT NULL,
  channel_id BIGINT NOT NULL,
  channel_listing_id VARCHAR(120),
  last_synced_at DATETIME,
  status ENUM('pending','synced','error') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (listing_id) REFERENCES ecom_listings(id),
  FOREIGN KEY (channel_id) REFERENCES ecom_channels(id)
);

CREATE TABLE IF NOT EXISTS ecom_orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  channel_id BIGINT NOT NULL,
  external_id VARCHAR(160) NOT NULL,
  customer_name VARCHAR(160) NOT NULL,
  status ENUM('pending','paid','fulfilled','cancelled') DEFAULT 'pending',
  shipping_address JSON,
  total_cents BIGINT NOT NULL,
  currency CHAR(3) DEFAULT 'DOP',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES ecom_channels(id)
);

CREATE TABLE IF NOT EXISTS ecom_order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  listing_id BIGINT,
  product_code_id BIGINT,
  quantity INT NOT NULL,
  price_cents BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES ecom_orders(id),
  FOREIGN KEY (listing_id) REFERENCES ecom_listings(id),
  FOREIGN KEY (product_code_id) REFERENCES product_codes(id)
);

CREATE TABLE IF NOT EXISTS ecom_returns (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  status ENUM('requested','approved','received','refunded','denied') DEFAULT 'requested',
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES ecom_orders(id)
);

CREATE TABLE IF NOT EXISTS ecom_return_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  return_id BIGINT NOT NULL,
  order_item_id BIGINT NOT NULL,
  `condition` ENUM('new','used','damaged') DEFAULT 'new',
  restock BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (return_id) REFERENCES ecom_returns(id),
  FOREIGN KEY (order_item_id) REFERENCES ecom_order_items(id)
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
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT,
  action VARCHAR(160) NOT NULL,
  resource_type VARCHAR(120) NOT NULL,
  resource_id BIGINT,
  payload JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(id)
);

-- ========= INDEXES =========
-- Note: MySQL doesn't support IF NOT EXISTS for indexes, so these will fail silently if they already exist
CREATE INDEX idx_orders_branch_created ON orders(branch_id, created_at DESC);
CREATE INDEX idx_loans_branch_status_due ON loans(branch_id, status, due_date);
-- Note: stock_ledger doesn't have branch_id or code_id columns, so this index should be removed or adjusted
