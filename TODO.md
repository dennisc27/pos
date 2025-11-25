- [x] POS - Refunds (/backend/app/pos/refund) - BE - GET /api/invoices/:no
- [x] POS - Refunds (/backend/app/pos/refund) - BE - POST /api/refunds → creates sales_return + items
- [x] POS - Refunds (/backend/app/pos/refund) - BE - Restock when condition in (new, used)
- [x] POS - Refunds (/frontend/app/pos/refund) - FE - Invoice lookup field; selectable lines; totals_box; policy_alerts
- [x] POS - Refunds (/frontend/app/pos/refund) - FE - Choose refund method (cash/store_credit)
- [x] POS - Refunds (/pos/refund) - AC - Return line restocks if not damaged
- [x] POS - Refunds (/pos/refund) - AC - Credit note issued when store_credit
- [x] POS - Buy from Customer (/backend/app/pos/buy) - BE - POST /api/purchases + items
- [x] POS - Buy from Customer (/backend/app/pos/buy) - BE - Payout (cash) movement to current shift
- [x] POS - Buy from Customer (/backend/app/pos/buy) - BE - Attach photos (path only)
- [x] POS - Buy from Customer (/frontend/app/pos/buy) - FE - Intake form + photo uploader + offer panel
- [x] POS - Buy from Customer (/frontend/app/pos/buy) - FE - Print receipt
- [x] POS - Buy from Customer (/pos/buy) - AC - Posting creates purchase + ledger (purchase)
- [x] POS - Buy from Customer (/pos/buy) - AC - Drawer log reflects payout
- [x] POS - Gift Card (/backend/app/pos/gift-card) - BE - POST /api/gift-cards/issue | /reload | /redeem
- [x] POS - Gift Card (/backend/app/pos/gift-card) - BE - Update gift_card_ledger
- [x] POS - Gift Card (/frontend/app/pos/gift-card) - FE - Issue/reload/redeem forms + balance widget
- [x] POS - Gift Card (/pos/gift-card) - AC - Balance reflects deltas exactly; prevents overdraft
- [x] Cash & Shifts - Shifts (/backend/app/cash/shift) - BE - POST /api/shifts/open (with PIN), POST /api/shifts/:id/close
- [x] Cash & Shifts - Shifts (/backend/app/cash/shift) - BE - POST /api/shifts/:id/drop|paid-in|paid-out (kinds validated)
- [x] Cash & Shifts - Shifts (/backend/app/cash/shift) - BE - Compute expected vs actual; persist shift_reports.snapshot
- [x] Cash & Shifts - Shifts (/frontend/app/cash/shift) - FE - Denomination counter; drawer actions; Z-report list
- [x] Cash & Shifts - Shifts (/cash/shift) - AC - Over/short computed; discrepancy > threshold flagged
- [x] Cash & Shifts - Movements (/backend/app/cash/movements) - BE - POST /api/cash-movements (kinds: deposit, cash_to_safe, drop, paid_in, paid_out, expense, income)
- [x] Cash & Shifts - Movements (/frontend/app/cash/movements) - FE - Movement form + table filtered to current shift
- [x] Cash & Shifts - Movements (/cash/movements) - AC - Movement appears in shift end totals
- [x] Loans/Pawns - New Loan (/backend/app/loans/new) - BE - GET /api/interest-models
- [x] Loans/Pawns - New Loan (/backend/app/loans/new) - BE - POST /api/loans + collateral (photos paths) + schedule
- [x] Loans/Pawns - New Loan (/backend/app/loans/new) - BE - Signed URL flow for id_images (server signs, FE uploads)
- [x] Loans/Pawns - New Loan (/frontend/app/loans/new) - FE - Wizard steps: customer -> id_capture -> collateral -> terms -> ticket_print
- [x] Loans/Pawns - New Loan (/loans/new) - AC - Ticket number unique; schedule stores interest rows
- [x] Loans/Pawns - Loan Detail (/backend/app/loans/:id) - BE - GET /api/loans/:id (header, schedule, balance, history)
- [x] Loans/Pawns - Loan Detail (/backend/app/loans/:id) - BE - POST /api/loans/:id/pay (interest/advance)
- [x] Loans/Pawns - Loan Detail (/backend/app/loans/:id) - BE - POST /api/loans/:id/renew|redeem|extension|rewrite
- [x] Loans/Pawns - Loan Detail (/frontend/app/loans/:id) - FE - Header card + actions (respect capabilities_by_role)
- [x] Loans/Pawns - Loan Detail (/loans/:id) - AC - Renew updates due date & schedule; redeem closes loan
- [x] Loans/Pawns - Forfeiture (/backend/app/loans/:id/forfeit) - BE - Create product_code from collateral, push stock_ledger('pawn_forfeit_in')
- [x] Loans/Pawns - Forfeiture (/frontend/app/loans/:id/forfeit) - FE - Collateral picker -> code generator -> toast
- [x] Loans/Pawns - Forfeiture (/loans/:id/forfeit) - AC - Code appears in inventory; loan marked forfeited
- [x] Loans/Pawns - InstaPawn (/backend/app/loans/instapawn) - BE - POST /api/instapawn -> create intake + barcode token (expiry)
- [x] Loans/Pawns - InstaPawn (/backend/app/loans/instapawn) - BE - Send WhatsApp/SMS via notifications
- [x] Loans/Pawns - InstaPawn (/frontend/app/loans/instapawn) - FE - Intake form + barcode card + status
- [x] Loans/Pawns - InstaPawn (/loans/instapawn) - AC - Token converts to loan once scanned in-store
- [x] Loans/Pawns - Past-due (/backend/app/loans/due) - BE - GET /api/loans/past-due
- [x] Loans/Pawns - Past-due (/backend/app/loans/due) - BE - POST /api/loans/outreach (bulk messaging)
- [x] Loans/Pawns - Past-due (/frontend/app/loans/due) - FE - Selectable table + bulk action bar + print list
- [x] Loans/Pawns - Past-due (/loans/due) - AC - Messages queued; export CSV works
- [x] Layaway - Create Layaway (/backend/app/layaway/new) - BE - POST /api/layaways -> link to order (reserve stock)
- [x] Layaway - Create Layaway (/frontend/app/layaway/new) - FE - Reuse cart table; payment plan panel; agreement preview
- [x] Layaway - Create Layaway (/layaway/new) - AC - Layaway becomes active and stock is reserved
- [x] Layaway - Layaway Detail (/backend/app/layaway/:id) - BE - GET /api/layaways/:id
- [x] Layaway - Layaway Detail (/backend/app/layaway/:id) - BE - POST /api/layaways/:id/pay | /cancel | /complete
- [x] Layaway - Layaway Detail (/backend/app/layaway/:id) - BE - On overdue: /pawn → create loans row; mark layaway.pawned
- [x] Layaway - Layaway Detail (/frontend/app/layaway/:id) - FE - Payment history + actions_bar
- [x] Layaway - Layaway Detail (/layaway/:id) - AC - Overdue conversion creates linked pawn_loan_id
- [x] Inventory - Items (/backend/app/inventory) - BE - GET /api/inventory?filters=
- [x] Inventory - Items (/backend/app/inventory) - BE - PATCH /api/product-codes/:id quick edits
- [x] Inventory - Items (/backend/app/inventory) - BE - POST /api/labels/qr to generate printable sheet
- [x] Inventory - Items (/frontend/app/inventory) - FE - Table/grid; inline edit; bulk actions
- [x] Inventory - Items (/inventory) - AC - Quick edit persists; QR sheet downloads
- [x] Inventory - Ops (/backend/app/inventory/ops) - BE - POST /api/inventory/count-sessions
- [x] Inventory - Ops (/backend/app/inventory/ops) - BE - POST /api/inventory/count-lines (scan add)
- [x] Inventory - Ops (/backend/app/inventory/ops) - BE - POST /api/inventory/count-post → write stock_ledger('count_post')
- [x] Inventory - Ops (/backend/app/inventory/ops) - BE - Transfers: POST /api/inventory/transfers, /approve, /ship, /receive
- [x] Inventory - Ops (/backend/app/inventory/ops) - BE - Quarantine: /queue, /resolve
- [x] Inventory - Ops (/frontend/app/inventory/ops) - FE - Wizard: snapshot -> blind count -> review -> post
- [x] Inventory - Ops (/inventory/ops) - AC - Variances reflected in ledger; transfers move stock between branches
- [x] Inventory - Split/Combine (/backend/app/inventory/split-combine) - BE - POST /api/inventory/split → add product_code_components + ledger
- [x] Inventory - Split/Combine (/backend/app/inventory/split-combine) - BE - POST /api/inventory/combine → inverse
- [x] Inventory - Split/Combine (/frontend/app/inventory/split-combine) - FE - Tree view + split/combine wizards
- [x] Inventory - Split/Combine (/inventory/split-combine) - AC - Cost lineage conserved (sum(child costs) == parent cost within rounding rules)
- [x] Inventory - Barcode (/backend/app/inventory/barcode) - BE - GET /api/codes + POST /api/labels/print
- [x] Inventory - Barcode (/frontend/app/inventory/barcode) - FE - Codes table + print preview
- [x] Inventory - Barcode (/inventory/barcode) - AC - Print sends correct layout
- [x] Purchases - Receive (/backend/app/purchases/new) - BE - POST /api/purchases + lines
- [x] Purchases - Receive (/backend/app/purchases/new) - BE - On post -> ledger('purchase') and label generation
- [x] Purchases - Receive (/frontend/app/purchases/new) - FE - Receive form + lines table + label modal
- [x] Purchases - Receive (/purchases/new) - AC - Stock increases correctly
- [x] Purchases - Returns (/backend/app/purchases/returns) - BE - POST /api/purchase-returns
- [x] Purchases - Returns (/frontend/app/purchases/returns) - FE - Return lines UI + totals
- [x] Purchases - Returns (/purchases/returns) - AC - Supplier credit created
- [x] Repairs/Fabrication - Intake (/backend/app/repairs/intake) - BE - POST /api/repairs + photos
- [x] Repairs/Fabrication - Intake (/backend/app/repairs/intake) - BE - POST /api/repairs/:id/request-approval
- [x] Repairs/Fabrication - Intake (/frontend/app/repairs/intake) - FE - Intake form; estimate panel
- [x] Repairs/Fabrication - Intake (/repairs/intake) - AC - Approval status visible; deposit taken
- [x] Repairs/Fabrication - Board (/backend/app/repairs/board) - BE - GET /api/repairs?state=
- [x] Repairs/Fabrication - Board (/backend/app/repairs/board) - BE - POST /api/repairs/:id/move (lane transitions)
- [x] Repairs/Fabrication - Board (/backend/app/repairs/board) - BE - Materials issue/return endpoints write repair_materials and update stock ledger
- [x] Repairs/Fabrication - Board (/frontend/app/repairs/board) - FE - Kanban with job_card + side_panel
- [x] Repairs/Fabrication - Board (/repairs/board) - AC - Materials ledger adjusts inventory
- [x] Repairs/Fabrication - Detail (/backend/app/repairs/:id) - BE - GET /api/repairs/:id
- [x] Repairs/Fabrication - Detail (/backend/app/repairs/:id) - BE - POST /api/repairs/:id/pay|close|warranty|notify
- [x] Repairs/Fabrication - Detail (/frontend/app/repairs/:id) - FE - Timeline + materials table + actions
- [x] Repairs/Fabrication - Detail (/repairs/:id) - AC - Close -> warranty doc generated; client notification queued
- [x] CRM & Marketing - Customers (/backend/app/crm/customers) - BE - GET /api/customers?filters=
- [x] CRM & Marketing - Customers (/backend/app/crm/customers) - BE - POST /api/customers | PATCH /api/customers/:id
- [x] CRM & Marketing - Customers (/backend/app/crm/customers) - BE - Signed URL for id_images
- [x] CRM & Marketing - Customers (/frontend/app/crm/customers) - FE - Search filters + profile drawer + messages sidebar
- [x] CRM & Marketing - Customers (/crm/customers) - AC - Blacklist toggle blocks POS/loans
- [x] CRM & Marketing - Marketing (/backend/app/crm/marketing) - BE - POST /api/mkt/templates | /segments | /campaigns
- [x] CRM & Marketing - Marketing (/backend/app/crm/marketing) - BE - /campaigns/:id/send queues notifications
- [x] CRM & Marketing - Marketing (/frontend/app/crm/marketing) - FE - Template editor (variables), segment builder, send wizard, results dashboard
- [x] CRM & Marketing - Marketing (/crm/marketing) - AC - Sends tracked in mkt_sends and notifications
- [x] Reports - End Shift (/backend/app/reports/shift-end) - BE - GET /api/reports/shift-end?shiftId=; POST /api/reports/shift-end/export
- [x] Reports - End Shift (/frontend/app/reports/shift-end) - FE - Totals cards + discrepancy panel + export
- [x] Reports - End Shift (/reports/shift-end) - AC - Export PDF contains exact breakdown by tender
- [x] Reports - Loans Aging (/backend/app/reports/loans-aging) - BE - GET /api/reports/loans-aging
- [x] Reports - Loans Aging (/frontend/app/reports/loans-aging) - FE - Bucket chart + table + export
- [x] Reports - Loans Aging (/reports/loans-aging) - AC - Bucket sums match per-loan totals
- [x] E-Commerce - Channels (/backend/app/ecom/channels) - BE - POST /api/ecom/channels + test connection
- [x] E-Commerce - Channels (/backend/app/ecom/channels) - BE - Ingest webhooks → ecom_webhook_logs
- [x] E-Commerce - Channels (/frontend/app/ecom/channels) - FE - Channel cards + rules form + logs viewer
- [x] E-Commerce - Channels (/ecom/channels) - AC - Full sync populates listings/orders
- [x] E-Commerce - Listings (/backend/app/ecom/products) - BE - GET /api/ecom/listings?filters=
- [x] E-Commerce - Listings (/backend/app/ecom/products) - BE - POST /api/ecom/listings/bulk (publish/unpublish, edit, media, SEO)
- [x] E-Commerce - Listings (/frontend/app/ecom/products) - FE - Grid/table + media picker + SEO panel
- [x] E-Commerce - Listings (/ecom/products) - AC - Listing sync updates last_synced per channel
- [x] E-Commerce - Orders (/backend/app/ecom/orders) - BE - POST /api/ecom/orders/import (per channel)
- [x] E-Commerce - Orders (/backend/app/ecom/orders) - BE - POST /api/ecom/orders/:id/pick|pack|label|ship|cancel
- [x] E-Commerce - Orders (/frontend/app/ecom/orders) - FE - Tabs/Kanban + pick list + label modal + tracking bar
- [x] E-Commerce - Orders (/ecom/orders) - AC - Shipping label/track no. saved; stock allocated
- [x] E-Commerce - Returns (/backend/app/ecom/returns) - BE - POST /api/ecom/returns/:id/approve|receive|refund|deny
- [x] E-Commerce - Returns (/backend/app/ecom/returns) - BE - Return items w/ condition → restock when allowed
- [x] E-Commerce - Returns (/frontend/app/ecom/returns) - FE - RMA table + receive panel + refund modal
- [x] E-Commerce - Returns (/ecom/returns) - AC - Refund posts to payments/credit notes; ledger updated
- [x] Settings (/backend/app/settings/system) - BE - GET/POST /api/settings (scope global|branch|user)
- [x] Settings (/backend/app/settings/system) - BE - POS config: tenders, drawer behavior, receipt layout
- [x] Settings (/backend/app/settings/system) - BE - Notifications providers test; integrations secrets
- [x] Settings (/frontend/app/settings/system) - FE - Tabs + form sections + test buttons
- [x] Settings (/settings/system) - AC - Saving updates settings JSON with proper scope
- [x] Security & Audit - BE - Signed URL policy for ID images (server only signs; FE stores path)
- [x] Security & Audit - BE - Audit log middleware for approvals/overrides/voids/admin
- [x] Security & Audit - BE - Error redaction (do not leak SQL/stack)
- [x] Seed & E2E - BE - Seed: branches, users, roles, categories, sample products, sample codes, gift cards, credit notes
- [x] Seed & E2E - BE - E2E Paths: POS: sale → receipt, refund → restock; Loans: new → renew → redeem, forfeit → inventory; Layaway: new → payment → overdue → pawn link
- [x] dasboard: The text "command center" on the dashboard is white on light mode and it can't be seen.
- [x] dashboard: modify the dashboard to match ui_tasks.md description and metrics, and make it fit in one page.
- [x] pos -> new sale: remove the tender container and just leave the payment method as it already divides how the pay is divided. put the new order on the right column and make the receipt preview appear in a popup dialog when the payment button or the pay button is pressed.
- [x] pos -> new sale:  organize the right column to properly have in this order new order.
- [x] cash -> shift: when the enter button is pressed on one of the denomination move to the next denomination. Also allow the use of the arrows to move through the denominations.
- [x] modify the implementation of system to include a left with the options and a right panel with the settings to configure. it must include what's in this paraenthesis (Settings
* System Settings (Pawn toggle button, date)
* Company Settings (company info, icon, address)
* Localization (symbol RD$/$)
* Prefixes (just show them)
* Preference
* Appearance (Light/Dark, Keyboard shortcut layout, dashboard layout)
* Printer/Drawer
* Operating Hours
* Tax Rates (tax already included in price)
* Users and Roles (modify users user/cashier/manager, modify access scopes POS/cash/shift, inventory,repairs,report admin, report normal, accounting, settings, limits for refunds and paid outs)
* Shift (Over/Short Tolerance, Auto lock cash access after X minutes)
* POS:
o Payment methods (Cash, Card, Transfer,Credit Note)
o Receipt Printing(header/footer text, logo, tax breakdowns,auto-print,refund, paid-out
o Drawer Behaviour (auto open on cash sale (which ones), manual open pin)
o Alerts(suggest drops, refunds % of sale, max paid-out)
o Shift closure whatsapp/email/pdf recipients
o Expense category, income category
* Inventory
* Pawn
o Interest models by code
o Grace days
o Alerts by description, type or amount(filter by that will show a message).
* Notifications 
o Whatsapp/Email to clients for special events or ticket info (which events)
o Whatsapp Agent configuration (bot enable on or off) that allows the user to do this manually.
o Messaging Integrations
o AI/Automation Tools
* Maintenance
o Backup/Restore data (how often etc)
o Log Viewer 
* Compliance
o Camera view, transaction stamping
o Block id
)
- [x] make sure the settings pages for each settings option is implemented.
- [x] connect the dashboard to the database. Check the schema.sql file, and the previously created backend api so you don't create double api endpoints.
- [x] connect the point of sale (new sale, refund, buy, gift cards) to the database. Check the schema.sql file, and the previously created backend api so you don't create double api endpoints.
- [x] connect the cash (shift and movements pages) to the database. Check the schema.sql file, and the previously created backend api so you don't create double api endpoints.
- [x] connect the loans(new loan, past due, layaway) to the database. Check the schema.sql file, and the previously created backend api so you don't create double api endpoints.
- [x] connect the inventory(catalog, ops, split/combine, barcode) to the database. Check the schema.sql file, and the previously created backend api so you don't create double api endpoints.
- [x] connect the ecommerce(channels, listings, orders, returns) to the database. Check the schema.sql file, and the previously created backend api so you don't create double api endpoints.
- [x] connect the purchasing(overview, receive, returns) to the database. Check the schema.sql file, and the previously created backend api so you don't create double api endpoints.
- [x] connect the repairs(intake, board) to the database. Check the schema.sql file, and the previously created backend api so you don't create double api endpoints.
- [x] connect the crm(customers, marketing) to the database. Check the schema.sql file, and the previously created backend api so you don't create double api endpoints.
- [x] connect the reports(shift-end,loans aging) to the database. Check the schema.sql file, and the previously created backend api so you don't create double api endpoints.
- [x] connect the system(all pages) to the database. Check the schema.sql file, and the previously created backend api so you don't create double api endpoints.
- [x] check all pages on system and make sure they are correctly connected to the database
- [x] add a scrollbar to the ajustes left bar.


