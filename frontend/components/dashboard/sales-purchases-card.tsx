import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardErrorState } from "@/components/dashboard/error-state";
import { MetricList } from "@/components/dashboard/metric";
import { fetchSalesAndPurchases } from "@/lib/actions";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

export async function SalesPurchasesCard() {
  try {
    const data = await fetchSalesAndPurchases();
    return (
      <DashboardCard
        title="Sales & Purchases"
        subtitle={`Sales total ${formatCurrency(data.salesTotalToday)}`}
      >
        <MetricList
          metrics={[
            { label: "Sales Qty Today", value: data.salesQtyToday.toString(), emphasis: true },
            {
              label: "Sales Today",
              value: formatCurrencyCompact(data.salesTotalToday)
            },
            { label: "Purchases Today", value: formatCurrencyCompact(data.purchasesToday) }
          ]}
        />
      </DashboardCard>
    );
  } catch (error) {
    return (
      <DashboardCard title="Sales & Purchases">
        <DashboardErrorState message={error instanceof Error ? error.message : undefined} />
      </DashboardCard>
    );
  }
}
