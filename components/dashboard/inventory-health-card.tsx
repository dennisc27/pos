import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { MetricList } from "@/components/dashboard/metric";
import { fetchInventoryHealth, formatCurrency } from "@/lib/actions";

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
          { label: "Aging (90+ days)", value: data.aging.toString(), trend: { label: "+3 vs last week", direction: "up" } },
          { label: "Listed Online", value: data.listedOnline.toString() },
          { label: "Quarantined", value: data.quarantined.toString(), trend: { label: "QC Review", direction: "flat" } }
        ]}
      />
    </DashboardCard>
  );
}
