"use server";

type Currency = "DOP" | "USD";

type MonetaryMetric = {
  amount: number;
  currency?: Currency;
};

type Trend = {
  direction: "up" | "down" | "flat";
  label: string;
};

export async function fetchLoansOverview() {
  return {
    newLoans: 8,
    activeLoans: 312,
    dueToday: 27,
    pastDue: 54,
    redemptions: 19,
    renewals: 11,
    principalOut: { amount: 482000, currency: "DOP" as Currency },
    trend: { direction: "up", label: "+6% vs yesterday" } as Trend
  };
}

export async function fetchLayawayMetrics() {
  return {
    active: 64,
    paid: 12,
    overdue: 9,
    depositsToday: { amount: 72000, currency: "DOP" as Currency },
    remindersSent: 18
  };
}

export async function fetchSalesAndPurchases() {
  return {
    netSales: { amount: 156000, currency: "DOP" as Currency },
    transactions: 93,
    avgTicket: { amount: 1677, currency: "DOP" as Currency },
    topCategory: "Gold Jewelry",
    buysFromCustomers: { amount: 42000, currency: "DOP" as Currency },
    refunds: 2,
    trend: { direction: "up", label: "+12% vs last week" } as Trend
  };
}

export async function fetchCashDrawer() {
  return {
    expected: { amount: 98500, currency: "DOP" as Currency },
    actual: { amount: 98150, currency: "DOP" as Currency },
    variance: { amount: -350, currency: "DOP" as Currency },
    paidIns: { amount: 4500, currency: "DOP" as Currency },
    paidOuts: { amount: 2300, currency: "DOP" as Currency },
    dropsToSafe: { amount: 25000, currency: "DOP" as Currency }
  };
}

export async function fetchInventoryHealth() {
  return {
    lowStock: 18,
    aging: 42,
    listedOnline: 120,
    quarantined: 5,
    totalValue: { amount: 3920000, currency: "DOP" as Currency },
    transfersPending: 6
  };
}

export async function fetchRepairsAndFabrications() {
  return {
    inProgress: 23,
    waitingApproval: 7,
    readyForPickup: 4,
    diagnosticsToday: 6,
    avgTurnaround: 3.8,
    trend: { direction: "down", label: "-1 day vs last month" } as Trend
  };
}

export async function fetchMarketingEngagement() {
  return {
    campaignsSent: 3,
    messagesPending: 45,
    newReviews: 5,
    averageRating: 4.7,
    responsesRequired: 2
  };
}

export async function fetchComplianceStatus() {
  return {
    policeReportsPending: 2,
    ofacMatches: 1,
    irsAlerts: 0,
    auditsThisWeek: 4,
    evidenceUploads: 12
  };
}

export async function fetchEmployeeActivity() {
  return {
    teamLoggedIn: 14,
    commissionsProgress: "68% of goal",
    lateClockIns: 1,
    openTasks: 9,
    trainingDue: 3
  };
}

export function formatCurrency(metric: MonetaryMetric) {
  const currency = metric.currency ?? "DOP";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(metric.amount);
}
