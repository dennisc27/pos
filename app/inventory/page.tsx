import { ItemsGrid } from "@/components/inventory/items-grid";
import { ReceiveWizard } from "@/components/inventory/receive-wizard";
import { TransferPipeline } from "@/components/inventory/transfer-pipeline";
import { QuarantineQueue } from "@/components/inventory/quarantine-queue";
import { CountsProgress } from "@/components/inventory/counts-progress";
import { ValueSnapshot } from "@/components/inventory/value-snapshot";
import type {
  CountSession,
  InventoryItem,
  InventoryTransfer,
  QuarantineItem,
  ReceivingShipment,
  ValueMetric
} from "@/components/inventory/types";
import { formatCurrency, formatQuantity } from "@/components/inventory/utils";

const inventoryItems: InventoryItem[] = [
  {
    id: "inv-1",
    sku: "JW-2041",
    description: "18K Gold Curb Chain 24\"",
    category: "Jewelry · Gold",
    location: { name: "Showroom Case A", kind: "store" },
    qty: 1,
    uom: "pcs",
    wac: 48500,
    retail: 72800,
    agedDays: 34,
    channel: "Storefront",
    status: "available"
  },
  {
    id: "inv-2",
    sku: "WT-5528",
    description: "Rolex Datejust 16233 Two-Tone",
    category: "Watches · Luxury",
    location: { name: "Safe Vault", kind: "safe" },
    qty: 1,
    uom: "pcs",
    wac: 178000,
    retail: 245000,
    agedDays: 12,
    channel: "Website",
    status: "available"
  },
  {
    id: "inv-3",
    sku: "MT-8840",
    description: "24K Scrap Gold Lot",
    category: "Metal · Scrap",
    location: { name: "Bench Refining", kind: "bench" },
    qty: 312.5,
    uom: "grams",
    wac: 3100,
    retail: 4520,
    agedDays: 5,
    channel: "Wholesale",
    status: "hold"
  },
  {
    id: "inv-4",
    sku: "ST-1109",
    description: "1.05ct Round Brilliant Loose",
    category: "Stones · Diamonds",
    location: { name: "Gem Safe", kind: "safe" },
    qty: 1,
    uom: "pcs",
    wac: 158000,
    retail: 198000,
    agedDays: 61,
    channel: "Storefront",
    status: "available"
  },
  {
    id: "inv-5",
    sku: "EL-3312",
    description: "DJI Mini 4 Pro Drone",
    category: "Electronics",
    location: { name: "Online staging rack", kind: "transfer" },
    qty: 4,
    uom: "pcs",
    wac: 32500,
    retail: 46900,
    agedDays: 24,
    channel: "Amazon",
    status: "pending_transfer"
  },
  {
    id: "inv-6",
    sku: "JW-3020",
    description: "14K Diamond Halo Ring",
    category: "Jewelry · Engagement",
    location: { name: "Repair Queue", kind: "wip" },
    qty: 1,
    uom: "pcs",
    wac: 38500,
    retail: 62900,
    agedDays: 97,
    channel: "Storefront",
    status: "hold"
  }
];

const receivingShipments: ReceivingShipment[] = [
  {
    id: "rcv-1",
    vendor: "Santo Domingo Estates Buy",
    eta: "Today 3:00pm",
    items: 28,
    photosRequired: 18,
    value: 182000,
    status: "counting"
  },
  {
    id: "rcv-2",
    vendor: "Consignment - Elegant Gems",
    eta: "Tomorrow 11:00am",
    items: 14,
    photosRequired: 14,
    value: 265000,
    status: "unpacked"
  },
  {
    id: "rcv-3",
    vendor: "Vendor Purchase Order #PO-1187",
    eta: "Awaiting arrival",
    items: 9,
    photosRequired: 6,
    value: 98000,
    status: "tagging"
  }
];

const transfers: InventoryTransfer[] = [
  {
    id: "tr-1",
    reference: "TR-2024-045",
    from: "Branch - Piantini",
    to: "Branch - Santiago",
    items: 17,
    value: 225000,
    status: "in_transit",
    carrier: "Metro Logistics",
    lastScan: "10:15 · Dispatch hub"
  },
  {
    id: "tr-2",
    reference: "CSGN-031",
    from: "Vendor - Lito's Workshop",
    to: "Branch - Piantini",
    items: 6,
    value: 128000,
    status: "staged",
    carrier: "Awaiting pickup",
    lastScan: "08:40 · Dock"
  },
  {
    id: "tr-3",
    reference: "TR-2024-038",
    from: "Branch - Piantini",
    to: "Branch - Zona Colonial",
    items: 11,
    value: 102500,
    status: "received",
    carrier: "Courier signed",
    lastScan: "Yesterday 17:25 · Received"
  }
];

