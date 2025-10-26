
# TODO — Step-by-step execution plan (module-by-module)
Aligned to `ui_tasks.md` and `schema.sql`
The app has to folders backend an frontend.

> Conventions
- FE = Frontend (Next.js, Tailwind, shadcn, lucide-react)
- BE = Backend (Node/Express + MySQL via Drizzle/Prisma/Knex)
- TEST = Vitest/Playwright (or your stack)
- AC = Acceptance Criteria

## 0) Common
- [x] FE: Add the missing routes on sidebar from `ui_tasks.md`.
- [x] FE: Make sure the money helpers are present (cents↔display) and ITBIS breakdown: `net = round(price*0.82,2); tax = price - net`.
## 1) POS
### 1.1 New Sale (/pos/sale)
BE
- [x] Endpoint: `GET /api/products?q=` (search by name/sku/code)
- [x] Endpoint: `POST /api/cart/price-override` (manager approval)
- [x] Endpoint: `POST /api/orders` → creates order + items
- [x] Endpoint: `POST /api/invoices` → totals + tax (server truth)
- [x] Endpoint: `POST /api/payments` (cash/card/transfer/gift_card/credit_note)
- [x] Endpoint: `POST /api/receipts/:invoiceId/print` (ESC/POS)
- [x] Ledger: on invoice paid → `stock_ledger(reason='sale', qty negative)`; gift/credit ledgers update

FE
- [x] Page scaffold with: scan_input, cart_table, tender_panel, receipt_preview
- [x] Cart state (local) -> server validate totals before finalize
- [x] Tender modal: handle multi-tender + change
- [x] Manager discount flow (prompt PIN; call approval endpoint)

TEST/AC
- [x] Scan item by code → line appears with correct price
- [x] Apply discount beyond policy requires manager
- [x] Finalize cash sale kicks drawer and prints receipt
- [x] Stock decreases; payment + invoice persisted

### 1.2 Refunds (/pos/refund)
BE
- [x] `GET /api/invoices/:no`
- [x] `POST /api/refunds` → creates sales_return + items
- [x] Restock when condition in (new, used)

FE
- [x] Invoice lookup field; selectable lines; totals_box; policy_alerts
- [x] Choose refund method (cash/store_credit)

AC
- [x] Return line restocks if not damaged
- [x] Credit note issued when store_credit

### 1.3 Buy from Customer (/pos/buy)
BE
- [ ] `POST /api/purchases` + items
- [ ] Payout (cash) movement to current shift
- [ ] Attach photos (path only)

FE
- [ ] Intake form + photo uploader + offer panel
- [ ] Print receipt

AC
- [ ] Posting creates purchase + ledger (purchase)
- [ ] Drawer log reflects payout

### 1.4 Gift Card (/pos/gift-card)
BE
- [ ] `POST /api/gift-cards/issue` | `/reload` | `/redeem`
- [ ] Update `gift_card_ledger`

FE
- [ ] Issue/reload/redeem forms + balance widget

AC
- [ ] Balance reflects deltas exactly; prevents overdraft

---

## 2) Cash & Shifts
### 2.1 Shifts (/cash/shift)
BE
- [ ] `POST /api/shifts/open` (with PIN), `POST /api/shifts/:id/close`
- [ ] `POST /api/shifts/:id/drop|paid-in|paid-out` (kinds validated)
- [ ] Compute expected vs actual; persist `shift_reports.snapshot`

FE
- [ ] Denomination counter; drawer actions; Z-report list

AC
- [ ] Over/short computed; discrepancy > threshold flagged

### 2.2 Movements (/cash/movements)
BE
- [ ] `POST /api/cash-movements` (kinds: deposit, cash_to_safe, drop, paid_in, paid_out, expense, income)

FE
- [ ] Movement form + table filtered to current shift

AC
- [ ] Movement appears in shift end totals

---

## 3) Loans / Pawns
### 3.1 New Loan (/loans/new)
BE
- [ ] `GET /api/interest-models`
- [ ] `POST /api/loans` + collateral (photos paths) + schedule
- [ ] Signed URL flow for `id_images` (server signs, FE uploads)

FE
- [ ] Wizard steps: customer -> id_capture -> collateral -> terms -> ticket_print

AC
- [ ] Ticket number unique; schedule stores interest rows

