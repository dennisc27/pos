import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { MetricList } from "@/components/dashboard/metric";
import { fetchLoansOverview } from "@/lib/actions";
import { formatCurrency } from "@/lib/utils";

export async function LoansOverviewCard() {
  const data = await fetchLoansOverview();
  return (
    <DashboardCard
      title="Loans & Pawns"
      subtitle={`Principal out: ${formatCurrency(data.principalOut)} · ${data.renewalsTrend.label}`}
    >
      <MetricList
        metrics={[
          { label: "Loans Today", value: data.loansToday.toString(), emphasis: true },
          { label: "Pawns Past Due", value: data.pawnsPastDue.toString() },
          {
            label: "Renewals Today",
            value: data.renewalsToday.toString(),
            trend: { label: data.renewalsTrend.label, direction: data.renewalsTrend.direction }
          }
        ]}
      />
    </DashboardCard>
  );
}
