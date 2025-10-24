# App routes (Next.js /app router)

/
  dashboard (default home)
    widgets:
      loans_pawns, layaways, sales_purchases, cash_drawer,
      inventory_health, repairs_fab, marketing, compliance, employees

/pos
  /sale
  /buy
  /refund
  /gift-card
  /price-override

/loans
  /new
  /[loanId]
  /due-today
  /past-due
  /renewals
  /redemptions
  /calculator  (LTV/interest)

/layaways
  /new
  /[layawayId]
  /overdue

/inventory
  /items
  /receive
  /transfers
  /quarantine
  /counts
  /adjustments
  /suppliers
  /online-listings

/repairs
  /new
  /[repairId]
  /kanban

/fabrication
  /new
  /[jobId]
  /kanban

/crm
  /customers
  /customers/[customerId]
  /messages
  /loyalty

/marketing
  /campaigns
  /templates
  /segments
  /reviews

/compliance
  /police-reports
  /irs-8300
  /ofac
  /firearms (optional)

/cash
  /shifts
  /tills
  /drops
  /paid-in
  /paid-out
  /z-reports

/reports
  /daily
  /inventory
  /loans
  /sales
  /staff
  /custom

/admin
  /users
  /roles
  /devices
  /settings              # all app settings grouped in tabs

# API routes (app/api/*)
api/
  pos/*                  # /api/pos/sale, /api/pos/refund ...
  loans/*                # /api/loans/[id]/renew, /api/loans/new
  layaways/*             # /api/layaways/[id]/pay
  inventory/*            # /api/inventory/receive, /transfer, /adjust
  jobs/*                 # /api/repairs/* and /fabrication/*
  crm/*                  # /api/customers, /messages/send
  marketing/*            # /api/campaigns/send
  compliance/*           # /api/ofac/scan, /irs8300/check
  cash/*                 # /api/shifts/open|close, /drop, /paid-in, /paid-out
  reports/*              # server-side report builders
  webhooks/*             # PSPs, messaging, ecommerce