- [x] On dashboard: the metrics that are amounts (layaway payments today, sales total today, purchases today) are too big and it only has two numbers of the 6 or more digit number in the container box. Fix this by removing the DOP for a $, making the font smaller for this number and making the container wider.
- [x] on dashboard: remove text "No change vs yesterday" inside the renewal today box and new activity vs yesterday inside the purchases today box.
- [x] on point of sale: invoice lookup: when searching a inv it says "Internal Server Error"
- [x] on point of sale-new sale: Implement the see all inventory
- [x] on point of sale-new sale: Implement the change customer on new order,
- [x] on point of sale-new sale: remove the section Finalize sale. and remove the scan or type code as is duplicated.
- [x] on point of sale-new sale: when the button pay RD$##.## is pressed, open the same dialog as when payment is pressed.
- [x] on point of sale-new sale: keep the receipt preview but remove the total due section, remove the cash receive section with the change due field. And finally, keep the cancel button but change the apply tender for print and kick drawer.
- [x] on point of sale-new sale: when the price is changed to a higher price subtotal, grand total and cash drawer don't change, also remove the implementation of discount and just let the user modify the price without the need of the supervisor pin.
- [x] on customers: Failed to load customer (500) when trying to view a customer
- [x] on past-due: error Loan id must be a positive integer
- [x] on inventory-catalog: en la tabla quita sucursal y cambialo por descripcion para poner la descripcion del producto. En producto solo deja el codigo del producto. en Acciones quita la letra solo deja el icono de editar.
- [x] modify the buy page to look for the client when the document id is introduced, all the other information for that client should load.
- [x] buy: on offer panel have an input at the top for the offer that the user will introduce, bellow the offer keep the target margin as a slider with 40% as default, and then on offer to seller: change it for the expected resale price.
- [x] modifica la pagina de layway para que sea igual que la de point of sale - new sale, lo unico que debe tener fecha limite, deposito inicial, que sea sin cuotas, que no tenga metodo de deposito sino un payment method como en pos-new sale.
- [x] split and combine:    Que en dividir codigo, el componente resultante en vez de tener un dropdown sea un textfield donde se ponga la descripcion, la cantidad y costo del articulo resultante, y que al hacer click en registrar split se confirme el balance de cantidad*costo del padre = a la cantidades*costos de sus componentes.
- [x] split and combine:    Que en combinar en kit, el componente destino en vez de tener un dropdown sea un textfield donde se ponga la descripcion, la cantidad y costo del articulo resultante, y que al hacer click en registrar combinacion se confirme el balance de cantidad*costo del resultado = a la cantidades*costos de sus componentes.
- [x] purchasing - receive: el buscar no esta funcionando.
- [x] reports: include these reports below
(   
* Sales
* Purchase
* Loans
* Inventory Report (on hand, aging, damaged)
* Marketing (deliveries, redemptions)
* Customer Report
* Expense Report
* Income
* Shift Reports
* Pawns created / redeemed / forfeited.
* Loan Book
* Expire loans
* Voids/Refund with ratio by staff)
- [x] implement the "Purchases" report with all the inner reports, have a including a title, 1–3 metrics at the top (total bought, total qty, suppliers qty), a table at the bottom and a return button. it should also have at the beginning a dialog that asks for the start date and end date. Keep the format for dates dd/MM/yyyy. Reuse the components as much as possible with other reports (such as the start/end date dialog, page). Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] implement the "Inventory Report" report with all the inner reports, including a title, 1–3 metrics at the top(items with more than 3 months on sale, total of damaged items, total qty), a table at the bottom and a return button. it should also have at the beginning a dialog that asks for the start date and end date. Keep the format for dates dd/MM/yyyy. Reuse the components as much as possible with other reports (such as the start/end date dialog, page). Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] implement the "Marketing" report with all the inner reports, including a title, 1–3 metrics at the top, a table at the bottom and a return button. Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] implement the "Customer Report" report with all the inner reports, including a title, 1–3 metrics at the top, a table at the bottom and a return button. Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] implement the "Expenses" report with all the inner reports, including a title, 1–3 metrics at the top, a table at the bottom and a return button.it should also have at the beginning a dialog that asks for the start date and end date. Keep the format for dates dd/MM/yyyy. Reuse the components as much as possible with other reports (such as the start/end date dialog, page). Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] implement the "Incomes" report with all the inner reports, including a title, 1–3 metrics at the top, a table at the bottom and a return button.it should also have at the beginning a dialog that asks for the start date and end date. Keep the format for dates dd/MM/yyyy. Reuse the components as much as possible with other reports (such as the start/end date dialog, page). Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] implement the "Pawns Created" report with all the inner reports, including a title, 1–3 metrics at the top, a table at the bottom and a return button.it should also have at the beginning a dialog that asks for the start date and end date. Keep the format for dates dd/MM/yyyy. Reuse the components as much as possible with other reports (such as the start/end date dialog, page). Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] implement the "Pawns Redeemed" report with all the inner reports, including a title, 1–3 metrics at the top, a table at the bottom and a return button.it should also have at the beginning a dialog that asks for the start date and end date. Keep the format for dates dd/MM/yyyy. Reuse the components as much as possible with other reports (such as the start/end date dialog, page). Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] implement the "Pawns Forfeited" report with all the inner reports, including a title, 1–3 metrics at the top, a table at the bottom and a return button.it should also have at the beginning a dialog that asks for the start date and end date. Keep the format for dates dd/MM/yyyy. Reuse the components as much as possible with other reports (such as the start/end date dialog, page). Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] implement the "Pawns on Sale" report with all the inner reports, including a title, 1–3 metrics at the top, a table at the bottom and a return button.it should also have at the beginning a dialog that asks for the start date and end date. Keep the format for dates dd/MM/yyyy. Reuse the components as much as possible with other reports (such as the start/end date dialog, page). Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] implement the "Loan Book" report with all the inner reports, including a title, 1–3 metrics at the top, a table at the bottom and a return button.it should also have at the beginning a dialog that asks for the start date and end date. Keep the format for dates dd/MM/yyyy. Reuse the components as much as possible with other reports (such as the start/end date dialog, page). Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] implement the "Products Aged" report with all the inner reports, including a title, 1–3 metrics at the top, a table at the bottom and a return button. Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] implement the "Voids / Refund by staff who sold it" report with all the inner reports, including a title, 1–3 metrics at the top, a table at the bottom and a return button.it should also have at the beginning a dialog that asks for the start date and end date. Keep the format for dates dd/MM/yyyy. Reuse the components as much as possible with other reports (such as the start/end date dialog, page). Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] implement the "Shift Reports" report with all the inner reports, including a title, 1–3 metrics at the top, a table at the bottom and a return button.it should also have at the beginning a dialog that asks for the start date and end date. Keep the format for dates dd/MM/yyyy. Reuse the components as much as possible with other reports (such as the start/end date dialog, page). Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] on point of sale-> new sale: delete the button collect payment as it is redundant. Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] on point of sale-> new sale: where the button "See all inventory" is, put the button All products and remove the "see all inventory". Make sure the report uses the database structure on schema.sql, if not add it to the file (extraschema.sql)
- [x] on point of sale-> buy: change the seller profile to match the customer change and add component that the new sale has. See picture on pics\customer.png.
- [x] on point of sale-> buy: change the offer panel to have just the offer to seller and it must be just an input textfield that the user will fill.
- [x] on purchasing - receive add a supplier
- [x] Rework - On all reports, create quick access buttons for Pawns Created, Pawns Redeemed, Pawns Forfeited and Pawns on Sale.
- [x] Rework - Implement the "Pawns Created" report with metrics, table, and date dialog using schema.sql data.
- [x] Rework - Implement the "Pawns Redeemed" report with metrics, table, and date dialog using schema.sql data.
- [x] Rework - Implement the "Pawns Forfeited" report with metrics, table, and date dialog using schema.sql data.
- [x] Rework - Implement the "Pawns on Sale" report with metrics, table, and date dialog using schema.sql data.
- [x] Rework - Implement the "Loan Book" report with metrics, table, and date dialog using schema.sql data.
- [x] Rework - Implement the "Products Aged" report with metrics, table, and date dialog using schema.sql data.
- [x] Rework - Implement the "Voids / Refund by staff who sold it" report with metrics, table, and date dialog using schema.sql data.
- [x] On point o sale - new sale page: when the sale is paid and completed, the products doesn't update the new quantities available in stock unless the page is refreshed. Please update them after completing the sale, so the user can make another sale right away with the right qty of available item in stock.
- [x] repairs intake page: the change and add buttons for customer are not working. check the implementation on new sale for guidance. Also make the job number auto generated and make it disabled so the user can change it.\
- [x] make sure the repairs intake page is properly connected to the database and uses the right columns on schema.sql
- [x] make sure the entire app uses the format for date dd/MM/yyyy and not the mm/dd/yyyy.
- [x] on the inventory section on the left bar, add a dashboard ops button that will include a title, metrics (zones, active counts, sucursales), and an inventory count history table with its status.
- [x] Inventory - OPS Dashboard (/inventory/ops/dashboard) - BE - Aggregate total stock value from product_code_versions.qty_on_hand * cost_cents, flag low-stock based on available stock vs reserved/zero, surface today’s stock_ledger movements, and list inv_count_sessions in open/review status as pending counts/history.
- [x] Inventory - OPS Dashboard (/frontend/app/inventory/ops/dashboard) - FE - Cards for stock value and low-stock alerts, feed of today’s stock_ledger entries, and a table of open/review count sessions sourced from the OPS APIs.
- [x] Inventory - OPS Schema Alignment (/schema.sql, /extraschema.sql) - Validate OPS flows against existing tables (product_code_versions, stock_ledger, inv_count_sessions, inv_count_lines); document any required additions such as bin/location metadata or reorder thresholds without breaking current enums/statuses (scope full|cycle, status open|review|posted|cancelled).
- [x] Inventory - Count Sessions (/backend/app/inventory/ops) - BE - CRUD endpoints matching inv_count_sessions (scope full/cycle, status transitions open→review→posted|cancelled), support location/branch scoping, assign counters, warn if stock_ledger activity occurs after snapshot_at, and validate writes against inv_count_lines.
- [x] Inventory - Count Sessions (/frontend/app/inventory/ops/count-sessions) - FE - UI to create/edit sessions with name/type, branch/location scope, start/due dates, assigned counters, status badges for open/review/posted/cancelled, and freeze/movement warnings tied to API responses.
- [x] Inventory - Counting Interface (/backend/app/inventory/ops/count) - BE - Endpoints for barcode/SKU/name lookup using product_codes/product_code_versions, accumulate multiple counts per item/location, auto-save inv_count_lines rows, and return recent scans with summed counted_qty per session.
- [x] Inventory - Counting Interface (/frontend/app/inventory/ops/count) - FE - Responsive scan/search/browse UI showing item details and branch/bin context, counted quantity entry with auto-save feedback, and last scanned list with aggregated quantities per session.
- [x] Inventory - Discrepancy Review (/backend/app/inventory/ops/review) - BE - Compare expected vs counted using inv_count_lines vs product_code_versions.qty_on_hand, filters for variance size/value and +/- direction, allow recount requests/comments, and on approval create stock_ledger entries with posted_by/posted_at updates on the session.
- [x] Inventory - Discrepancy Review (/frontend/app/inventory/ops/review) - FE - Comparison grid with filters, recount request action, per-line comments, and approval UI that posts adjustments and reflects reviewer/date from the backend.
- [x] Inventory - Reporting & Analytics (/reports/inventory/ops) - BE - Reports for inventory valuation (branch/category/supplier), stock movements by date/type/location/user, count history (inv_count_sessions/lines), aged inventory (no stock_ledger movement for X days), and low stock using existing quantity fields.
- [x] Inventory - Reporting & Analytics (/frontend/app/reports/inventory/ops) - FE - Report pages with filters/date ranges and tables/cards for valuation, movement logs, count history, aged inventory, and low-stock summaries using the OPS report endpoints.
- [x] the dark mode is not working properly on  loans/due, inventory,
- [x] on the top header bar add a plus button before the search bar that will show a dialog (menu style) with the title new and the following icons with text buttons in a two row: Pawn, Sale, Layaway, Purchase, Buy, Refund, Repair, Customer.
- [x] on the top header bar: when the search field is used a new page with a table will appear displaying matching (sales, refunds, sales, layaways, pawns, buys).