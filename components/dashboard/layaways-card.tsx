import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { MetricList } from "@/components/dashboard/metric";
import { fetchLayawayMetrics } from "@/lib/actions";
import { formatCurrency } from "@/lib/utils";

export async function LayawaysCard() {
  const data = await fetchLayawayMetrics();
  return (
    <DashboardCard
      title="Layaways"
      subtitle={`Deposits today: ${formatCurrency(data.depositsToday)} · Reminders sent ${data.remindersSent}`}
    >
      <MetricList
        metrics={[
          { label: "Active", value: data.active.toString(), emphasis: true },
          { label: "Paid", value: data.paid.toString() },
          { label: "Overdue", value: data.overdue.toString(), trend: { label: "-2 vs yesterday", direction: "down" } },
          { label: "Reminders", value: data.remindersSent.toString() }
        ]}
      />
    </DashboardCard>
  );
}
