import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { MetricList } from "@/components/dashboard/metric";
import { fetchSalesAndPurchases } from "@/lib/actions";
import { formatCurrency } from "@/lib/utils";

export async function SalesPurchasesCard() {
  const data = await fetchSalesAndPurchases();
  return (
    <DashboardCard
      title="Sales & Purchases"
      subtitle={`Net sales ${formatCurrency(data.netSales)} · ${data.trend.label}`}
    >
      <MetricList
        metrics={[
          { label: "Transactions", value: data.transactions.toString(), emphasis: true },
          { label: "Avg Ticket", value: formatCurrency(data.avgTicket) },
          { label: "Top Category", value: data.topCategory },
          { label: "Buys From Customers", value: formatCurrency(data.buysFromCustomers) },
          { label: "Refunds", value: data.refunds.toString(), trend: { label: "No change", direction: "flat" } }
        ]}
      />
    </DashboardCard>
  );
}
