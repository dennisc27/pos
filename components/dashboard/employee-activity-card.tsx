import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { MetricList } from "@/components/dashboard/metric";
import { fetchEmployeeActivity } from "@/lib/actions";

export async function EmployeeActivityCard() {
  const data = await fetchEmployeeActivity();
  return (
    <DashboardCard
      title="Employee Activity"
      subtitle={`${data.teamLoggedIn} team members logged in · ${data.commissionsProgress}`}
    >
      <MetricList
        metrics={[
          { label: "Logged In", value: data.teamLoggedIn.toString(), emphasis: true },
          { label: "Commissions", value: data.commissionsProgress },
          { label: "Late Clock-ins", value: data.lateClockIns.toString(), trend: { label: "+1 today", direction: "up" } },
          { label: "Open Tasks", value: data.openTasks.toString() },
          { label: "Training Due", value: data.trainingDue.toString(), trend: { label: "Due", direction: "up" } }
        ]}
      />
    </DashboardCard>
  );
}
