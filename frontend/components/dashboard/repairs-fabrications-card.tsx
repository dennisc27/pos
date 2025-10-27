import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { MetricList } from "@/components/dashboard/metric";
import { fetchRepairsAndFabrications } from "@/lib/actions";

export async function RepairsFabricationsCard() {
  const data = await fetchRepairsAndFabrications();
  return (
    <DashboardCard
      title="Repairs & Fabrications"
      subtitle={`Avg turnaround ${data.avgTurnaround.toFixed(1)} days · Diagnostics today ${data.diagnosticsToday}`}
    >
      <MetricList
        metrics={[
          { label: "In Progress", value: data.inProgress.toString(), emphasis: true },
          { label: "Ready for Pickup", value: data.readyForPickup.toString() }
        ]}
      />
    </DashboardCard>
  );
}
