import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { MetricList } from "@/components/dashboard/metric";
import { fetchMarketingEngagement } from "@/lib/actions";

export async function MarketingEngagementCard() {
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
}
