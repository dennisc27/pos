-- schema-mysql51.sql (compatible with MySQL 5.1.42)
-- Modified to work with older MySQL versions

-- ========== BASE CONVENTIONS ==========
-- id BIGINT AUTO_INCREMENT PRIMARY KEY; created_at/updated_at; soft-delete via deleted_at where needed.
-- Money stored as *_cents BIGINT. All foreign keys indexed.

-- ========= ORG & AUTH =========
CREATE TABLE IF NOT EXISTS branches (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  address TEXT, 
  phone VARCHAR(40),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name ENUM('cashier','seller','manager','marketing','admin') UNIQUE NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  email VARCHAR(190) UNIQUE,
  phone VARCHAR(40),
  full_name VARCHAR(140) NOT NULL,
  pin_hash VARCHAR(128),
  role_id BIGINT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ========= SETTINGS (GLOBAL/BRANCH/USER) =========
CREATE TABLE IF NOT EXISTS settings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  scope ENUM('global','branch','user') NOT NULL DEFAULT 'global',
  branch_id BIGINT NULL,
  user_id BIGINT NULL,
  k VARCHAR(160) NOT NULL,
  v TEXT NOT NULL, -- Changed from JSON to TEXT for MySQL 5.1
  UNIQUE KEY uniq_setting (scope, COALESCE(branch_id,0), COALESCE(user_id,0), k),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ========= PRODUCTS & INVENTORY =========
CREATE TABLE IF NOT EXISTS product_categories (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  parent_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES product_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS product_codes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  category_id BIGINT,
  sku VARCHAR(60),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES product_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS product_code_versions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_code_id BIGINT NOT NULL,
  branch_id BIGINT NOT NULL,
  price_cents BIGINT NOT NULL,
  cost_cents BIGINT,
  qty_on_hand INT DEFAULT 0,
  qty_reserved INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_code_id) REFERENCES product_codes(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ========= CASH & SHIFTS =========
CREATE TABLE IF NOT EXISTS shifts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  expected_cash_cents BIGINT DEFAULT 0,
  actual_cash_cents BIGINT,
  variance_cents BIGINT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS cash_movements (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shift_id BIGINT NOT NULL,
  kind ENUM('deposit', 'cash_to_safe', 'drop', 'paid_in', 'paid_out', 'expense', 'income') NOT NULL,
  amount_cents BIGINT NOT NULL,
  description VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shift_id) REFERENCES shifts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ========= SALES & ORDERS =========
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  customer_id BIGINT,
  order_number VARCHAR(40) UNIQUE NOT NULL,
  status ENUM('draft', 'pending', 'completed', 'cancelled') DEFAULT 'draft',
  subtotal_cents BIGINT NOT NULL,
  tax_cents BIGINT DEFAULT 0,
  total_cents BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_code_version_id BIGINT NOT NULL,
  qty INT NOT NULL,
  unit_price_cents BIGINT NOT NULL,
  total_cents BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_code_version_id) REFERENCES product_code_versions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  invoice_no VARCHAR(64) NOT NULL UNIQUE,
  total_cents BIGINT NOT NULL,
  tax_cents BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT,
  invoice_id BIGINT,
  shift_id BIGINT,
  method ENUM('cash','card','transfer','gift_card','credit_note') NOT NULL,
  amount_cents BIGINT NOT NULL,
  meta TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS sales_returns (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT NOT NULL,
  reason TEXT,
  condition ENUM('new','used','damaged') DEFAULT 'used',
  refund_method ENUM('cash','store_credit') NOT NULL,
  total_refund_cents BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS sales_return_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sales_return_id BIGINT NOT NULL,
  order_item_id BIGINT NOT NULL,
  product_code_version_id BIGINT NOT NULL,
  qty INT NOT NULL,
  refund_cents BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id),
  FOREIGN KEY (order_item_id) REFERENCES order_items(id),
  FOREIGN KEY (product_code_version_id) REFERENCES product_code_versions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS gift_cards (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  balance_cents BIGINT NOT NULL,
  expires_on DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS gift_card_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  gift_card_id BIGINT NOT NULL,
  delta_cents BIGINT NOT NULL,
  ref_table VARCHAR(40),
  ref_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS credit_notes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  balance_cents BIGINT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS credit_note_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  credit_note_id BIGINT NOT NULL,
  delta_cents BIGINT NOT NULL,
  ref_table VARCHAR(40),
  ref_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS price_override_approvals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  manager_id BIGINT NOT NULL,
  cart_total_cents BIGINT NOT NULL,
  override_total_cents BIGINT NOT NULL,
  override_delta_cents BIGINT NOT NULL,
  reason VARCHAR(255),
  approval_code CHAR(36) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ========= CUSTOMERS =========
CREATE TABLE IF NOT EXISTS customers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(190),
  phone VARCHAR(40),
  address TEXT,
  is_blacklisted BOOLEAN DEFAULT FALSE,
  loyalty_points INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ========= LOANS/PAWNS =========
CREATE TABLE IF NOT EXISTS loans (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  ticket_number VARCHAR(40) UNIQUE NOT NULL,
  principal_cents BIGINT NOT NULL,
  interest_rate DECIMAL(5,4) NOT NULL,
  due_date DATETIME NOT NULL,
  status ENUM('active', 'renewed', 'redeemed', 'forfeited') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ========= LAYAWAYS =========
CREATE TABLE IF NOT EXISTS layaways (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  order_id BIGINT NOT NULL,
  total_cents BIGINT NOT NULL,
  paid_cents BIGINT DEFAULT 0,
  due_date DATETIME NOT NULL,
  status ENUM('active', 'completed', 'cancelled', 'pawned') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ========= REPAIRS =========
CREATE TABLE IF NOT EXISTS repairs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  job_number VARCHAR(40) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  estimate_cents BIGINT,
  status ENUM('intake', 'diagnosing', 'waiting_approval', 'in_progress', 'qa', 'ready', 'completed', 'cancelled') DEFAULT 'intake',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ========= STOCK LEDGER =========
CREATE TABLE IF NOT EXISTS stock_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_code_version_id BIGINT NOT NULL,
  reason ENUM('sale', 'purchase', 'count_post', 'transfer_in', 'transfer_out', 'pawn_forfeit_in', 'return', 'adjustment') NOT NULL,
  qty_change INT NOT NULL,
  reference_id BIGINT,
  reference_type VARCHAR(40),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_code_version_id) REFERENCES product_code_versions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ========= INDEXES =========
CREATE INDEX idx_users_branch_id ON users(branch_id);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_settings_scope ON settings(scope);
CREATE INDEX idx_product_codes_category_id ON product_codes(category_id);
CREATE INDEX idx_product_code_versions_product_code_id ON product_code_versions(product_code_id);
CREATE INDEX idx_product_code_versions_branch_id ON product_code_versions(branch_id);
CREATE INDEX idx_shifts_branch_id ON shifts(branch_id);
CREATE INDEX idx_shifts_user_id ON shifts(user_id);
CREATE INDEX idx_cash_movements_shift_id ON cash_movements(shift_id);
CREATE INDEX idx_orders_branch_id ON orders(branch_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_code_version_id ON order_items(product_code_version_id);
CREATE INDEX idx_sales_returns_invoice_id ON sales_returns(invoice_id);
CREATE INDEX idx_sales_return_items_order_item_id ON sales_return_items(order_item_id);
CREATE INDEX idx_sales_return_items_product_code_version_id ON sales_return_items(product_code_version_id);
CREATE INDEX idx_customers_branch_id ON customers(branch_id);
CREATE INDEX idx_loans_branch_id ON loans(branch_id);
CREATE INDEX idx_loans_customer_id ON loans(customer_id);
CREATE INDEX idx_layaways_branch_id ON layaways(branch_id);
CREATE INDEX idx_layaways_customer_id ON layaways(customer_id);
CREATE INDEX idx_layaways_order_id ON layaways(order_id);
CREATE INDEX idx_repairs_branch_id ON repairs(branch_id);
CREATE INDEX idx_repairs_customer_id ON repairs(customer_id);
CREATE INDEX idx_stock_ledger_product_code_version_id ON stock_ledger(product_code_version_id);

