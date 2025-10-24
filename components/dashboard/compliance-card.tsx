import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { MetricList } from "@/components/dashboard/metric";
import { fetchComplianceStatus } from "@/lib/actions";

export async function ComplianceCard() {
  const data = await fetchComplianceStatus();
  return (
    <DashboardCard
      title="Compliance"
      subtitle={`Police reports pending ${data.policeReportsPending} · OFAC matches ${data.ofacMatches}`}
    >
      <MetricList
        metrics={[
          { label: "Police Reports", value: data.policeReportsPending.toString(), emphasis: true },
          { label: "OFAC Matches", value: data.ofacMatches.toString(), trend: { label: "Review now", direction: "up" } },
          { label: "IRS 8300 Alerts", value: data.irsAlerts.toString(), trend: { label: "Clear", direction: "flat" } },
          { label: "Audits This Week", value: data.auditsThisWeek.toString() }
        ]}
      />
    </DashboardCard>
  );
}
