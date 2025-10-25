import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { MetricList } from "@/components/dashboard/metric";
import { fetchCashDrawer, formatCurrency } from "@/lib/actions";

export async function CashDrawerCard() {
  const data = await fetchCashDrawer();
  const variance = data.variance.amount;
  return (
    <DashboardCard
      title="Cash Drawer"
      subtitle={`Expected ${formatCurrency(data.expected)} · Actual ${formatCurrency(data.actual)}`}
    >
      <MetricList
        metrics={[
          {
            label: "Variance",
            value: formatCurrency(data.variance),
            trend: {
              label: variance === 0 ? "Balanced" : variance > 0 ? "Over" : "Short",
              direction: variance === 0 ? "flat" : variance > 0 ? "up" : "down"
            },
            emphasis: true
          },
          { label: "Paid-Ins", value: formatCurrency(data.paidIns) },
          { label: "Paid-Outs", value: formatCurrency(data.paidOuts) },
          { label: "Safe Drops", value: formatCurrency(data.dropsToSafe) }
        ]}
      />
    </DashboardCard>
  );
}
