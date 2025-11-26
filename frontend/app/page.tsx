import { Suspense } from "react";
import {
  ActivitySquare,
  BarChart3,
  HandCoins,
  LineChart,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wrench
} from "lucide-react";
import { InsightCard, InsightStat, SparkBar } from "@/components/dashboard/insight-card";
import { MiniSparkline } from "@/components/dashboard/mini-sparkline";
import { MultiSeriesLineChart } from "@/components/dashboard/multi-series-line-chart";
import { DashboardSectionSkeleton } from "@/components/dashboard/skeleton";
import { InventoryHealthCard } from "@/components/dashboard/inventory-health-card";
import { LayawaysCard } from "@/components/dashboard/layaways-card";
import { LoansOverviewCard } from "@/components/dashboard/loans-overview-card";
import { MarketingEngagementCard } from "@/components/dashboard/marketing-engagement-card";
import { RepairsFabricationsCard } from "@/components/dashboard/repairs-fabrications-card";
import { SalesPurchasesCard } from "@/components/dashboard/sales-purchases-card";
import {
  fetchLayawayMetrics,
  fetchLoansOverview,
  fetchRepairsAndFabrications,
  fetchSalesAndPurchases,
  fetchTimeSeriesData
} from "@/lib/actions";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

async function loadInsight<T>(loader: () => Promise<T>): Promise<{ data?: T; error?: string }> {
  try {
    const data = await loader();
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to load data" };
  }
}

function generateSeries(seed: number, length: number, volatility = 0.08) {
  const starting = Math.max(seed, 8);
  return Array.from({ length }, (_, index) => {
    const wave = Math.sin(index / 3) * volatility;
    const drift = (index / Math.max(length - 1, 1)) * (volatility / 2);
    const value = starting * (1 + wave + drift);
    return Math.max(0, Math.round(value));
  });
}

function buildDayLabels(days: number) {
  const today = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
}

function buildMonthLabels(months: number) {
  const now = new Date();
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(now);
    date.setMonth(now.getMonth() - (months - index - 1));
    return date.toLocaleDateString("en-US", { month: "short" });
  });
}

