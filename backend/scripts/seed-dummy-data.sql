-- seed-dummy-data.sql
-- Dummy dataset for the Pawn & POS schema defined in schema.sql
-- Execute this script against a fresh database after applying schema.sql

SET NAMES utf8mb4;
SET time_zone = '+00:00';

START TRANSACTION;

-- === Branches & Roles ===
INSERT INTO branches (code, name, address, phone)
VALUES
  ('SDQ', 'Sucursal Santo Domingo', 'Av. 27 de Febrero 101, Santo Domingo', '+1-809-555-0101'),
  ('POP', 'Sucursal Puerto Plata', 'Calle Duarte 55, Puerto Plata', '+1-809-555-0202');

INSERT INTO roles (name)
VALUES ('cashier'), ('seller'), ('manager'), ('marketing'), ('admin');

SET @branch_sdq := (SELECT id FROM branches WHERE code = 'SDQ');
SET @branch_pop := (SELECT id FROM branches WHERE code = 'POP');
SET @role_manager := (SELECT id FROM roles WHERE name = 'manager');
SET @role_cashier := (SELECT id FROM roles WHERE name = 'cashier');
SET @role_seller := (SELECT id FROM roles WHERE name = 'seller');
SET @role_marketing := (SELECT id FROM roles WHERE name = 'marketing');
SET @role_admin := (SELECT id FROM roles WHERE name = 'admin');

-- === Users & Settings ===
INSERT INTO users (branch_id, email, phone, full_name, pin_hash, role_id, is_active)
VALUES
  (@branch_sdq, 'gerente@pawn.test', '+1-809-555-0303', 'Gerente General', UNHEX(SHA2('1234', 256)), @role_manager, TRUE),
  (@branch_sdq, 'cajera@pawn.test', '+1-809-555-0404', 'Cajera Principal', UNHEX(SHA2('1234', 256)), @role_cashier, TRUE),
  (@branch_pop, 'vendedor@pawn.test', '+1-809-555-0505', 'Vendedor Norte', UNHEX(SHA2('1234', 256)), @role_seller, TRUE),
  (@branch_sdq, 'marketing@pawn.test', '+1-809-555-0606', 'Especialista Marketing', UNHEX(SHA2('1234', 256)), @role_marketing, TRUE),
  (@branch_sdq, 'admin@pawn.test', '+1-809-555-0707', 'Administrador Sistema', UNHEX(SHA2('1234', 256)), @role_admin, TRUE);

SET @user_manager := (SELECT id FROM users WHERE email = 'gerente@pawn.test');
SET @user_cashier := (SELECT id FROM users WHERE email = 'cajera@pawn.test');
SET @user_seller := (SELECT id FROM users WHERE email = 'vendedor@pawn.test');
SET @user_marketing := (SELECT id FROM users WHERE email = 'marketing@pawn.test');
SET @user_admin := (SELECT id FROM users WHERE email = 'admin@pawn.test');

INSERT INTO settings (scope, branch_id, user_id, k, v)
VALUES
  ('global', NULL, NULL, 'pos.currency', JSON_OBJECT('code', 'DOP', 'symbol', '$')),
  ('branch', @branch_sdq, NULL, 'pos.receipt_footer', JSON_OBJECT('lines', JSON_ARRAY('¡Gracias por su compra!', 'Visítanos pronto'))),
  ('branch', @branch_pop, NULL, 'pos.receipt_footer', JSON_OBJECT('lines', JSON_ARRAY('Gracias por preferirnos', 'Sucursal Puerto Plata'))),
  ('user', NULL, @user_manager, 'dashboard.widgets', JSON_ARRAY('sales', 'layaways', 'loans'));

-- === Customers & CRM ===
INSERT INTO customers (branch_id, first_name, last_name, email, phone, address, is_blacklisted, loyalty_points)
VALUES
  (@branch_sdq, 'Ana', 'Ramírez', 'ana.ramirez@example.com', '+1-809-555-1001', 'Ensanche Naco, Santo Domingo', FALSE, 120),
  (@branch_sdq, 'Luis', 'Pérez', 'luis.perez@example.com', '+1-809-555-1002', 'Zona Colonial, Santo Domingo', FALSE, 80),
  (@branch_pop, 'María', 'Gómez', 'maria.gomez@example.com', '+1-809-555-1003', 'Malecón, Puerto Plata', FALSE, 40),
  (@branch_sdq, 'Carlos', 'Fernández', 'carlos.fernandez@example.com', '+1-809-555-1004', 'Gazcue, Santo Domingo', TRUE, 0);

