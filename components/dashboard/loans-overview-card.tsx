import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { MetricList } from "@/components/dashboard/metric";
import { fetchLoansOverview, formatCurrency } from "@/lib/actions";

export async function LoansOverviewCard() {
  const data = await fetchLoansOverview();
  return (
    <DashboardCard
      title="Loans & Pawns"
      subtitle={`Principal out: ${formatCurrency(data.principalOut)} · ${data.trend.label}`}
    >
      <MetricList
        metrics={[
          { label: "New Loans", value: data.newLoans.toString(), emphasis: true },
          { label: "Active", value: data.activeLoans.toString() },
          {
            label: "Due Today",
            value: data.dueToday.toString(),
            trend: { label: data.trend.label, direction: data.trend.direction }
          },
          { label: "Past Due", value: data.pastDue.toString(), trend: { label: "+4 vs yesterday", direction: "up" } },
          { label: "Redemptions", value: data.redemptions.toString() },
          { label: "Renewals", value: data.renewals.toString() }
        ]}
      />
    </DashboardCard>
  );
}
