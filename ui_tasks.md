# task_ui.v2.yaml
version: 2
about: >
  Single source of truth for navigation + per-page specs (purpose, data, actions, components, roles).
  Use this to scaffold pages, API handlers, and tests.

global_layout:
  shell:
    left_sidebar: { labels: true, icons: true }
    top_bar:
      items: [branch_switcher, till/shift_state, global_search, alerts, calculator, theme_toggle, role_badge]
    main_content: {}
  tech:
    framework: nextjs
    styles: tailwind
    mode_default: light
    responsive: true
  notes:
    - "Each dashboard card pulls a server action scoped to 'today' where applicable."
    - "All lists use virtualized tables with filter presets and infinite scroll."
    - "All monetary values stored/returned in cents."

roles:
  - cashier
  - seller
  - manager
  - marketing
  - admin

# --------------------------------------------------------------------
# DASHBOARD
# --------------------------------------------------------------------
pages:

  - route: /
    title: Dashboard
    purpose: >
      Executive overview of store activity and health for today, grouped by core domains.
    tiles:
      - key: loans_pawns_overview
        metric_sources: [loans_today, pawns_past_due, renewal_today]
      - key: layaways
        metric_sources: [layaways_new_today, layaways_payments_today]
      - key: sales_purchases
        metric_sources: [sales_qty_today, sales_total_today, purchases_today]
      - key: inventory
        metric_sources: [low_stock, aging]
      - key: repairs/fabrications
        metric_sources: [in_progress, ready_for_pickup]  
      - key: Marketing
        metric_sources: [messages_pending, new_reviews]

    actions: [view_reports, jump_to_list, export_pdf(just manager and admin)]
    components: [metric_tile_grid(3-col responsive)]
    roles_access: [cashier, seller, manager, marketing, admin]
    perf:
      server_actions_cache: short
      hydrate_on_visibility: true

# --------------------------------------------------------------------
# POS
# --------------------------------------------------------------------
  - route: /pos/sale
    title: New Sale
    purpose: Scan/search items, build cart, collect payment, print/issue receipt.
    primary_data:
      - product_search(indexed)
      - price_book(for code/version pricing)
      - taxes(itbis_rule: "net = round(price*0.82,2); tax = price - net")
    actions:
      - add_line
      - apply_discount(role: manager_required_if_policy_exceeded)
      - select_tender:[cash, card, transfer, gift_card, credit_note]
      - finalize_sale(kick_drawer_if_cash)
      - print_receipt(esc_pos)
    components: [scan_input, cart_table, tender_panel, receipt_preview]
    offline: queue_mutations + retry_all_banner
    roles_access: [cashier, seller, manager, admin]

  - route: /pos/refund
    title: Refunds
    purpose: Process returns against a prior invoice with policy checks and restock logic.
    primary_data: [invoice_lookup, lines_selectable, policy_engine]
    actions:
      - choose_lines_and_qty
      - set_condition:[new, used, damaged]
      - compute_refund_method:[cash, store_credit]
      - restock_if_condition_in({new, used})
      - post_refund_and_issue_credit_note_if_needed
    components: [invoice_scan, lines_picker, totals_box, policy_alerts]
    roles_access: [cashier, manager, admin]

  - route: /pos/buy
    title: Buy from Customer
    purpose: Intake item from a walk-in seller, capture photos.
    primary_data: [customer_lookup, item_intake, photo_capture, offer_calc]
    actions: [create_purchase_receipt, pay_out, print_receipt]
    components: [intake_form, photo_uploader, offer_panel, payout_modal]
    roles_access: [cashier, manager, admin]

  - route: /pos/gift-card
    title: Gift Card
    purpose: Issue/reload/redeem gift cards.
    primary_data: [gift_card_lookup]
    actions: [issue, reload, redeem]
    components: [gc_form, gc_balance_widget]
    roles_access: [cashier, manager, admin]