SET @customer_ana := (SELECT id FROM customers WHERE email = 'ana.ramirez@example.com');
SET @customer_luis := (SELECT id FROM customers WHERE email = 'luis.perez@example.com');
SET @customer_maria := (SELECT id FROM customers WHERE email = 'maria.gomez@example.com');
SET @customer_carlos := (SELECT id FROM customers WHERE email = 'carlos.fernandez@example.com');

INSERT INTO id_images (customer_id, storage_path)
VALUES
  (@customer_ana, 's3://pawn-demo/id/ana-ramirez.png');

INSERT INTO loyalty_ledger (customer_id, points_delta, reason, ref_table, ref_id)
VALUES
  (@customer_ana, 120, 'Compra inicial', 'orders', 1),
  (@customer_luis, 80, 'Promoción bienvenida', 'orders', 2);

INSERT INTO customer_notes (customer_id, author_id, note)
VALUES
  (@customer_carlos, @user_manager, 'Cliente requiere aprobación de gerente antes de préstamos grandes.');

INSERT INTO reviews (source, author, rating, comment, status)
VALUES
  ('google', 'Laura Méndez', 5, 'Excelente servicio y trato amable.', 'approved'),
  ('facebook', 'Pedro Ruiz', 4, 'Buenos precios, aunque la espera fue larga.', 'approved');

-- === Catalog & Inventory ===
INSERT INTO categories (parent_id, name)
VALUES
  (NULL, 'Electrónica'),
  (NULL, 'Joyas');

SET @cat_electronics := (SELECT id FROM categories WHERE name = 'Electrónica' LIMIT 1);

INSERT INTO categories (parent_id, name)
VALUES
  (@cat_electronics, 'Celulares');
SET @cat_jewelry := (SELECT id FROM categories WHERE name = 'Joyas' LIMIT 1);
SET @cat_cellphones := (SELECT id FROM categories WHERE name = 'Celulares' LIMIT 1);

INSERT INTO products (sku, name, description, category_id, uom, taxable, is_active)
VALUES
  ('IPH12-128-BLK', 'iPhone 12 128GB Negro', 'Apple iPhone 12 en excelente estado con cargador.', @cat_cellphones, 'ea', TRUE, TRUE),
  ('GOLD-RING-01', 'Anillo de Oro 14K', 'Anillo clásico de oro de 14 quilates.', @cat_jewelry, 'ea', FALSE, TRUE),
  ('TV-SAM-55', 'Samsung Smart TV 55"', 'Televisor inteligente 4K con HDR.', @cat_electronics, 'ea', TRUE, TRUE);

SET @product_iphone := (SELECT id FROM products WHERE sku = 'IPH12-128-BLK');
SET @product_ring := (SELECT id FROM products WHERE sku = 'GOLD-RING-01');
SET @product_tv := (SELECT id FROM products WHERE sku = 'TV-SAM-55');

INSERT INTO product_codes (product_id, code)
VALUES
  (@product_iphone, 'SKU-1001'),
  (@product_ring, 'SKU-2001'),
  (@product_tv, 'SKU-3001');

SET @code_iphone := (SELECT id FROM product_codes WHERE code = 'SKU-1001');
SET @code_ring := (SELECT id FROM product_codes WHERE code = 'SKU-2001');
SET @code_tv := (SELECT id FROM product_codes WHERE code = 'SKU-3001');

INSERT INTO product_code_versions (product_code_id, branch_id, price_cents, cost_cents, qty_on_hand, qty_reserved, is_active)
VALUES
  (@code_iphone, @branch_sdq, 6500000, 4500000, 5, 1, TRUE),
  (@code_ring, @branch_sdq, 3500000, 2000000, 3, 0, TRUE),
  (@code_tv, @branch_pop, 4200000, 3000000, 2, 0, TRUE);

SET @pcv_iphone := (SELECT id FROM product_code_versions WHERE product_code_id = @code_iphone AND branch_id = @branch_sdq LIMIT 1);
SET @pcv_ring := (SELECT id FROM product_code_versions WHERE product_code_id = @code_ring LIMIT 1);
SET @pcv_tv := (SELECT id FROM product_code_versions WHERE product_code_id = @code_tv LIMIT 1);

