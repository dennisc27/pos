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
          { label: "Campaigns Sent", value: data.campaignsSent.toString(), emphasis: true },
          { label: "Messages Pending", value: data.messagesPending.toString(), trend: { label: "Queue", direction: "flat" } },
          { label: "New Reviews", value: data.newReviews.toString() },
          { label: "Responses Needed", value: data.responsesRequired.toString(), trend: { label: "Handle today", direction: "up" } }
        ]}
      />
    </DashboardCard>
  );
}