# --------------------------------------------------------------------
# LOANS / PAWNS
# --------------------------------------------------------------------
  - route: /loans/new
    title: New Loan (Pawn)
    purpose: Wizard to create a loan ticket with id_capture and collateral details.
    steps: [customer, id_capture, collateral, terms, ticket_print]
    primary_data: [customer_lookup, id_images, collateral_photos, interest_models]
    actions: [save_draft, approve_terms, create_ticket, print_ticket]
    components: [wizard, kyc_uploader, collateral_list, terms_panel, ticket_preview]
    roles_access: [cashier, seller, manager, admin]

  - route: /loans/:id
    title: Loan Detail
    purpose: Operational hub for a specific ticket (payments & lifecycle).
    primary_data: [loan_header, schedule, balance, history, alerts]
    actions:
      - take_payment(kind:[interest, advance])
      - renew
      - redeem
      - extension
      - rewrite
    components: [loan_header_card, action_buttons, schedule_table, activity_timeline]
    roles_access: [seller(only view), cashier, manager, admin]

  - route: /loans/:id/forfeit
    title: Forfeiture to Sales
    purpose: Convert collateral to saleable stock, keeping original pawn code lineage.
    primary_data: [loan_collateral, product_code_create]
    actions: [create_product_code, stock_ledger_post(reason:pawn_forfeit_in)]
    components: [collateral_picker, code_generator, post_result_toast]
    roles_access: [seller(only view the total due), cashier, manager, admin]

  - route: /loans/instapawn
    title: InstaPawn
    purpose: Online/fast-lane intake; pre-evaluation and expiring barcode for in-store.
    primary_data: [customer_intake, auto_pre_eval(optional), barcode_issue(expiry)]
    actions: [send_sms_whatsapp, convert_to_ticket]
    components: [intake_form, pre_eval_result, barcode_card]
    roles_access: [seller, cashier, manager, admin]

  - route: /loans/due
    title: Past-due
    purpose: Worklists for overdue tickets with bulk messaging.
    primary_data: [past_due_list]
    actions: [bulk_sms, bulk_whatsapp, print_list],
    components: [tablist, selectable_table, bulk_action_bar]
    roles_access: [seller, cashier, manager, admin]

# --------------------------------------------------------------------
# LAYAWAY
# --------------------------------------------------------------------
  - route: /layaway/new
    title: Create Layaway
    purpose: Reserve stock against an order and start a payment plan.
    primary_data: [order_builder, reservation_engine]
    actions: [start_layaway, print_agreement]
    components: [cart_table, payment_plan_panel, agreement_preview]
    roles_access: [cashier, seller, manager, admin]

  - route: /layaway/:id
    title: Layaway Detail
    purpose: Track payments, schedule, pawn the due money after due date, and release items on completion.
    primary_data: [layaway_header, schedule, balance]
    actions: [take_payment, pawn, cancel, complete_release]
    components: [header_card, payment_history, actions_bar]
    roles_access: [seller(take_payment, complete_release), cashier, manager, admin]

# --------------------------------------------------------------------
# PURCHASES
# --------------------------------------------------------------------
  - route: /purchases/new
    title: Receive Purchase
    purpose: Record supplier invoice and receive items (by product_code), print labels.
    primary_data: [supplier_lookup, codes, costs]
    actions: [add_lines, post_to_stock_ledger, print_qr_labels]
    components: [receive_form, lines_table, label_print_modal]
    roles_access: [cashier, manager, admin]

  - route: /purchases/returns
    title: Purchase Return
    purpose: Return items to supplier and issue credit note/refund.
    primary_data: [purchase_lookup, lines_selectable]
    actions: [post_decrement_stock, create_supplier_credit]
    components: [purchase_picker, lines_table, totals_box]
    roles_access: [cashier, manager, admin]

# --------------------------------------------------------------------
# REPAIRS / FABRICATION
# --------------------------------------------------------------------
  - route: /repairs/intake
    title: New Repair / Fabrication
    purpose: Create job with issue/diagnosis, capture media, and price estimate.
    primary_data: [customer_lookup, item_info, diagnosis, estimate]
    actions: [save, request_approval, take_deposit]
    components: [intake_form, photo_uploader, estimate_panel]
    roles_access: [cashier, seller, manager, admin]

  - route: /repairs/board
    title: Jobs Board
    purpose: Kanban to move jobs across states and manage materials.
    kanban_lanes: [Diagnosing, Waiting Approval, In Progress, QA, Ready]
    primary_data: [jobs_by_state, bom, materials_issue_return]
    actions: [move_lane, post_materials_issue, mark_ready, take_payment, warranty_card]
    components: [kanban, job_card, side_panel]
    roles_access: [cashier, manager, admin]

  - route: /repairs/:id
    title: Job Detail
    purpose: Full job context, approvals, payments, and warranty.
    primary_data: [job_header, approvals, payments, materials, notes]
    actions: [approve, deny, pay, close, generate_warranty, notify_client]
    components: [header_card, timeline, materials_table, actions_bar]
    roles_access: [cashier, manager, admin]

