import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { MetricList } from "@/components/dashboard/metric";
import { fetchInventoryHealth } from "@/lib/actions";
import { formatCurrency } from "@/lib/utils";

export async function InventoryHealthCard() {
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
}
