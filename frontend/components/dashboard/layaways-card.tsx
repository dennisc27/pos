import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardErrorState } from "@/components/dashboard/error-state";
import { MetricList } from "@/components/dashboard/metric";
import { fetchLayawayMetrics } from "@/lib/actions";
import { formatCurrency } from "@/lib/utils";

export async function LayawaysCard() {
  try {
    const data = await fetchLayawayMetrics();
    return (
      <DashboardCard
        title="Layaways"
        subtitle={`Payments posted: ${data.paymentsCount} · Total ${formatCurrency(data.paymentsToday)}`}
      >
        <MetricList
          metrics={[
            { label: "New Today", value: data.newToday.toString(), emphasis: true },
            { label: "Payments Today", value: formatCurrency(data.paymentsToday) }
          ]}
        />
      </DashboardCard>
    );
  } catch (error) {
    return (
      <DashboardCard title="Layaways">
        <DashboardErrorState message={error instanceof Error ? error.message : undefined} />
      </DashboardCard>
    );
  }
}