# --------------------------------------------------------------------
# INVENTORY
# --------------------------------------------------------------------
  - route: /inventory
    title: Items
    purpose: Browse/maintain products with filters and quick edits.
    primary_data: [products, codes, stock_levels, low_stock_flags]
    actions: [edit, archive, print_qr, split_combine, reclassify]
    components: [filters, grid_or_table, inline_edit, bulk_actions]
    roles_access: [manager, admin, cashier]; read_only: [seller, marketing]

  - route: /inventory/ops
    title: Operations
    purpose: End-to-end counts & variance resolution, plus transfers & quarantine queue.
    flows:
      counts: [snapshot, blind_count, review, post_and_lock]
      transfers: [create, approve, receive]
      quarantine: [queue_list, investigate, resolve_move_out]
    primary_data: [snapshot_qty_by_code, recent_movements, variances]
    actions: [start_count, add_scan, recount, post_adjustment, move_to_quarantine]
    components: [wizard, scan_input, variance_table, resolve_modal]
    roles_access: [manager, admin]

  - route: /inventory/barcode
    title: Print QR Labels
    purpose: Generate and print QR labels per product_code/version.
    primary_data: [codes_by_filter]
    actions: [layout_select, print]
    components: [codes_table, print_preview]
    roles_access: [seller, cashier, manager, admin]

  - route: /inventory/split-combine
    title: Split / Combine
    purpose: Manage composition/decomposition while preserving cost lineage.
    primary_data: [code_tree, cost_ledgers]
    actions: [split, combine, recalc_costs]
    components: [tree_view, split_wizard, combine_wizard]
    roles_access: [seller, cashier, manager, admin]

# --------------------------------------------------------------------
# CRM
# --------------------------------------------------------------------
  - route: /crm/customers
    title: Customers
    purpose: Manage customer profiles, IDs, comms, and loyalty ledger.
    primary_data: [customers, transactions_feed, loyalty_ledger]
    actions: [create, edit, blacklist_toggle, message, comment]
    components: [search_filters, profile_drawer, messages_sidebar]
    roles_access: [cashier, seller, manager, marketing, admin]

  - route: /crm/marketing
    title: Marketing
    purpose: Campaign lifecycle: templates → audience → schedule → results.
    primary_data: [templates, segments, products_readonly, analytics]
    actions: [create_template, schedule_send, view_results, export]
    components: [template_editor(variables), segment_builder, send_wizard, results_dashboard]
    roles_access: [cashier, seller, marketing, manager, admin]

# --------------------------------------------------------------------
# CASH
# --------------------------------------------------------------------
  - route: /cash/shift
    title: Shifts
    purpose: Open/close with denomination counter; support paid-in/out, drops; Z-report archive.
    primary_data: [shift_header, denomination_counts, paid_in_out, cash_drops, z_reports]
    actions: [open_with_pin, close_with_pin, suggest_drop, record_paid_in_out]
    components: [denomination_counter, drawer_actions, zreport_list]
    roles_access: [cashier, manager, admin]

  - route: /cash/movements
    title: Movements
    purpose: View and post cash movements for the current shift.
    primary_data: [movements_by_shift]
    actions: [post_movement(kind:deposit|cash_to_safe|drop|paid_in|paid_out|expense|income)]
    components: [movement_form, movement_table]
    roles_access: [cashier, manager, admin]

# --------------------------------------------------------------------
# REPORTS
# --------------------------------------------------------------------
  - route: /reports/shift-end
    title: End Shift Report
    purpose: Compare expected vs actual, compute over/short, flag discrepancies.
    primary_data: [shift_totals, payments_breakdown, refunds, counted_cash]
    actions: [export_pdf, send_email_whatsapp, flag_large_discrepancy]
    components: [totals_cards, discrepancy_panel, export_bar]
    roles_access: [manager, admin]; read_only: [cashier]

  - route: /reports/loans-aging
    title: Loans Aging / Expired
    purpose: Monitor aging buckets and expirations; trigger outreach.
    primary_data: [aging_buckets, expired_list]
    actions: [bulk_sms, export]
    components: [bucket_chart, table]
    roles_access: [manager, admin]; read_only: [cashier, marketing]
    
