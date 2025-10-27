import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardErrorState } from "@/components/dashboard/error-state";
import { MetricList } from "@/components/dashboard/metric";
import { fetchInventoryHealth } from "@/lib/actions";
import { formatCurrency } from "@/lib/utils";

export async function InventoryHealthCard() {
  try {
    const data = await fetchInventoryHealth();
    return (
      <DashboardCard
        title="Inventory Health"
        subtitle={`Total value ${formatCurrency(data.totalValue)} · Transfers pending ${data.transfersPending}`}
      >
        <MetricList
          metrics={[
            { label: "Low Stock", value: data.lowStock.toString(), emphasis: true },
            { label: "Aging (90+ days)", value: data.aging.toString() }
          ]}
        />
      </DashboardCard>
    );
  } catch (error) {
    return (
      <DashboardCard title="Inventory Health">
        <DashboardErrorState message={error instanceof Error ? error.message : undefined} />
      </DashboardCard>
    );
  }
}
