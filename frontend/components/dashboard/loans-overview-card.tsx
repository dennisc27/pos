import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardErrorState } from "@/components/dashboard/error-state";
import { MetricList } from "@/components/dashboard/metric";
import { fetchLoansOverview } from "@/lib/actions";
import { formatCurrency } from "@/lib/utils";

export async function LoansOverviewCard() {
  try {
    const data = await fetchLoansOverview();
    return (
      <DashboardCard
        title="Loans & Pawns"
        subtitle={`Principal out: ${formatCurrency(data.principalOut)}`}
      >
        <MetricList
          metrics={[
            { label: "Loans Today", value: data.loansToday.toString(), emphasis: true },
            { label: "Pawns Past Due", value: data.pawnsPastDue.toString() },
            {
              label: "Renewals Today",
              value: data.renewalsToday.toString()
            }
          ]}
        />
      </DashboardCard>
    );
  } catch (error) {
    return (
      <DashboardCard title="Loans & Pawns">
        <DashboardErrorState message={error instanceof Error ? error.message : undefined} />
      </DashboardCard>
    );
  }
}