export default async function DashboardPage() {
  const [salesState, loansState, layawayState, repairsState, timeSeriesState] = await Promise.all([
    loadInsight(fetchSalesAndPurchases),
    loadInsight(fetchLoansOverview),
    loadInsight(fetchLayawayMetrics),
    loadInsight(fetchRepairsAndFabrications),
    loadInsight(fetchTimeSeriesData)
  ]);

  const sales = salesState.data;
  const loans = loansState.data;
  const layaways = layawayState.data;
  const repairs = repairsState.data;
  const timeSeries = timeSeriesState.data;

  // Extract 7-day trends from time series data (last 7 days)
  const get7DayTrend = (dailyData: number[] | undefined) => {
    if (!dailyData || dailyData.length < 7) return [];
    return dailyData.slice(-7);
  };

  const sales7Day = get7DayTrend(timeSeries?.daily.sales);
  const pawns7Day = get7DayTrend(timeSeries?.daily.pawns);
  const layaways7Day = get7DayTrend(timeSeries?.daily.layaways);

  // Get yesterday's values for comparison (second to last day in 7-day trend, or use summary data)
  const getYesterdayValue = (trend: number[]) => {
    if (trend.length >= 2) return trend[trend.length - 2];
    return undefined;
  };

  // Use actual database values - allow zeros to show properly
  const salesBars = sales
    ? [
        sales.salesQtyToday ?? 0,
        Math.round(sales.salesTotalToday.amount) || 0,
        Math.round(sales.purchasesToday.amount) || 0
      ]
    : [0, 0, 0];
  
  // Previous values for comparison (yesterday or last available)
  const salesBarsPrevious = sales7Day.length >= 2 
    ? [
        getYesterdayValue(sales7Day) ?? 0,
        getYesterdayValue(sales7Day) ?? 0, // Approximate - would need separate API for sales amount
        getYesterdayValue(sales7Day) ?? 0  // Approximate - would need separate API for purchases
      ]
    : undefined;

  const pawnBars = loans
    ? [loans.loansToday ?? 0, loans.pawnsPastDue ?? 0, loans.renewalsToday ?? 0]
    : [0, 0, 0];
  const pawnBarsPrevious = pawns7Day.length >= 2
    ? [
        getYesterdayValue(pawns7Day) ?? 0,
        loans?.pawnsPastDue ?? 0, // Past due doesn't change day-to-day the same way
        loans?.renewalsToday ?? 0  // Would need historical renewals data
      ]
    : undefined;

  const layawayBars = layaways
    ? [
        layaways.newToday ?? 0,
        layaways.paymentsCount ?? 0,
        Math.round(layaways.paymentsToday.amount) || 0
      ]
    : [0, 0, 0];
  const layawayBarsPrevious = layaways7Day.length >= 2
    ? [
        getYesterdayValue(layaways7Day) ?? 0,
        getYesterdayValue(layaways7Day) ?? 0,
        getYesterdayValue(layaways7Day) ?? 0  // Approximate
      ]
    : undefined;

  const repairBars = repairs
    ? [repairs.inProgress ?? 0, repairs.readyForPickup ?? 0, repairs.diagnosticsToday ?? 0]
    : [0, 0, 0];
  // Repairs don't have 7-day trend data yet, so no previous values

  const TrendIcon = sales?.salesTrend.direction === "down" ? TrendingDown : TrendingUp;

  const dailyLabels = buildDayLabels(30);
  const monthlyLabels = buildMonthLabels(12);

  // Use real database data if available, otherwise fall back to generated series
  const chartSeries = [
    {
      name: "Sales",
      color: "bg-emerald-500",
      stroke: "#10b981",
      daily: timeSeries?.daily.sales ?? generateSeries(sales?.salesQtyToday ?? 28, 30, 0.12),
      monthly: timeSeries?.monthly.sales ?? generateSeries((sales?.salesQtyToday ?? 28) * 6, 12, 0.1)
    },
    {
      name: "Pawns",
      color: "bg-amber-500",
      stroke: "#f59e0b",
      daily: timeSeries?.daily.pawns ?? generateSeries(loans?.loansToday ?? 14, 30, 0.1),
      monthly: timeSeries?.monthly.pawns ?? generateSeries((loans?.loansToday ?? 14) * 5, 12, 0.08)
    },
    {
      name: "Layaways",
      color: "bg-sky-500",
      stroke: "#0ea5e9",
      daily: timeSeries?.daily.layaways ?? generateSeries(layaways?.paymentsCount ?? 18, 30, 0.1),
      monthly: timeSeries?.monthly.layaways ?? generateSeries((layaways?.paymentsCount ?? 18) * 4, 12, 0.08)
    }
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-3 pb-10 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 shadow-2xl sm:p-8">
        <div className="absolute right-10 top-4 hidden h-32 w-32 rounded-full bg-emerald-400/30 blur-3xl lg:block" aria-hidden />
        <div className="absolute bottom-0 right-0 h-44 w-44 rounded-full bg-sky-500/30 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-6 text-white">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Command Center</p>
              <h1 className="text-3xl font-semibold sm:text-4xl">Branch performance, live</h1>
              <p className="max-w-3xl text-sm text-white/70 sm:text-base">
                Get a responsive view of sales, pawns, layaways, and repair operations. Trends update as data
                flows in so you can unblock team members and keep promises to customers.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white shadow-inner ring-1 ring-white/15">
              <Sparkles className="h-4 w-4 text-amber-200" aria-hidden />
              <span>Real-time signals with actionable trends</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InsightStat
              label="Sales today"
              value={sales ? formatCurrency(sales.salesTotalToday) : "—"}
              helper={sales?.salesTrend.label ?? salesState.error}
              icon={ShoppingBag}
              emphasis
            />
            <InsightStat
              label="Pawned today"
              value={loans ? loans.loansToday.toString() : "—"}
              helper={loans ? `${formatCurrency(loans.principalOut)} principal out · ${loans.renewalsToday} renewals` : loansState.error}
              icon={HandCoins}
            />
            <InsightStat
              label="Layaway energy"
              value={layaways ? `${layaways.paymentsCount} payments` : "—"}
              helper={layaways ? formatCurrency(layaways.paymentsToday) : layawayState.error}
              icon={ActivitySquare}
            />
            <InsightStat
              label="Repairs in motion"
              value={repairs ? `${repairs.inProgress} active` : "—"}
              helper={repairs ? `${repairs.readyForPickup} ready · ${repairs.diagnosticsToday} diagnostics` : repairsState.error}
              icon={Wrench}
            />
          </div>
        </div>
      </section>

      <InsightCard
        title="Sales, pawns, and layaways"
        description="Flip between daily and monthly timelines to see where momentum is building."
        adornment={<LineChart className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden />}
        className="bg-white/90"
      >
        <MultiSeriesLineChart
          title="Pipeline velocity"
          subtitle="Time-series"
          labels={{ daily: dailyLabels, monthly: monthlyLabels }}
          series={chartSeries}
        />
      </InsightCard>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <InsightCard
          title="Sales momentum"
          description={sales?.salesTrend.label ?? salesState.error}
          adornment={<BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />}
          className="xl:col-span-2"
        >
          <div className="grid gap-4 md:grid-cols-3 md:items-center">
            <div className="md:col-span-2 space-y-3">
              {/* 7-day trend sparkline */}
              {sales7Day.length > 0 && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-white/60 p-2 ring-1 ring-slate-200/50 dark:bg-slate-800/40 dark:ring-slate-700/50">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">7-day trend</span>
                  <MiniSparkline values={sales7Day} color="#10b981" width={100} height={32} />
                </div>
              )}
              <SparkBar 
                values={salesBars} 
                labels={["Qty", "Sales", "Purchases"]}
                previousValues={salesBarsPrevious}
                formatValue={(value, index) => {
                  if (index === 0) return value.toString(); // Qty
                  if (index === 1 || index === 2) return formatCurrencyCompact({ amount: value, currency: "DOP" }); // Sales/Purchases
                  return value.toString();
                }}
              />
            </div>
            <div className="space-y-3 rounded-2xl bg-white/80 p-4 text-sm text-slate-700 shadow-inner ring-1 ring-slate-200/70 dark:bg-slate-900/70 dark:text-slate-200 dark:ring-slate-800/70">
              <p className="text-base font-semibold text-slate-900 dark:text-white">Pace vs yesterday</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {sales
                  ? `Tracking ${sales.salesQtyToday} tickets with ${formatCurrency(sales.salesTotalToday)} in volume.`
                  : "Sales data is unavailable right now."}
              </p>
              {sales ? (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-800/60">
                  <TrendIcon className="h-4 w-4" aria-hidden />
                  <span>{sales.salesTrend.label}</span>
                </div>
              ) : null}
            </div>
          </div>
        </InsightCard>

        <InsightCard
          title="Pawn pipeline"
          description={loans ? `${loans.pawnsPastDue} past due · ${loans.renewalsToday} renewals today` : loansState.error}
          adornment={<HandCoins className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />}
        >
          <div className="grid gap-4 md:grid-cols-2 md:items-center">
            <div className="space-y-3">
              {/* 7-day trend sparkline */}
              {pawns7Day.length > 0 && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-white/60 p-2 ring-1 ring-slate-200/50 dark:bg-slate-800/40 dark:ring-slate-700/50">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">7-day trend</span>
                  <MiniSparkline values={pawns7Day} color="#f59e0b" width={100} height={32} />
                </div>
              )}
              <SparkBar 
                values={pawnBars} 
                labels={["New", "Past Due", "Renewals"]}
                previousValues={pawnBarsPrevious}
              />
            </div>
            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <p className="text-base font-semibold text-slate-900 dark:text-white">Customer commitments</p>
              <p>
                {loans
                  ? `${loans.loansToday} new loans funded. Watching ${loans.pawnsPastDue} pledges nearing delinquency.`
                  : "Loan metrics are currently unavailable."}
              </p>
              {loans ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Principal out: {formatCurrency(loans.principalOut)}</p>
              ) : null}
            </div>
          </div>
        </InsightCard>

        <InsightCard
          title="Layaway engagement"
          description={layaways ? `${layaways.newToday} new plans · ${layaways.paymentsCount} payments` : layawayState.error}
          adornment={<ActivitySquare className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden />}
        >
          <div className="grid gap-4 md:grid-cols-2 md:items-center">
            <div className="space-y-3">
              {/* 7-day trend sparkline */}
              {layaways7Day.length > 0 && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-white/60 p-2 ring-1 ring-slate-200/50 dark:bg-slate-800/40 dark:ring-slate-700/50">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">7-day trend</span>
                  <MiniSparkline values={layaways7Day} color="#0ea5e9" width={100} height={32} />
                </div>
              )}
              <SparkBar 
                values={layawayBars} 
                labels={["New", "Payments", "Value"]}
                previousValues={layawayBarsPrevious}
                formatValue={(value, index) => {
                  if (index === 2) return formatCurrencyCompact({ amount: value, currency: "DOP" }); // Value
                  return value.toString();
                }}
              />
            </div>
            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <p className="text-base font-semibold text-slate-900 dark:text-white">Momentum on holds</p>
              <p>
                {layaways
                  ? `${formatCurrency(layaways.paymentsToday)} collected today across ${layaways.paymentsCount} payments.`
                  : "Layaway information is still loading."}
              </p>
              {layaways ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">{layaways.newToday} brand new layaways started.</p>
              ) : null}
            </div>
          </div>
        </InsightCard>

        <InsightCard
          title="Repair & fabrication flow"
          description={repairs ? `${repairs.inProgress} active · ${repairs.readyForPickup} ready` : repairsState.error}
          adornment={<Wrench className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden />}
        >
          <div className="grid gap-4 md:grid-cols-2 md:items-center">
            <SparkBar 
              values={repairBars} 
              labels={["In Progress", "Ready", "Diagnostics"]}
              showTrends={false}
            />
            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <p className="text-base font-semibold text-slate-900 dark:text-white">Bench utilization</p>
              <p>
                {repairs
                  ? `Average turnaround ${repairs.avgTurnaround.toFixed(1)} days. ${repairs.diagnosticsToday} fresh diagnostics queued.`
                  : "Repair details are still syncing."}
              </p>
              {repairs ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">{repairs.readyForPickup} customers can be notified now.</p>
              ) : null}
            </div>
          </div>
        </InsightCard>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Operational cards</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Deep dives and status checks</h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Responsive layout adapts across devices so branch managers can browse metrics on the go.
          </p>
        </div>
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <Suspense fallback={<DashboardSectionSkeleton />}>
            <SalesPurchasesCard />
          </Suspense>
          <Suspense fallback={<DashboardSectionSkeleton />}>
            <LoansOverviewCard />
          </Suspense>
          <Suspense fallback={<DashboardSectionSkeleton />}>
            <LayawaysCard />
          </Suspense>
          <Suspense fallback={<DashboardSectionSkeleton />}>
            <InventoryHealthCard />
          </Suspense>
          <Suspense fallback={<DashboardSectionSkeleton />}>
            <RepairsFabricationsCard />
          </Suspense>
          <Suspense fallback={<DashboardSectionSkeleton />}>
            <MarketingEngagementCard />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