INSERT INTO product_code_components (parent_code_id, child_code_id, qty_ratio)
VALUES
  (@code_iphone, @code_ring, 0.10);

INSERT INTO stock_ledger (product_code_version_id, qty_change, reason, ref_table, ref_id)
VALUES
  (@pcv_iphone, 5, 'purchase', 'purchases', 1),
  (@pcv_ring, 3, 'purchase', 'purchases', 1),
  (@pcv_tv, 2, 'purchase', 'purchases', 2);

-- Purchases & suppliers
INSERT INTO purchases (branch_id, supplier_name, supplier_invoice, reference_no, received_at, created_by, total_cost_cents, total_quantity, notes)
VALUES
  (@branch_sdq, 'Distribuidora Caribe', 'INV-5001', 'PO-5001', NOW(), @user_manager, 15000000, 8, 'Compra inicial de inventario'),
  (@branch_pop, 'Electro Import', 'INV-6001', 'PO-6001', NOW(), @user_seller, 6000000, 2, 'Televisores para exhibición');

SET @purchase_sdq := (SELECT id FROM purchases WHERE supplier_invoice = 'INV-5001');
SET @purchase_pop := (SELECT id FROM purchases WHERE supplier_invoice = 'INV-6001');

INSERT INTO purchase_lines (purchase_id, product_code_version_id, quantity, unit_cost_cents, line_total_cents, label_quantity, notes)
VALUES
  (@purchase_sdq, @pcv_iphone, 5, 4500000, 22500000, 5, 'iPhones reacondicionados'),
  (@purchase_sdq, @pcv_ring, 3, 2000000, 6000000, 3, 'Joyas de oro'),
  (@purchase_pop, @pcv_tv, 2, 3000000, 6000000, 2, 'Televisores 4K');

INSERT INTO supplier_credits (branch_id, supplier_name, supplier_invoice, purchase_id, amount_cents, balance_cents, reason)
VALUES
  (@branch_sdq, 'Distribuidora Caribe', 'INV-5001', @purchase_sdq, 500000, 500000, 'Bonificación por volumen');

SET @supplier_credit := LAST_INSERT_ID();

INSERT INTO supplier_credit_ledger (supplier_credit_id, delta_cents, reference_type, reference_id, reason)
VALUES
  (@supplier_credit, -100000, 'purchase_return', 1, 'Aplicado a devolución parcial');

INSERT INTO purchase_returns (purchase_id, branch_id, supplier_name, supplier_invoice, reason, created_by, total_quantity, total_cost_cents)
VALUES
  (@purchase_sdq, @branch_sdq, 'Distribuidora Caribe', 'INV-5001-R', 'iPhone con pantalla rayada', @user_cashier, 1, 4500000);

SET @purchase_return := LAST_INSERT_ID();

INSERT INTO purchase_return_lines (purchase_return_id, purchase_line_id, product_code_version_id, quantity, unit_cost_cents, line_total_cents, note)
VALUES
  (@purchase_return, (SELECT id FROM purchase_lines WHERE purchase_id = @purchase_sdq AND product_code_version_id = @pcv_iphone LIMIT 1), @pcv_iphone, 1, 4500000, 4500000, 'Equipo devuelto al proveedor');

-- Inventory counts & transfers
INSERT INTO inv_count_sessions (branch_id, scope, status, snapshot_at, created_by)
VALUES
  (@branch_sdq, 'cycle', 'open', NOW(), @user_manager);

SET @count_session := LAST_INSERT_ID();

INSERT INTO inv_count_lines (session_id, product_code_version_id, expected_qty, counted_qty, status)
VALUES
  (@count_session, @pcv_iphone, 4, 4, 'counted'),
  (@count_session, @pcv_ring, 3, 2, 'recount');

INSERT INTO inv_transfers (from_branch_id, to_branch_id, status, created_by, approved_by, shipped_by, received_by, shipped_at, received_at)
VALUES
  (@branch_sdq, @branch_pop, 'received', @user_manager, @user_manager, @user_seller, @user_seller, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 1 DAY);

SET @transfer := LAST_INSERT_ID();

INSERT INTO inv_transfer_lines (transfer_id, product_code_version_id, qty)
VALUES
  (@transfer, @pcv_ring, 1.0);

