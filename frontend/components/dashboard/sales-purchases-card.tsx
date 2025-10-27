import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardErrorState } from "@/components/dashboard/error-state";
import { MetricList } from "@/components/dashboard/metric";
import { fetchSalesAndPurchases } from "@/lib/actions";
import { formatCurrency } from "@/lib/utils";

export async function SalesPurchasesCard() {
  try {
    const data = await fetchSalesAndPurchases();
    return (
      <DashboardCard
        title="Sales & Purchases"
        subtitle={`Sales total ${formatCurrency(data.salesTotalToday)} · ${data.salesTrend.label}`}
      >
        <MetricList
          metrics={[
            { label: "Sales Qty Today", value: data.salesQtyToday.toString(), emphasis: true },
            {
              label: "Sales Total Today",
              value: formatCurrency(data.salesTotalToday),
              trend: { label: data.salesTrend.label, direction: data.salesTrend.direction }
            },
            { label: "Purchases Today", value: formatCurrency(data.purchasesToday) }
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
