export type ReportDefinition = {
  key: string;
  title: string;
  description: string;
  href?: string;
  placeholder?: boolean;
  insights?: string[];
};

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    key: "sales",
    title: "Sales",
    description: "Review daily revenue, discounts, and tender mix across all sales channels.",
    placeholder: true,
    insights: [
      "Gross vs. net sales by branch and channel",
      "Discount impact compared with prior periods",
      "Tender breakdown for balancing with drawer totals"
    ]
  },
  {
    key: "purchase",
    title: "Purchase",
    description: "Track purchase orders, receiving performance, and supplier cost trends.",
    placeholder: true,
    insights: [
      "Received vs. expected quantities per supplier",
      "Average cost trend by category",
      "Open purchase orders approaching promised dates"
    ]
  },
  {
    key: "inventory-report",
    title: "Inventory Report",
    description: "Analyze on-hand quantities, aging buckets, and damaged stock adjustments.",
    placeholder: true,
    insights: [
      "Stock on hand by branch and category",
      "Aging ladder that highlights slow movers",
      "Damaged inventory requiring write-offs"
    ]
  },
  {
    key: "marketing",
    title: "Marketing",
    description: "Measure campaign deliveries, redemptions, and engagement for promotions.",
    placeholder: true,
    insights: [
      "Delivery vs. redemption rates per campaign",
      "Audience segments generating the highest ROI",
      "Trend of automated vs. manual sends"
    ]
  },
  {
    key: "customer-report",
    title: "Customer Report",
    description: "Summarize customer growth, retention, and communication preferences.",
    placeholder: true,
    insights: [
      "New vs. returning customers by timeframe",
      "Top customers by purchase frequency",
      "Opt-in status for marketing communications"
    ]
  },
  {
    key: "expense",
    title: "Expense Report",
    description: "Break down expense postings by category to monitor operating spend.",
    placeholder: true,
    insights: [
      "Spend vs. budget by expense category",
      "Unusual spikes requiring approval review",
      "Vendors contributing the highest monthly cost"
    ]
  },
  {
    key: "income",
    title: "Income",
    description: "Review non-sales income streams and compare performance against targets.",
    placeholder: true,
    insights: [
      "Income by category and branch",
      "Variance vs. prior period",
      "Recurring vs. one-time income entries"
    ]
  },
  {
    key: "pawns-lifecycle",
    title: "Pawns Created / Redeemed / Forfeited",
    description: "Track pawn ticket lifecycle to understand redemption rates and forfeitures.",
    placeholder: true,
    insights: [
      "Tickets created vs. redeemed within the period",
      "Outstanding principal tied to forfeited items",
      "Average days in pawn before redemption"
    ]
  },
  {
    key: "loan-book",
    title: "Loan Book",
    description: "Snapshot outstanding balances, interest accruals, and risk segmentation.",
    placeholder: true,
    insights: [
      "Active loans by status and branch",
      "Principal vs. interest outstanding",
      "Risk scores or collateral coverage alerts"
    ]
  },
  {
    key: "expire-loans",
    title: "Expire Loans",
    description: "Identify loans approaching maturity to trigger outreach and prevent delinquency.",
    placeholder: true,
    insights: [
      "Loans expiring within configurable windows",
      "Contact attempts or reminders sent",
      "Balances at risk of becoming past due"
    ]
  },
  {
    key: "voids-refund-ratio",
    title: "Voids / Refund Ratio by Staff",
    description: "Monitor voids and refunds by cashier to spot anomalies and training needs.",
    placeholder: true,
    insights: [
      "Voids and refunds count vs. completed sales",
      "High-risk transactions by staff member",
      "Supervisor approvals required per variance"
    ]
  },
  {
    key: "loans-aging",
    title: "Loans",
    description: "Monitor outstanding principal, accrued interest, and delinquency buckets.",
    href: "/reports/loans-aging",
    placeholder: false
  },
  {
    key: "shift-end",
    title: "Shift Reports",
    description: "Audit tender totals, drops, and over/short discrepancies for each shift.",
    href: "/reports/shift-end",
    placeholder: false
  }
];

export const PLACEHOLDER_REPORTS = REPORT_DEFINITIONS.filter((report) => report.placeholder !== false).reduce<Record<string, ReportDefinition>>((acc, report) => {
  const path = report.href ?? `/reports/${report.key}`;
  if (path === `/reports/${report.key}`) {
    acc[report.key] = report;
  }
  return acc;
}, {});