### 3.2 Loan Detail (/loans/:id)
BE
- [ ] `GET /api/loans/:id` (header, schedule, balance, history)
- [ ] `POST /api/loans/:id/pay` (interest/advance)
- [ ] `POST /api/loans/:id/renew|redeem|extension|rewrite`

FE
- [ ] Header card + actions (respect capabilities_by_role)

AC
- [ ] Renew updates due date & schedule; redeem closes loan

### 3.3 Forfeiture (/loans/:id/forfeit)
BE
- [ ] Create product_code from collateral, push `stock_ledger('pawn_forfeit_in')`

FE
- [ ] Collateral picker -> code generator -> toast

AC
- [ ] Code appears in inventory; loan marked forfeited

### 3.4 InstaPawn (/loans/instapawn)
BE
- [ ] `POST /api/instapawn` -> create intake + barcode token (expiry)
- [ ] Send WhatsApp/SMS via `notifications`

FE
- [ ] Intake form + barcode card + status

AC
- [ ] Token converts to loan once scanned in-store

### 3.5 Past-due (/loans/due)
BE
- [ ] `GET /api/loans/past-due`
- [ ] `POST /api/loans/outreach` (bulk messaging)

FE
- [ ] Selectable table + bulk action bar + print list

AC
- [ ] Messages queued; export CSV works

---

## 4) Layaway
### 4.1 Create Layaway (/layaway/new)
BE
- [ ] `POST /api/layaways` -> link to order (reserve stock)
FE
- [ ] Reuse cart table; payment plan panel; agreement preview
AC
- [ ] Layaway becomes active and stock is reserved

### 4.2 Layaway Detail (/layaway/:id)
BE
- [ ] `GET /api/layaways/:id`
- [ ] `POST /api/layaways/:id/pay` | `/cancel` | `/complete`
- [ ] On overdue: `/pawn` → create `loans` row; mark layaway.pawned
FE
- [ ] Payment history + actions_bar
AC
- [ ] Overdue conversion creates linked pawn_loan_id

---

## 5) Inventory
### 5.1 Items (/inventory)
BE
- [ ] `GET /api/inventory?filters=`
- [ ] `PATCH /api/product-codes/:id` quick edits
- [ ] `POST /api/labels/qr` to generate printable sheet
FE
- [ ] Table/grid; inline edit; bulk actions
AC
- [ ] Quick edit persists; QR sheet downloads

### 5.2 Ops (/inventory/ops)
BE
- [ ] `POST /api/inventory/count-sessions`
- [ ] `POST /api/inventory/count-lines` (scan add)
- [ ] `POST /api/inventory/count-post` → write `stock_ledger('count_post')`
- [ ] Transfers: `POST /api/inventory/transfers`, `/approve`, `/ship`, `/receive`
- [ ] Quarantine: `/queue`, `/resolve`
FE
- [ ] Wizard: snapshot -> blind count -> review -> post
AC
- [ ] Variances reflected in ledger; transfers move stock between branches

### 5.3 Split/Combine (/inventory/split-combine)
BE
- [ ] `POST /api/inventory/split` → add `product_code_components` + ledger
- [ ] `POST /api/inventory/combine` → inverse
FE
- [ ] Tree view + split/combine wizards
AC
- [ ] Cost lineage conserved (sum(child costs) == parent cost within rounding rules)

### 5.4 Barcode (/inventory/barcode)
BE
- [ ] `GET /api/codes` + `POST /api/labels/print`
FE
- [ ] Codes table + print preview
AC
- [ ] Print sends correct layout

---

## 6) Purchases
### 6.1 Receive (/purchases/new)
BE
- [ ] `POST /api/purchases` + lines
- [ ] On post -> ledger('purchase') and label generation
FE
- [ ] Receive form + lines table + label modal
AC
- [ ] Stock increases correctly

### 6.2 Purchase Returns (/purchases/returns)
BE
- [ ] `POST /api/purchase-returns`
FE
- [ ] Return lines UI + totals
AC
- [ ] Supplier credit created

---

## 7) Repairs/Fabrication
### 7.1 Intake (/repairs/intake)
BE
- [ ] `POST /api/repairs` + photos
- [ ] `POST /api/repairs/:id/request-approval`
FE
- [ ] Intake form; estimate panel
AC
- [ ] Approval status visible; deposit taken