INSERT INTO quarantine (branch_id, product_code_version_id, qty, reason, status, outcome, created_by)
VALUES
  (@branch_sdq, @pcv_ring, 1.0, 'Verificación de autenticidad', 'open', 'return', @user_manager);

-- === POS / Sales ===
INSERT INTO orders (branch_id, customer_id, status, payment_status, created_by)
VALUES
  (@branch_sdq, @customer_ana, 'completed', 'paid', @user_cashier),
  (@branch_sdq, @customer_luis, 'completed', 'paid', @user_cashier),
  (@branch_pop, @customer_maria, 'pending', 'unpaid', @user_seller);

SET @order_ana := (SELECT id FROM orders WHERE customer_id = @customer_ana ORDER BY id LIMIT 1);
SET @order_luis := (SELECT id FROM orders WHERE customer_id = @customer_luis ORDER BY id LIMIT 1);
SET @order_maria := (SELECT id FROM orders WHERE customer_id = @customer_maria ORDER BY id LIMIT 1);

INSERT INTO order_items (order_id, code_id, qty, price_cents, discount_cents)
VALUES
  (@order_ana, @code_iphone, 1, 6500000, 500000),
  (@order_ana, @code_ring, 1, 3500000, 0),
  (@order_luis, @code_ring, 1, 3500000, 500000),
  (@order_maria, @code_tv, 1, 4200000, 0);

INSERT INTO invoices (order_id, invoice_no, total_cents, tax_cents)
VALUES
  (@order_ana, 'FAC-0001', 9500000, 1365000),
  (@order_luis, 'FAC-0002', 3000000, 0);

SET @invoice_ana := (SELECT id FROM invoices WHERE invoice_no = 'FAC-0001');
SET @invoice_luis := (SELECT id FROM invoices WHERE invoice_no = 'FAC-0002');

INSERT INTO payments (order_id, invoice_id, shift_id, method, amount_cents, meta)
VALUES
  (@order_ana, @invoice_ana, NULL, 'card', 9500000, JSON_OBJECT('authCode', 'A1B2C3')),
  (@order_luis, @invoice_luis, NULL, 'cash', 3000000, JSON_OBJECT('drawer', 'main'));

INSERT INTO sales_returns (invoice_id, reason, `condition`, refund_method)
VALUES
  (@invoice_luis, 'Cliente cambió de opinión', 'used', 'store_credit');

SET @sales_return := LAST_INSERT_ID();

INSERT INTO sales_return_items (sales_return_id, code_id, qty, refund_cents)
VALUES
  (@sales_return, @code_ring, 1, 3000000);

-- === Loans / Pawns ===
INSERT INTO interest_models (name, description, rate_type, period_days, interest_rate_bps, grace_days, min_principal_cents, max_principal_cents, late_fee_bps)
VALUES
  ('Interés Mensual', 'Modelo estándar mensual', 'simple', 30, 2500, 5, 500000, 20000000, 500);

SET @interest_model := LAST_INSERT_ID();

INSERT INTO loans (branch_id, customer_id, ticket_number, principal_cents, interest_model_id, interest_rate, due_date, status, comments)
VALUES
  (@branch_sdq, @customer_ana, 'PWN-0001', 5000000, @interest_model, 0.025, CURRENT_DATE + INTERVAL 30 DAY, 'active', 'Préstamo sobre anillo de oro'),
  (@branch_sdq, @customer_carlos, 'PWN-0002', 3000000, @interest_model, 0.025, CURRENT_DATE + INTERVAL 15 DAY, 'active', 'Cliente con historial de retrasos');

SET @loan_ana := (SELECT id FROM loans WHERE ticket_number = 'PWN-0001');
SET @loan_carlos := (SELECT id FROM loans WHERE ticket_number = 'PWN-0002');

INSERT INTO loan_collateral (loan_id, description, estimated_value_cents, photo_path)
VALUES
  (@loan_ana, 'Anillo de oro amarillo 14k', 7000000, 's3://pawn-demo/collateral/pwn-0001-ring.jpg');

INSERT INTO loan_schedules (loan_id, due_on, interest_cents, fee_cents)
VALUES
  (@loan_ana, CURRENT_DATE + INTERVAL 30 DAY, 125000, 0),
  (@loan_carlos, CURRENT_DATE + INTERVAL 15 DAY, 75000, 10000);

INSERT INTO loan_payments (loan_id, kind, amount_cents, method)
VALUES
  (@loan_ana, 'interest', 125000, 'cash'),
  (@loan_carlos, 'extension', 85000, 'cash');

