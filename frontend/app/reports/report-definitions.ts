export type ReportDefinition = {
  key: string;
  title: string;
  description: string;
  href?: string;
};

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    key: "sales",
    title: "Sales",
    description: "Review daily revenue, discounts, and tender mix across all sales channels."
  },
  {
    key: "purchase",
    title: "Purchase",
    description: "Track purchase orders, receiving performance, and supplier cost trends."
  },
  {
    key: "inventory-report",
    title: "Inventory Report",
    description: "Analyze on-hand quantities, aging buckets, and damaged stock adjustments."
  },
  {
    key: "marketing",
    title: "Marketing",
    description: "Measure campaign deliveries, redemptions, and engagement for promotions."
  },
  {
    key: "customer-report",
    title: "Customer Report",
    description: "Summarize customer growth, retention, and communication preferences."
  },
  {
    key: "expense",
    title: "Expense Report",
    description: "Break down expense postings by category to monitor operating spend."
  },
  {
    key: "income",
    title: "Income",
    description: "Review non-sales income streams and compare performance against targets."
  },
  {
    key: "pawns-created",
    title: "Pawns Created",
    description: "Review newly originated pawn loans, principal volume, and customer mix."
  },
  {
    key: "pawns-redeemed",
    title: "Pawns Redeemed",
    description: "Analyze redemption activity, tender methods, and recovered principal."
  },
  {
    key: "pawns-forfeited",
    title: "Pawns Forfeited",
    description: "Monitor forfeited tickets, associated principal, and conversion to stock."
  },
  {
    key: "pawns-on-sale",
    title: "Pawns on Sale",
    description: "Track forfeited inventory currently listed for sale and its valuation."
  },
  {
    key: "loan-book",
    title: "Loan Book",
    description: "Snapshot outstanding balances, interest accruals, and risk segmentation."
  },
  {
    key: "expire-loans",
    title: "Expire Loans",
    description: "Identify loans approaching maturity to trigger outreach and prevent delinquency."
  },
  {
    key: "voids-refund-ratio",
    title: "Voids / Refund Ratio by Staff",
    description: "Monitor voids and refunds by cashier to spot anomalies and training needs."
  },
  {
    key: "loans-aging",
    title: "Loans",
    description: "Monitor outstanding principal, accrued interest, and delinquency buckets.",
    href: "/reports/loans-aging"
  },
  {
    key: "shift-end",
    title: "Shift Reports",
    description: "Audit tender totals, drops, and over/short discrepancies for each shift.",
    href: "/reports/shift-end"
  },
  {
    key: "z-report",
    title: "Z-Report History",
    description: "Guarda cada cierre con el conteo del cajón y resalta variaciones que requieran auditoría.",
    href: "/reports/z-report"
  }
];
