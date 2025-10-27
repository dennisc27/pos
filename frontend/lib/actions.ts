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
    principalOut: { amount: 482000, currency: "DOP" as Currency },
    loansToday: 18,
    pawnsPastDue: 54,
    renewalsToday: 11,
    renewalsTrend: { direction: "up", label: "+2 vs yesterday" } as Trend
  };
}

export async function fetchLayawayMetrics() {
  return {
    newToday: 9,
    paymentsToday: { amount: 72000, currency: "DOP" as Currency },
    paymentsCount: 18
  };
}

export async function fetchSalesAndPurchases() {
  return {
    salesQtyToday: 93,
    salesTotalToday: { amount: 156000, currency: "DOP" as Currency },
    salesTrend: { direction: "up", label: "+12% vs last week" } as Trend,
    purchasesToday: { amount: 42000, currency: "DOP" as Currency }
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
    totalValue: { amount: 3920000, currency: "DOP" as Currency },
    transfersPending: 6
  };
}

export async function fetchRepairsAndFabrications() {
  return {
    inProgress: 23,
    readyForPickup: 4,
    avgTurnaround: 3.8,
    diagnosticsToday: 6
  };
}

export async function fetchMarketingEngagement() {
  return {
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