INSERT INTO loan_forfeitures (loan_id, code_id)
VALUES
  (@loan_carlos, @code_tv);

INSERT INTO instapawn_intakes (branch_id, customer_first_name, customer_last_name, customer_phone, customer_email, government_id, item_category, item_description, collateral, requested_principal_cents, auto_appraised_value_cents, interest_model_id, notes, status, barcode_token, barcode_expires_at, notified_at)
VALUES
  (@branch_sdq, 'Julia', 'Santos', '+1-809-555-2001', 'julia.santos@example.com', '001-1234567-8', 'Electrónica', 'Laptop Dell XPS 13', JSON_OBJECT('condition', 'Muy buen estado'), 2500000, 3000000, @interest_model, 'Cliente nueva via web', 'pending', 'BARCODE1234567890ABCDEF123456', NOW() + INTERVAL 2 DAY, NOW());

INSERT INTO notification_messages (intake_id, loan_id, customer_id, channel, recipient, message, status, sent_at)
VALUES
  (LAST_INSERT_ID(), NULL, @customer_ana, 'sms', '+1-809-555-1001', 'Tu pago de préstamo vence pronto.', 'sent', NOW());

-- === Layaways ===
INSERT INTO layaways (branch_id, customer_id, order_id, total_cents, paid_cents, due_date, status)
VALUES
  (@branch_sdq, @customer_luis, @order_luis, 3000000, 1500000, NOW() + INTERVAL 30 DAY, 'active');

SET @layaway := LAST_INSERT_ID();

INSERT INTO layaway_payments (layaway_id, amount_cents, method, note)
VALUES
  (@layaway, 1500000, 'cash', 'Pago inicial de apartado');

-- === Repairs ===
INSERT INTO repairs (branch_id, customer_id, job_number, item_description, issue_description, diagnosis, estimate_cents, deposit_cents, approval_status, status, promised_at, total_paid_cents, notes)
VALUES
  (@branch_sdq, @customer_maria, 'REP-0001', 'Pulsera de plata', 'Cierre dañado', 'Requiere soldadura y pulido', 500000, 100000, 'pending', 'in_progress', NOW() + INTERVAL 5 DAY, 100000, 'Avisar cuando esté lista');

SET @repair := LAST_INSERT_ID();

INSERT INTO repair_photos (repair_id, storage_path)
VALUES
  (@repair, 's3://pawn-demo/repairs/rep-0001-before.jpg');

INSERT INTO repair_payments (repair_id, amount_cents, method, reference, note)
VALUES
  (@repair, 100000, 'cash', 'DEP-REP-0001', 'Depósito inicial');

INSERT INTO repair_materials (repair_id, product_code_version_id, qty_issued, qty_returned)
VALUES
  (@repair, @pcv_ring, 1, 0);

-- === Cash / Shifts ===
INSERT INTO shifts (branch_id, opened_by, opening_cash_cents, closing_cash_cents, expected_cash_cents, over_short_cents, opened_at, closed_at)
VALUES
  (@branch_sdq, @user_cashier, 2000000, 3500000, 3400000, 100000, NOW() - INTERVAL 1 DAY, NOW());

SET @shift := LAST_INSERT_ID();

INSERT INTO shift_reports (shift_id, snapshot)
VALUES
  (@shift, JSON_OBJECT('totalSalesCents', 9500000, 'totalCashMovements', 3));

INSERT INTO cash_movements (shift_id, kind, amount_cents, reason)
VALUES
  (@shift, 'deposit', 500000, 'Depósito de apertura'),
  (@shift, 'paid_out', 100000, 'Pago de servicio de mensajería');

-- === Gift Cards & Credit Notes ===
INSERT INTO gift_cards (code, balance_cents, expires_on)
VALUES
  ('GC-0001', 2500000, CURRENT_DATE + INTERVAL 1 YEAR);

SET @gift_card := LAST_INSERT_ID();

INSERT INTO gift_card_ledger (gift_card_id, delta_cents, ref_table, ref_id)
VALUES
  (@gift_card, 2500000, 'payments', @invoice_ana);

INSERT INTO credit_notes (customer_id, balance_cents, reason)
VALUES
  (@customer_luis, 3000000, 'Devolución de venta');

SET @credit_note := LAST_INSERT_ID();

