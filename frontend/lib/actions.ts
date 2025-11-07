"use server";

import { cache } from "react";

type Currency = "DOP" | "USD";

type MonetaryMetric = {
  amount: number;
  currency?: Currency;
};

type Trend = {
  direction: "up" | "down" | "flat";
  label: string;
};

type DashboardSummary = {
  loans: {
    principalOutCents: number;
    loansToday: number;
    pawnsPastDue: number;
    renewalsToday: number;
    renewalsYesterday: number;
  };
  layaways: {
    newToday: number;
    paymentsTodayCents: number;
    paymentsCount: number;
  };
  sales: {
    salesTotalTodayCents: number;
    salesTotalYesterdayCents: number;
    salesQtyToday: number;
    purchasesTodayCents: number;
  };
  inventory: {
    lowStock: number;
    aging: number;
    totalValueCents: number;
    transfersPending: number;
  };
  repairs: {
    inProgress: number;
    readyForPickup: number;
    avgTurnaroundHours: number;
    diagnosticsToday: number;
  };
  marketing: {
    messagesPending: number;
    newReviews: number;
    averageRating: number;
    responsesRequired: number;
  };
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const fetchDashboardSummary = cache(async (): Promise<DashboardSummary> => {
  const response = await fetch(`${API_BASE_URL}/api/dashboard/summary`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to load dashboard metrics");
  }

  return (await response.json()) as DashboardSummary;
});

export async function fetchLoansOverview() {
  const summary = await fetchDashboardSummary();
  const { loans } = summary;
  const renewalsDifference = loans.renewalsToday - loans.renewalsYesterday;

  let direction: Trend["direction"] = "flat";
  let label = "No change vs yesterday";

  if (renewalsDifference > 0) {
    direction = "up";
    label = `+${renewalsDifference} vs yesterday`;
  } else if (renewalsDifference < 0) {
    direction = "down";
    label = `${renewalsDifference} vs yesterday`;
  }

  return {
    principalOut: { amount: (loans.principalOutCents ?? 0) / 100, currency: "DOP" as Currency },
    loansToday: loans.loansToday,
    pawnsPastDue: loans.pawnsPastDue,
    renewalsToday: loans.renewalsToday,
    renewalsTrend: { direction, label } as Trend
  };
}

export async function fetchLayawayMetrics() {
  const summary = await fetchDashboardSummary();
  const { layaways } = summary;

  return {
    newToday: layaways.newToday,
    paymentsToday: { amount: (layaways.paymentsTodayCents ?? 0) / 100, currency: "DOP" as Currency },
    paymentsCount: layaways.paymentsCount
  };
}

export async function fetchSalesAndPurchases() {
  const summary = await fetchDashboardSummary();
  const { sales } = summary;
  const todayTotal = sales.salesTotalTodayCents ?? 0;
  const yesterdayTotal = sales.salesTotalYesterdayCents ?? 0;
  const difference = todayTotal - yesterdayTotal;

  let direction: Trend["direction"] = "flat";
  let label: string;

  if (yesterdayTotal === 0) {
    if (todayTotal > 0) {
      direction = "up";
      label = "New activity vs yesterday";
    } else {
      label = "No change vs yesterday";
    }
  } else if (todayTotal === 0) {
    direction = "down";
    label = "No sales yet today";
  } else {
    const percentChange = (difference / yesterdayTotal) * 100;
    if (percentChange > 0) {
      direction = "up";
      const rounded = Math.round(percentChange);
      label = `+${rounded}% vs yesterday`;
    } else if (percentChange < 0) {
      direction = "down";
      const rounded = Math.round(Math.abs(percentChange));
      label = `${rounded}% lower than yesterday`;
    } else {
      label = "No change vs yesterday";
    }
  }

  return {
    salesQtyToday: sales.salesQtyToday,
    salesTotalToday: { amount: todayTotal / 100, currency: "DOP" as Currency },
    salesTrend: { direction, label } as Trend,
    purchasesToday: { amount: (sales.purchasesTodayCents ?? 0) / 100, currency: "DOP" as Currency }
  };
}

export async function fetchCashDrawer() {
  const summary = await fetchDashboardSummary();
  const { sales } = summary;

  const expected = sales.salesTotalTodayCents / 100;
  return {
    expected: { amount: expected, currency: "DOP" as Currency },
    actual: { amount: expected, currency: "DOP" as Currency },
    variance: { amount: 0, currency: "DOP" as Currency },
    paidIns: { amount: 0, currency: "DOP" as Currency },
    paidOuts: { amount: 0, currency: "DOP" as Currency },
    dropsToSafe: { amount: 0, currency: "DOP" as Currency }
  };
}

export async function fetchInventoryHealth() {
  const summary = await fetchDashboardSummary();
  const { inventory } = summary;

  return {
    lowStock: inventory.lowStock,
    aging: inventory.aging,
    totalValue: { amount: (inventory.totalValueCents ?? 0) / 100, currency: "DOP" as Currency },
    transfersPending: inventory.transfersPending
  };
}

export async function fetchRepairsAndFabrications() {
  const summary = await fetchDashboardSummary();
  const { repairs } = summary;

  return {
    inProgress: repairs.inProgress,
    readyForPickup: repairs.readyForPickup,
    avgTurnaround: (repairs.avgTurnaroundHours ?? 0) / 24,
    diagnosticsToday: repairs.diagnosticsToday
  };
}

export async function fetchMarketingEngagement() {
  const summary = await fetchDashboardSummary();
  const { marketing } = summary;

  return {
    messagesPending: marketing.messagesPending,
    newReviews: marketing.newReviews,
    averageRating: marketing.averageRating,
    responsesRequired: marketing.responsesRequired
  };
}

export async function fetchComplianceStatus() {
  return {
    policeReportsPending: 0,
    ofacMatches: 0,
    irsAlerts: 0,
    auditsThisWeek: 0,
    evidenceUploads: 0
  };
}

export async function fetchEmployeeActivity() {
  return {
    teamLoggedIn: 0,
    commissionsProgress: "0% of goal",
    lateClockIns: 0,
    openTasks: 0,
    trainingDue: 0
  };
}