### 7.2 Board (/repairs/board)
BE
- [ ] `GET /api/repairs?state=`
- [ ] `POST /api/repairs/:id/move` (lane transitions)
- [ ] Materials issue/return endpoints write `repair_materials` and update stock ledger
FE
- [ ] Kanban with job_card + side_panel
AC
- [ ] Materials ledger adjusts inventory

### 7.3 Detail (/repairs/:id)
BE
- [ ] `GET /api/repairs/:id`
- [ ] `POST /api/repairs/:id/pay|close|warranty|notify`
FE
- [ ] Timeline + materials table + actions
AC
- [ ] Close -> warranty doc generated; client notification queued

---

## 8) CRM & Marketing
### 8.1 Customers (/crm/customers)
BE
- [ ] `GET /api/customers?filters=`
- [ ] `POST /api/customers` | `PATCH /api/customers/:id`
- [ ] Signed URL for `id_images`
FE
- [ ] Search filters + profile drawer + messages sidebar
AC
- [ ] Blacklist toggle blocks POS/loans

### 8.2 Marketing (/crm/marketing)
BE
- [ ] `POST /api/mkt/templates` | `/segments` | `/campaigns`
- [ ] `/campaigns/:id/send` queues `notifications`
FE
- [ ] Template editor (variables), segment builder, send wizard, results dashboard
AC
- [ ] Sends tracked in `mkt_sends` and `notifications`

---

## 9) Reports
### 9.1 End Shift (/reports/shift-end)
BE
- [ ] `GET /api/reports/shift-end?shiftId=`; `POST /api/reports/shift-end/export`
FE
- [ ] Totals cards + discrepancy panel + export
AC
- [ ] Export PDF contains exact breakdown by tender

### 9.2 Loans Aging (/reports/loans-aging)
BE
- [ ] `GET /api/reports/loans-aging`
FE
- [ ] Bucket chart + table + export
AC
- [ ] Bucket sums match per-loan totals

---

## 10) E-Commerce
### 10.1 Channels (/ecom/channels)
BE
- [ ] `POST /api/ecom/channels` + test connection
- [ ] Ingest webhooks → `ecom_webhook_logs`
FE
- [ ] Channel cards + rules form + logs viewer
AC
- [ ] Full sync populates listings/orders

### 10.2 Listings (/ecom/products)
BE
- [ ] `GET /api/ecom/listings?filters=`
- [ ] `POST /api/ecom/listings/bulk` (publish/unpublish, edit, media, SEO)
FE
- [ ] Grid/table + media picker + SEO panel
AC
- [ ] Listing sync updates `last_synced` per channel

### 10.3 Orders (/ecom/orders)
BE
- [ ] Import: `POST /api/ecom/orders/import` (per channel)
- [ ] Fulfill: `POST /api/ecom/orders/:id/pick|pack|label|ship|cancel`
FE
- [ ] Tabs/Kanban + pick list + label modal + tracking bar
AC
- [ ] Shipping label/track no. saved; stock allocated

### 10.4 Returns (/ecom/returns)
BE
- [ ] `POST /api/ecom/returns/:id/approve|receive|refund|deny`
- [ ] Return items w/ condition → restock when allowed
FE
- [ ] RMA table + receive panel + refund modal
AC
- [ ] Refund posts to payments/credit notes; ledger updated

---

## 11) Settings (/settings/system)
BE
- [ ] `GET/POST /api/settings` (scope global|branch|user)
- [ ] POS config: tenders, drawer behavior, receipt layout
- [ ] Notifications providers test; integrations secrets
FE
- [ ] Tabs + form sections + test buttons
AC
- [ ] Saving updates `settings` JSON with proper scope

---

## 12) Security & Audit
- [ ] Signed URL policy for ID images (server only signs; FE stores path)
- [ ] Audit log middleware for approvals/overrides/voids/admin
- [ ] Error redaction (do not leak SQL/stack)

---

## 13) Seed & E2E
- [ ] Seed: branches, users, roles, categories, sample products, sample codes, gift cards, credit notes
- [ ] E2E Paths:
  - POS: sale → receipt, refund → restock
  - Loans: new → renew → redeem, forfeit → inventory
  - Layaway: new → payment → overdue → pawn link
  - Inventory: count session post, transfer receive
  - E-Com: import order → pick/pack/ship → return/refund