const quarantineItems: QuarantineItem[] = [
  {
    id: "q-1",
    sku: "WT-4413",
    description: "Citizen Eco-Drive Watch",
    reason: "Authenticity review",
    assignedTo: "David (Horologist)",
    since: "2 days",
    nextAction: "Upload movement photos"
  },
  {
    id: "q-2",
    sku: "JW-2190",
    description: "10K Cuban Link Bracelet",
    reason: "Police hold",
    assignedTo: "Compliance",
    since: "5 days",
    nextAction: "Submit report"
  },
  {
    id: "q-3",
    sku: "EL-3302",
    description: "MacBook Pro 14\"",
    reason: "Repair assessment",
    assignedTo: "Carlos (Bench)",
    since: "1 day",
    nextAction: "Estimate board"
  }
];

const countSessions: CountSession[] = [
  {
    id: "count-1",
    name: "Showroom Cases",
    scope: "Cases A-D · High value",
    type: "blind",
    scheduledFor: "Today 7:30pm",
    progress: 45,
    counted: 82,
    expected: 180,
    status: "in_progress"
  },
  {
    id: "count-2",
    name: "Electronics Wall",
    scope: "All serialized electronics",
    type: "cycle",
    scheduledFor: "Tomorrow 9:00am",
    progress: 0,
    counted: 0,
    expected: 64,
    status: "scheduled"
  },
  {
    id: "count-3",
    name: "Safe Vault",
    scope: "Luxury watches & stones",
    type: "full",
    scheduledFor: "In reconciliation",
    progress: 92,
    counted: 118,
    expected: 128,
    status: "reconciling"
  }
];

const valuationMetrics: ValueMetric[] = [
  {
    label: "Retail on hand",
    amount: inventoryItems.reduce((sum, item) => sum + item.retail * item.qty, 0),
    trend: { direction: "up", label: "+4.8% vs last month" }
  },
  {
    label: "Weighted avg cost",
    amount: inventoryItems.reduce((sum, item) => sum + item.wac * item.qty, 0),
    trend: { direction: "up", label: "+2.1% vs last month" }
  },
  {
    label: "Online listed",
    amount: 1180000,
    trend: { direction: "flat", label: "No change" }
  },
  {
    label: "Quarantine value",
    amount: 214500,
    trend: { direction: "down", label: "-1 case today" }
  }
];

const summaryTiles = [
  {
    label: "Retail value",
    value: formatCurrency(valuationMetrics[0].amount),
    accent: "text-emerald-300"
  },
  {
    label: "Weighted cost",
    value: formatCurrency(valuationMetrics[1].amount),
    accent: "text-slate-200"
  },
  {
    label: "Active SKUs",
    value: inventoryItems.length.toString(),
    accent: "text-sky-300"
  },
  {
    label: "Units on hand",
    value: formatQuantity(inventoryItems.reduce((sum, item) => sum + item.qty, 0)),
    accent: "text-slate-200"
  },
  {
    label: "Quarantine",
    value: `${quarantineItems.length} items`,
    accent: "text-rose-300"
  }
];

export default function InventoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryTiles.map((tile) => (
          <div
            key={tile.label}
            className="flex flex-col gap-1 rounded-2xl border border-slate-800/70 bg-slate-950/80 px-4 py-3 text-xs text-slate-400"
          >
            <span className="uppercase tracking-wide text-[10px] text-slate-500">{tile.label}</span>
            <span className={`text-sm font-semibold ${tile.accent}`}>{tile.value}</span>
          </div>
        ))}
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.75fr_1fr]">
        <div className="flex flex-col gap-6">
          <ItemsGrid items={inventoryItems} />
          <TransferPipeline transfers={transfers} />
          <QuarantineQueue items={quarantineItems} />
        </div>
        <div className="flex flex-col gap-6">
          <ValueSnapshot metrics={valuationMetrics} />
          <ReceiveWizard shipments={receivingShipments} />
          <CountsProgress sessions={countSessions} />
        </div>
      </div>
    </div>
  );
}
