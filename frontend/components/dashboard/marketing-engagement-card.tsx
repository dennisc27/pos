import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DashboardErrorState } from "@/components/dashboard/error-state";
import { MetricList } from "@/components/dashboard/metric";
import { fetchMarketingEngagement } from "@/lib/actions";

export async function MarketingEngagementCard() {
  try {
    const data = await fetchMarketingEngagement();
    return (
      <DashboardCard
        title="Marketing & Engagement"
        subtitle={`Avg rating ${data.averageRating.toFixed(1)} ⭐ · Responses required ${data.responsesRequired}`}
      >
        <MetricList
          metrics={[
            { label: "Messages Pending", value: data.messagesPending.toString(), emphasis: true },
            { label: "New Reviews", value: data.newReviews.toString() }
          ]}
        />
      </DashboardCard>
    );
  } catch (error) {
    return (
      <DashboardCard title="Marketing & Engagement">
        <DashboardErrorState message={error instanceof Error ? error.message : undefined} />
      </DashboardCard>
    );
  }
}
