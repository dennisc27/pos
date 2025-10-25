# Context: Pawnshop & POS Management App

## Overview
This project is a **full-featured pawnshop and retail point-of-sale system** built for jewelry and asset-based businesses.  
It manages **pawn loans, retail sales, layaways, repairs/fabrications, inventory, cash control, customers, and compliance** in one unified web and mobile application.

The app must be modular, real-time, and multi-branch, integrating with Supabase (auth, database, storage, realtime) and capable of connecting to payment processors (CardNet, Stripe, Azul), accounting systems, and messaging APIs (WhatsApp, SMS, email).

---

## Core Modules

### 1. POS & Front Counter
- New Sale, Refund/Void, Buy from Customer.
- Shift management (Open/Close, X/Z reports).
- Paid-In / Paid-Out / Cash Drop to Safe.
- Cash drawer tracking (expected vs actual).
- Barcode scanning and receipt printing.
- Multi-tender (cash, card, transfer, store credit, gift card).
- Real-time register feed for sales, drops, and refunds.

### 2. Pawn Loans
- Create, Renew, Redeem, or Rewrite loans.
- Automatic calculation of interest, storage, and fees.
- Track due dates, past-due loans, and forfeitures.
- Redemptions and Renewals summary per day.
- Loan ticket printing and barcode association.
- **Optional:** InstaPawn feature — online pre-pawn submissions (customers upload item photos, receive pre-approval, finalize in-store).

### 3. Layaways
- Create layaway plans and payment schedules.
- Track active, paid, and overdue layaways.
- Automatic reminders (SMS/Email/WhatsApp).
- Cancel and return logic with fees/refunds.

### 4. Inventory Management
- Receive, tag, and photograph items.
- Track serialized products, metals, and stones.
- Quarantine management (damaged, verification, hold).
- Transfers between stores/locations.
- Stock counts (cycle/full) with post & lock adjustments.
- Valuation (WAC/FIFO) and low-stock alerts.
- Integration with online listings (eBay/Amazon).

### 5. Repairs & Fabrications
- Job tickets for jewelry repairs and custom builds.
- Workflow: Diagnosing → Waiting Approval → In Progress → QC → Ready for Pickup.
- Material issue/return with grams/carat tracking.
- Labor and cost accounting per job.
- Warranty card generation and customer notification.
- Yield and profitability reports.

### 6. Customers (CRM)
- Customer profiles with ID/KYC data, photos, and contact info.
- Full transaction history (pawn, sales, layaway, repairs).
- Two-way messaging (SMS/WhatsApp).
- Loyalty points, coupons, and referral tracking.
- Blacklist / Watchlist system for restricted clients.

### 7. Marketing & Engagement
- SMS/Email/WhatsApp campaign manager.
- Message templates for promotions and reminders.
- Automated events (loan due, job ready, birthday offers).
- Review management and satisfaction feedback.
- Segment customers (VIP, dormant, frequent).

### 8. Compliance & Security
- Police report generation and digital submission.
- OFAC/SDN screening for customers.
- IRS 8300 form preparation for large transactions.
- Biometric/digital signature capture.
- Audit trails (transactions, users, system changes).
- Surveillance integration with timestamped receipts.

### 9. Financials
- Cash reconciliation per shift and branch.
- Deposits, safe movements, and over/short detection.
- Commission and incentive tracking.
- Export to accounting systems (QuickBooks, Odoo, etc.).
- Tax reporting (ITBIS/DGII integration).

### 10. Employees & Roles
- User management and permission groups.
- Time clock / attendance tracking.
- Commissions rules and sales goals.
- Hardware setup (drawer, printer, scale, camera).

### 11. E-Commerce (optional)
- Publish inventory to eBay/Amazon/Facebook Shop.
- Sync stock levels and pricing.
- Manage orders, shipments, and returns.

### 12. System Settings
- Company info, branding, branches, and hours.
- Tax rates, currency (DOP/USD), and tender types.
- Shift policies (float, tolerance, approval levels).
- Integrations (Supabase, PSPs, Accounting, Messaging).
- Data retention, backups, and logs viewer.

---

## Dashboard Overview (Home Page)
- **Loans/Pawns Overview** — New, Active, Due Today, Past Due, Redemptions & Renewals summary.  
- **Layaways** — Active, Paid, Overdue.  
- **Sales & Purchases** — Daily net sales, top-selling items, purchase intake.  
- **Cash Drawer** — Expected vs actual, paid-ins, paid-outs, cash drops.  
- **Inventory Health** — Low stock, aging items, items listed online, quarantined stock.  
- **Repairs & Fabrications** — In Progress, Waiting for Approval, Ready for Pickup.  
- **Marketing & Engagement** — Campaigns sent, messages pending, new reviews.  
- **Compliance** — Police reports pending, OFAC matches, IRS 8300 alerts.  
- **Employee Activity** — Logged-in users, commission progress, time-clock status.

---

## Tech Stack (preferred)
- **Frontend:** Next.js + React + Tailwind + TypeScript  
- **Backend:** Node.js + Supabase (Postgres + Auth + Storage + Realtime)  
- **Mobile:** React Native (Expo)  
- **Printing:** ESC/POS or USB/TCP printer integration  
- **Payments:** CardNet, Stripe, Azul  
- **Messaging:** Twilio/WhatsApp Business API, Email SMTP  

---

## Non-Functional Requirements
- Real-time updates for sales, shifts, and inventory.
- Role-based access and approval workflows.
- Offline queue for POS transactions.
- Audit logging for compliance and security.
- Multi-store and multi-currency support.
- Automatic backups and PDF report generation.

---

## Goal
Deliver a **modern, all-in-one pawnshop management system** with POS, loan management, fabrication, and compliance capabilities for the Dominican Republic market.  
It should feel as intuitive as Shopify POS but as specialized as Bravo Pawn Systems, with local DOP currency, ITBIS tax handling, and bilingual interface (Spanish/English).

---

