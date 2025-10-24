## Global layout
- Build a shell with Left Sidebar (icons + labels), Top Bar (branch/till, shift, search, alerts), and Main content.
- Use Tailwind; dark mode default; responsive.

## Dashboard
- 3-column responsive grid of tiles matching these cards:
  Loans/Pawns Overview, Layaways, Sales & Purchases, Cash Drawer, Inventory Health,
  Repairs & Fabrications, Marketing & Engagement, Compliance, Employee Activity.
- Each card fetches server action (Next.js) for today’s metrics.

## POS
- New Sale page with item scan/search, cart lines, tender panel (cash/card/transfer),
  receipt preview, drawer kick. Offline queue support.
- Refund page (scan receipt → selectable lines → policy checks).

## Loans
- New Loan wizard (customer → collateral → terms → ticket print).
- Loan Detail with actions: Renew, Redeem, Rewrite, Take Payment.
- Due Today and Past Due lists with bulk SMS.

## Inventory
- Items grid (filters), Receive wizard (photos, barcode print), Transfers, Quarantine queue,
  Counts flow (snapshot → blind count → review → post & lock).

## Repairs / Fabrication
- New Repair / New Fabrication modals.
- Kanban with lanes: Diagnosing → Waiting Approval → In Progress → QA → Ready.
- Job detail with BOM, materials issue/return, payments, warranty card.

## CRM
- Customer list & profile; messages sidebar; loyalty points ledger.

## Cash
- Shifts list; Open/Close with denomination counter; Paid-In/Out; Cash Drop; Z Report archive.

## Marketing
- Campaigns list; Template editor (variables); Send wizard; Results dashboard.

## Compliance
- Queues: Police reports, OFAC hits, IRS8300 alerts; detail pages with resolve actions.

## Settings
- Tabs: General, Users & Roles, POS & Shifts, Inventory, Repairs/Fab, Vendors, Accounting,
  Notifications, Integrations, System, Personal.
