import { MetricCard } from "./components/MetricCard";
import { ModulePanel } from "./components/ModulePanel";
import { RealtimePulse } from "./components/RealtimePulse";

const metricData = [
  {
    title: "Net Sales (Today)",
    value: "DOP 187,520",
    trendLabel: "+18% vs yesterday",
    trendDirection: "up" as const,
    icon: "₿",
    accentColor: "from-brand to-cyan-500/60",
    footer: "Avg ticket DOP 5,860 • 32 total sales"
  },
  {
    title: "Pawn Book",
    value: "312 Active Loans",
    trendLabel: "DOP 2.8M outstanding",
    trendDirection: "flat" as const,
    icon: "💎",
    accentColor: "from-purple-500/60 to-brand/40",
    footer: "27 due today • 6 past due"
  },
  {
    title: "Cash Drawer",
    value: "DOP 58,430",
    trendLabel: "DOP 250 over expected",
    trendDirection: "down" as const,
    icon: "💵",
    accentColor: "from-emerald-500/50 to-brand-dark/40",
    footer: "Last drop at 4:45 PM"
  },
  {
    title: "Customer Sentiment",
    value: "4.8 ★",
    trendLabel: "6 new reviews today",
    trendDirection: "up" as const,
    icon: "😊",
    accentColor: "from-pink-500/50 to-brand/40",
    footer: "2 conversations awaiting reply"
  }
];

const modulePanels = [
  {
    title: "Loans & Pawns",
    description: "Monitor originations, renewals, and redemptions.",
    icon: "📑",
    items: [
      { label: "New today", value: "14", pillColor: "bg-brand/30" },
      { label: "Due today", value: "27", pillColor: "bg-warning/30" },
      { label: "Past due", value: "6", pillColor: "bg-danger/30" },
      { label: "Redemptions", value: "9", pillColor: "bg-success/25" }
    ]
  },
  {
    title: "Layaways",
    description: "Payment plans and follow-ups.",
    icon: "🗓️",
    items: [
      { label: "Active plans", value: "48", pillColor: "bg-brand/25" },
      { label: "Overdue", value: "3", pillColor: "bg-danger/30" },
      { label: "Payments today", value: "DOP 34K", pillColor: "bg-success/25" },
      { label: "Expiring soon", value: "5", pillColor: "bg-warning/30" }
    ]
  },
  {
    title: "Inventory Health",
    description: "Critical stock, online listings, and quarantined items.",
    icon: "📦",
    items: [
      { label: "Items in stock", value: "2,458", pillColor: "bg-brand/30" },
      { label: "Low stock alerts", value: "12", pillColor: "bg-warning/30" },
      { label: "Listed online", value: "340", pillColor: "bg-purple-500/30" },
      { label: "Quarantine", value: "7", pillColor: "bg-danger/30" }
    ]
  },
  {
    title: "Repairs & Fabrications",
    description: "Track workshop throughput.",
    icon: "🛠️",
    items: [
      { label: "In progress", value: "18", pillColor: "bg-brand/30" },
      { label: "Awaiting approval", value: "5", pillColor: "bg-warning/30" },
      { label: "Ready for pickup", value: "6", pillColor: "bg-success/25" },
      { label: "Quality control", value: "3", pillColor: "bg-purple-500/30" }
    ]
  },
  {
    title: "Compliance",
    description: "Stay audit ready at all times.",
    icon: "🛡️",
    items: [
      { label: "Police reports pending", value: "2", pillColor: "bg-warning/30" },
      { label: "OFAC matches", value: "0", pillColor: "bg-success/25" },
      { label: "IRS 8300 alerts", value: "1", pillColor: "bg-danger/30" },
      { label: "Audit flags", value: "3", pillColor: "bg-purple-500/30" }
    ]
  },
  {
    title: "Employee Activity",
    description: "Shift and performance visibility.",
    icon: "👥",
    items: [
      { label: "On shift", value: "12", pillColor: "bg-brand/25" },
      { label: "Break / Lunch", value: "3", pillColor: "bg-warning/30" },
      { label: "Commission progress", value: "68%", pillColor: "bg-success/25" },
      { label: "Open tasks", value: "15", pillColor: "bg-danger/30" }
    ]
  }
];

const realtimeEvents = [
  {
    id: "1",
    time: "4:52 PM",
    actor: "Maria R.",
    action: "completed a layaway payment",
    context: "for ticket #LA-2041",
    accent: "success" as const
  },
  {
    id: "2",
    time: "4:37 PM",
    actor: "Luis P.",
    action: "opened a new pawn loan",
    context: "on 18k gold chain DOP 45,000",
    accent: "default" as const
  },
  {
    id: "3",
    time: "4:25 PM",
    actor: "QC Station",
    action: "flagged a diamond ring",
    context: "for secondary appraisal",
    accent: "warning" as const
  },
  {
    id: "4",
    time: "4:10 PM",
    actor: "Compliance Bot",
    action: "submitted OFAC report",
    context: "for transaction #POS-1094",
    accent: "success" as const
  }
];

export default function DashboardPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-light/70">
          AuroraPOS Command Center
        </p>
        <h1 className="text-4xl font-bold text-white sm:text-5xl">
          Friday, 8 March · Santo Domingo Branch
        </h1>
        <p className="max-w-2xl text-base text-slate-400">
          Real-time visibility across pawn, retail, and service operations. Synchronised via Supabase
          with multi-branch awareness and bilingual-ready UI.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-4">
        {metricData.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="grid gap-6 md:grid-cols-2">
            {modulePanels.slice(0, 4).map((panel) => (
              <ModulePanel key={panel.title} {...panel} />
            ))}
          </div>
        </div>
        <RealtimePulse events={realtimeEvents} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {modulePanels.slice(4).map((panel) => (
          <ModulePanel key={panel.title} {...panel} />
        ))}
      </section>
    </main>
  );
}
