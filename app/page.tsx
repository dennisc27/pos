import { Suspense } from "react";
import { LoansOverviewCard } from "@/components/dashboard/loans-overview-card";
import { LayawaysCard } from "@/components/dashboard/layaways-card";
import { SalesPurchasesCard } from "@/components/dashboard/sales-purchases-card";
import { CashDrawerCard } from "@/components/dashboard/cash-drawer-card";
import { InventoryHealthCard } from "@/components/dashboard/inventory-health-card";
import { RepairsFabricationsCard } from "@/components/dashboard/repairs-fabrications-card";
import { MarketingEngagementCard } from "@/components/dashboard/marketing-engagement-card";
import { ComplianceCard } from "@/components/dashboard/compliance-card";
import { EmployeeActivityCard } from "@/components/dashboard/employee-activity-card";
import { DashboardSectionSkeleton } from "@/components/dashboard/skeleton";

const sections = [
  { id: "loans", component: LoansOverviewCard },
  { id: "layaways", component: LayawaysCard },
  { id: "sales", component: SalesPurchasesCard },
  { id: "cash", component: CashDrawerCard },
  { id: "inventory", component: InventoryHealthCard },
  { id: "repairs", component: RepairsFabricationsCard },
  { id: "marketing", component: MarketingEngagementCard },
  { id: "compliance", component: ComplianceCard },
  { id: "employees", component: EmployeeActivityCard }
] as const;

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-white">Command Center</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Monitor loans, sales, inventory, compliance, and team performance for every branch in
          real time. Metrics below represent today&apos;s activity unless noted otherwise.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {sections.map(({ id, component: Component }) => (
          <Suspense key={id} fallback={<DashboardSectionSkeleton />}>
            <Component />
          </Suspense>
        ))}
      </div>
    </div>
  );
}