INSERT INTO credit_note_ledger (credit_note_id, delta_cents, ref_table, ref_id)
VALUES
  (@credit_note, 3000000, 'sales_returns', @sales_return);

-- === Marketing ===
INSERT INTO marketing_templates (name, channel, subject, body, variables, created_by, updated_by)
VALUES
  ('Promo Viernes', 'sms', NULL, '¡Ofertas especiales este viernes en Pawn & POS!', JSON_ARRAY('customer_first_name'), @user_marketing, @user_marketing);

INSERT INTO marketing_segments (name, description, filters, created_by, updated_by)
VALUES
  ('Clientes VIP', 'Clientes con más de 100 puntos de lealtad', JSON_OBJECT('minPoints', 100), @user_marketing, @user_marketing);

SET @segment := LAST_INSERT_ID();
SET @template := (SELECT id FROM marketing_templates WHERE name = 'Promo Viernes');

INSERT INTO marketing_campaigns (template_id, segment_id, name, scheduled_at, status, created_by)
VALUES
  (@template, @segment, 'Campaña VIP Julio', NOW() + INTERVAL 1 DAY, 'scheduled', @user_marketing);

SET @campaign := LAST_INSERT_ID();

INSERT INTO marketing_sends (campaign_id, customer_id, notification_id, channel, status, sent_at)
VALUES
  (@campaign, @customer_ana, NULL, 'sms', 'pending', NULL);

-- === E-commerce ===
INSERT INTO ecom_channels (name, provider, status, config)
VALUES
  ('Shopify Central', 'shopify', 'connected', JSON_OBJECT('shop', 'pawn-demo.myshopify.com'));

SET @ecom_channel := LAST_INSERT_ID();

INSERT INTO ecom_channel_logs (channel_id, event, payload)
VALUES
  (@ecom_channel, 'sync_started', JSON_OBJECT('timestamp', NOW()));

INSERT INTO ecom_webhook_logs (channel_id, event, payload)
VALUES
  (@ecom_channel, 'order_created', JSON_OBJECT('orderId', 'SH-1001'));

INSERT INTO ecom_listings (product_code_id, title, description, price_cents, status)
VALUES
  (@code_iphone, 'iPhone 12 128GB', 'Teléfono desbloqueado con garantía de 90 días.', 6800000, 'active');

SET @listing := LAST_INSERT_ID();

INSERT INTO ecom_listing_channels (listing_id, channel_id, channel_listing_id, last_synced_at, status)
VALUES
  (@listing, @ecom_channel, 'gid://shopify/Product/1234567890', NOW(), 'synced');

INSERT INTO ecom_orders (channel_id, external_id, customer_name, status, shipping_address, total_cents, currency)
VALUES
  (@ecom_channel, 'SH-1001', 'Ana Ramírez', 'paid', JSON_OBJECT('city', 'Santo Domingo', 'country', 'DO'), 7000000, 'DOP');

SET @ecom_order := LAST_INSERT_ID();

INSERT INTO ecom_order_items (order_id, listing_id, product_code_id, quantity, price_cents)
VALUES
  (@ecom_order, @listing, @code_iphone, 1, 7000000);

INSERT INTO ecom_returns (order_id, status, reason)
VALUES
  (@ecom_order, 'requested', 'Cliente solicita cambio de color');

SET @ecom_return := LAST_INSERT_ID();

INSERT INTO ecom_return_items (return_id, order_item_id, `condition`, restock)
VALUES
  (@ecom_return, (SELECT id FROM ecom_order_items WHERE order_id = @ecom_order LIMIT 1), 'used', TRUE);

-- === Notifications & Compliance ===
INSERT INTO notifications (channel, to_ref, template_key, payload, status)
VALUES
  ('email', 'ana.ramirez@example.com', 'receipt', JSON_OBJECT('invoice', 'FAC-0001'), 'sent');

INSERT INTO compliance_stamps (ref_table, ref_id, camera_id, snapshot_path)
VALUES
  ('orders', @order_ana, 'CAM-01', 's3://pawn-demo/compliance/order-ana.jpg');

-- === Audit Logs ===
INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, payload)
VALUES
  (@user_admin, 'user.login', 'auth_session', 1, JSON_OBJECT('ip', '127.0.0.1')),
  (@user_manager, 'order.create', 'orders', @order_ana, JSON_OBJECT('orderId', @order_ana));

COMMIT;
