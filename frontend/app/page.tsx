import { Suspense } from "react";
import { LoansOverviewCard } from "@/components/dashboard/loans-overview-card";
import { LayawaysCard } from "@/components/dashboard/layaways-card";
import { SalesPurchasesCard } from "@/components/dashboard/sales-purchases-card";
import { InventoryHealthCard } from "@/components/dashboard/inventory-health-card";
import { RepairsFabricationsCard } from "@/components/dashboard/repairs-fabrications-card";
import { MarketingEngagementCard } from "@/components/dashboard/marketing-engagement-card";
import { DashboardSectionSkeleton } from "@/components/dashboard/skeleton";

const sections = [
  { id: "loans", component: LoansOverviewCard },
  { id: "layaways", component: LayawaysCard },
  { id: "sales", component: SalesPurchasesCard },
  { id: "inventory", component: InventoryHealthCard },
  { id: "repairs", component: RepairsFabricationsCard },
  { id: "marketing", component: MarketingEngagementCard }
] as const;

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-foreground">Command Center</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Monitor loans, sales, inventory, compliance, and team performance for every branch in
          real time. Metrics below represent today&apos;s activity unless noted otherwise.
        </p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map(({ id, component: Component }) => (
          <Suspense key={id} fallback={<DashboardSectionSkeleton />}>
            <Component />
          </Suspense>
        ))}
      </div>
    </div>
  );
}