# --- E-COMMERCE ------------------------------------------------------
  - route: /ecom/products
    title: Online Listings
    purpose: Manage which products/codes are published online, sync price/stock, and control SEO.
    primary_data:
      - product_search(indexed)
      - code_versions(price/stock per branch)
      - listing_status(published, draft, archived)
      - seo_fields(title, description, slug, images)
    actions:
      - publish_unpublish
      - bulk_edit(price, stock, category, tags)
      - attach_media(primary_image, gallery)
      - edit_seo(title, description, slug, canonical)
      - sync_now(channels_selected)
    components: [filters, grid_or_table, bulk_bar, media_picker, seo_panel, sync_status_toast]
    roles_access: [manager, admin]; read_only: [cashier, marketing]

  - route: /ecom/channels
    title: Sales Channels
    purpose: Configure and monitor marketplace/site channels and their sync rules.
    primary_data:
      - channels(list: {name, status, last_sync, error_count})
      - mappings(categories, attributes)
      - sync_rules(stock: reserve, price: override/rounding, visibility)
      - webhooks(events: order_created, order_cancelled, return_requested, inventory_update)
    actions:
      - add_channel
      - edit_channel
      - test_connection
      - run_full_sync
      - view_logs
    components: [channel_cards, edit_drawer, rules_form, logs_viewer]
    roles_access: [manager, admin]

  - route: /ecom/orders
    title: Online Orders (Pick/Pack/Ship)
    purpose: Fulfillment workspace for online orders from all channels.
    primary_data:
      - orders(list by status: pending, picking, packed, shipped, cancelled)
      - allocations(stock by branch/code)
      - shipping_rates(labels, tracking)
      - packing_slip_templates
    actions:
      - assign_picker
      - print_pick_list(batch)
      - confirm_pick(scan_each_or_confirm_all)
      - pack(order_or_batch)
      - create_label_and_tracking
      - mark_shipped
      - split_shipment(optional)
      - cancel_with_reason(policy_guard)
    components: [kanban_or_tabs, order_table, pick_list_panel, pack_modal, label_modal, tracking_bar]
    roles_access: [cashier, manager, admin]  # cashier allowed for warehouse workflow

  - route: /ecom/returns
    title: Returns & Cancellations (RMA)
    purpose: Manage online RMAs and cancellations, restock by condition, issue refunds/credits.
    primary_data:
      - rmas(list by state: requested, approved, received, refunded, denied)
      - policy_engine(return_window, condition_matrix)
      - refund_methods(card, transfer, store_credit)
    actions:
      - approve_or_deny
      - receive_goods(scan_each)
      - set_condition:[new, used, damaged]
      - restock_if_condition_in({new, used})
      - issue_refund_or_credit_note
    components: [rma_table, policy_alerts, receive_panel, refund_modal]
    roles_access: [manager, admin]; read_only: [cashier]

  - route: /ecom/settings
    title: E-Commerce Settings
    purpose: Control catalog sync, pricing/rounding, inventory reservation, order import rules, shipping, taxes, and webhooks.
    primary_data:
      - catalog_sync(schedule, conflict_resolution)
      - pricing_rules(rounding, channel_overrides, tax_inclusive)
      - inventory_rules(reserve_on_order, release_on_cancel, oversell_threshold)
      - order_import(mapping, default_branch, customer_creation)
      - shipping_methods(services, packaging, label_provider)
      - taxes(itbis_inclusive, cross-border)
      - webhooks(callbacks, secrets)
    actions:
      - update_config
      - test_webhook
      - test_label_provider
      - run_backfill(import_historic_orders)
    components: [tabs, form_sections, test_buttons, backfill_runner]
    roles_access: [admin]; read_only: [manager]
# --------------------------------------------------------------------
# SETTINGS
# --------------------------------------------------------------------
  - route: /settings/system
    title: System Settings
    left_bar: [General, Users & Roles, POS & Shifts, Inventory, Repairs/Fab, Vendors, Accounting, Notifications, Integrations, System, Personal]
    purpose: Configure global behavior, role permissions, tenders, alerts, operating hours.
    primary_data: [env_flags, role_matrix, tenders, receipt_layout, alerts, schedules]
    actions: [update_config, test_drawer_kick, test_provider, save_roles]
    components: [tabs, form_sections, test_buttons]
    roles_access: [manager,admin]

# --------------------------------------------------------------------
# CROSS-CUTTING
# --------------------------------------------------------------------
components_shared:
  dialogs:
    - error
    - confirmation
    - unsaved_changes
    - permission_denied
    - delete_or_void
    - cash_drawer_action
    - close_shift_discrepancy
    - offline_queue_retry_all
    - photo_capture_permission
  widgets:
    - role_badge
    - branch_selector
    - shift_status
    - currency_switcher
analytics_events:
  - view_page
  - perform_action
  - error_occurred
  - approval_requested
  - approval_granted
security:
  pii:
    id_images: server_signed_urls_only
  audit:
    log: [approvals, overrides, voids, admin_actions]