"use client";

import { useMemo, useState } from "react";

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
  ValueMetric,
} from "@/components/inventory/types";
import { formatCurrency, formatQuantity } from "@/components/inventory/utils";

const INITIAL_INVENTORY_ITEMS: InventoryItem[] = [
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
    status: "available",
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
    status: "available",
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
    status: "hold",
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
    status: "available",
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
    status: "pending_transfer",
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
    status: "hold",
  },
];

const INITIAL_SHIPMENTS: ReceivingShipment[] = [
  {
    id: "rcv-1",
    vendor: "Santo Domingo Estates Buy",
    eta: "Today 3:00pm",
    items: 28,
    photosRequired: 18,
    value: 182000,
    status: "counting",
  },
  {
    id: "rcv-2",
    vendor: "Consignment - Elegant Gems",
    eta: "Tomorrow 11:00am",
    items: 14,
    photosRequired: 14,
    value: 265000,
    status: "unpacked",
  },
  {
    id: "rcv-3",
    vendor: "Vendor Purchase Order #PO-1187",
    eta: "Awaiting arrival",
    items: 9,
    photosRequired: 6,
    value: 98000,
    status: "tagging",
  },
];

const INITIAL_TRANSFERS: InventoryTransfer[] = [
  {
    id: "tr-1",
    reference: "TR-2024-045",
    from: "Branch - Piantini",
    to: "Branch - Santiago",
    items: 17,
    value: 225000,
    status: "in_transit",
    carrier: "Metro Logistics",
    lastScan: "10:15 · Dispatch hub",
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
    lastScan: "08:40 · Dock",
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
    lastScan: "Yesterday 17:25 · Received",
  },
];

const INITIAL_QUARANTINE: QuarantineItem[] = [
  {
    id: "q-1",
    sku: "WT-4413",
    description: "Citizen Eco-Drive Watch",
    reason: "Authenticity review",
    assignedTo: "David (Horologist)",
    since: "2 days",
    nextAction: "Upload movement photos",
  },
  {
    id: "q-2",
    sku: "JW-2190",
    description: "10K Cuban Link Bracelet",
    reason: "Police hold",
    assignedTo: "Compliance",
    since: "5 days",
    nextAction: "Submit report",
  },
  {
    id: "q-3",
    sku: "EL-3302",
    description: "MacBook Pro 14\"",
    reason: "Repair assessment",
    assignedTo: "Carlos (Bench)",
    since: "1 day",
    nextAction: "Estimate board",
  },
];

const INITIAL_COUNTS: CountSession[] = [
  {
    id: "count-1",
    name: "Showroom Cases",
    scope: "Cases A-D · High value",
    type: "blind",
    scheduledFor: "Today 7:30pm",
    progress: 45,
    counted: 82,
    expected: 180,
    status: "in_progress",
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
    status: "scheduled",
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
    status: "reconciling",
  },
];

const statusLabels: Record<InventoryItem["status"], string> = {
  available: "Disponibles",
  hold: "Hold",
  pending_transfer: "Traslado",
  quarantine: "Cuarentena",
};

const channelFilters = ["all", "Storefront", "Website", "Amazon", "Wholesale"] as const;

const nextShipmentStatus: Record<ReceivingShipment["status"], ReceivingShipment["status"] | null> = {
  unpacked: "counting",
  counting: "tagging",
  tagging: "ready",
  ready: null,
};

const nextTransferStatus: Record<InventoryTransfer["status"], InventoryTransfer["status"] | null> = {
  staged: "in_transit",
  in_transit: "received",
  received: null,
};

const nextCountStatus: Record<CountSession["status"], CountSession["status"] | null> = {
  scheduled: "in_progress",
  in_progress: "reconciling",
  reconciling: "posted",
  posted: null,
};

export default function InventoryPage() {
  const [items, setItems] = useState(INITIAL_INVENTORY_ITEMS);
  const [shipments, setShipments] = useState(INITIAL_SHIPMENTS);
  const [transfers, setTransfers] = useState(INITIAL_TRANSFERS);
  const [quarantine, setQuarantine] = useState(INITIAL_QUARANTINE);
  const [countSessions, setCountSessions] = useState(INITIAL_COUNTS);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilters, setStatusFilters] = useState<InventoryItem["status"][]>([]);
  const [channelFilter, setChannelFilter] = useState<(typeof channelFilters)[number]>("all");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [activityLog, setActivityLog] = useState<string[]>([]);

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !query ||
        item.description.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);
      const matchesStatus =
        statusFilters.length === 0 || statusFilters.includes(item.status);
      const matchesChannel =
        channelFilter === "all" || item.channel === channelFilter;
      return matchesQuery && matchesStatus && matchesChannel;
    });
  }, [items, searchTerm, statusFilters, channelFilter]);

  const valuationMetrics: ValueMetric[] = useMemo(
    () => [
      {
        label: "Retail on hand",
        amount: items.reduce((sum, item) => sum + item.retail * item.qty, 0),
        trend: { direction: "up", label: "+4.8% vs last month" },
      },
      {
        label: "Weighted avg cost",
        amount: items.reduce((sum, item) => sum + item.wac * item.qty, 0),
        trend: { direction: "up", label: "+2.1% vs last month" },
      },
      {
        label: "Online listed",
        amount: items.filter((item) => item.channel !== "Storefront").reduce((sum, item) => sum + item.retail * item.qty, 0),
        trend: { direction: "flat", label: "No change" },
      },
      {
        label: "Quarantine value",
        amount: quarantine.length * 71500,
        trend: { direction: "down", label: "-1 case today" },
      },
    ],
    [items, quarantine],
  );

  const summaryTiles = useMemo(
    () => [
      {
        label: "Retail value",
        value: formatCurrency(valuationMetrics[0].amount),
        accent: "text-emerald-600 dark:text-emerald-300",
      },
      {
        label: "Weighted cost",
        value: formatCurrency(valuationMetrics[1].amount),
        accent: "text-slate-700 dark:text-slate-200",
      },
      {
        label: "Active SKUs",
        value: items.length.toString(),
        accent: "text-sky-600 dark:text-sky-300",
      },
      {
        label: "Units on hand",
        value: formatQuantity(items.reduce((sum, item) => sum + item.qty, 0)),
        accent: "text-slate-700 dark:text-slate-200",
      },
      {
        label: "Quarantine",
        value: `${quarantine.length} items`,
        accent: "text-rose-500 dark:text-rose-300",
      },
    ],
    [valuationMetrics, items, quarantine],
  );

  const logAction = (message: string) => {
    setActivityLog((current) => [message, ...current].slice(0, 6));
  };

  const toggleStatusFilter = (status: InventoryItem["status"]) => {
    setStatusFilters((current) =>
      current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status],
    );
  };

  const handleToggleSelect = (id: string) => {
    setSelectedItemIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const handleStatusChange = (id: string, status: InventoryItem["status"]) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    logAction(`Item ${id} marcado como ${statusLabels[status]}`);
  };

  const handleRequestTransfer = (id: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: "pending_transfer" } : item,
      ),
    );
    setSelectedItemIds((current) => [...new Set([...current, id])]);
    logAction(`SKU preparado para traslado (${id})`);
  };

  const handleBulkTransfer = () => {
    if (selectedItemIds.length === 0) return;
    setItems((current) =>
      current.map((item) =>
        selectedItemIds.includes(item.id)
          ? { ...item, status: "pending_transfer" }
          : item,
      ),
    );
    logAction(`Se programaron ${selectedItemIds.length} artículos para traslado`);
    setSelectedItemIds([]);
  };

  const handleAdvanceShipment = (
    id: string,
    next: ReceivingShipment["status"] | null,
  ) => {
    setShipments((current) =>
      current.map((shipment) =>
        shipment.id === id && next
          ? { ...shipment, status: next }
          : shipment,
      ),
    );
    if (!next) {
      logAction(`Recepción ${id} lista para poner en piso`);
    } else {
      logAction(`Recepción ${id} avanzó a etapa ${next}`);
    }
  };

  const handleTogglePhotos = (id: string) => {
    setShipments((current) =>
      current.map((shipment) =>
        shipment.id === id
          ? {
              ...shipment,
              photosRequired: Math.max(0, shipment.photosRequired - 3),
            }
          : shipment,
      ),
    );
    logAction(`Actualizado checklist fotográfico para recepción ${id}`);
  };

  const handleAdvanceTransfer = (
    id: string,
    next: InventoryTransfer["status"] | null,
  ) => {
    setTransfers((current) =>
      current.map((transfer) =>
        transfer.id === id && next
          ? {
              ...transfer,
              status: next,
              lastScan: `${new Date().toLocaleTimeString("es-DO", {
                hour: "2-digit",
                minute: "2-digit",
              })} · ${next === "received" ? "Recibido" : "Escaneado"}`,
            }
          : transfer,
      ),
    );
    if (next) {
      logAction(`Transferencia ${id} marcada como ${next}`);
    }
  };

  const handleManifestView = (id: string) => {
    logAction(`Se abrió el manifiesto de la transferencia ${id}`);
  };

  const handleResolveQuarantine = (id: string) => {
    setQuarantine((current) => current.filter((item) => item.id !== id));
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: "available" } : item,
      ),
    );
    logAction(`Caso de cuarentena ${id} liberado`);
  };

  const handleEscalateQuarantine = (id: string) => {
    setQuarantine((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, assignedTo: `${item.assignedTo} · Supervisor` }
          : item,
      ),
    );
    logAction(`Cuarentena ${id} escalada a supervisor`);
  };

  const handleAdvanceCount = (
    id: string,
    next: CountSession["status"] | null,
  ) => {
    setCountSessions((current) =>
      current.map((session) =>
        session.id === id
          ? {
              ...session,
              status: next ?? session.status,
              progress: next === "posted" ? 100 : session.progress,
            }
          : session,
      ),
    );
    if (next) {
      logAction(`Conteo ${id} pasó a estado ${next}`);
    }
  };

  const handleOpenReconciliation = (id: string) => {
    setCountSessions((current) =>
      current.map((session) =>
        session.id === id
          ? { ...session, status: "reconciling", progress: Math.max(session.progress, 75) }
          : session,
      ),
    );
    logAction(`Se abrió reconciliación para el conteo ${id}`);
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <div className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white px-3 py-1 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar SKU, categoría..."
          className="w-48 bg-transparent text-xs text-slate-600 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setSearchTerm("");
            }
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        {Object.entries(statusLabels).map(([value, label]) => (
          <button
            key={value}
            onClick={() => toggleStatusFilter(value as InventoryItem["status"])}
            className={`rounded-full border px-3 py-1 transition ${
              statusFilters.includes(value as InventoryItem["status"]) ?
                "border-sky-500 bg-sky-500/10 text-sky-700 dark:border-sky-500/70 dark:text-sky-300" :
                "border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 rounded-full border border-slate-200/70 bg-white px-1 py-1 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
        {channelFilters.map((channel) => (
          <button
            key={channel}
            onClick={() => setChannelFilter(channel)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              channelFilter === channel
                ? "bg-sky-500 text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300"
            }`}
          >
            {channel === "all" ? "Todos" : channel}
          </button>
        ))}
      </div>
      {selectedItemIds.length > 0 ? (
        <div className="flex items-center gap-2 rounded-full border border-sky-400/60 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-700 dark:border-sky-500/40 dark:text-sky-200">
          <span>{selectedItemIds.length} seleccionados</span>
          <button
            className="rounded-full border border-sky-500/40 px-2 py-0.5 text-sky-600 transition hover:border-sky-500/60 hover:text-sky-700 dark:text-sky-200"
            onClick={handleBulkTransfer}
          >
            Programar traslado
          </button>
          <button
            className="rounded-full border border-transparent px-2 py-0.5 text-slate-500 hover:text-slate-700 dark:text-slate-300"
            onClick={() => setSelectedItemIds([])}
          >
            Limpiar
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryTiles.map((tile) => (
          <div
            key={tile.label}
            className="flex flex-col gap-1 rounded-2xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 px-4 py-3 text-xs text-slate-600 shadow-sm dark:border-slate-800/70 dark:from-slate-950/70 dark:to-slate-950/50 dark:text-slate-300"
          >
            <span className="uppercase tracking-wide text-[10px] text-slate-500 dark:text-slate-500">{tile.label}</span>
            <span className={`text-sm font-semibold text-slate-900 dark:text-white ${tile.accent}`}>{tile.value}</span>
          </div>
        ))}
      </section>

      {activityLog.length > 0 ? (
        <aside className="rounded-2xl border border-slate-200/70 bg-gradient-to-r from-white via-white to-slate-50 p-4 text-xs text-slate-600 shadow-sm dark:border-slate-800/70 dark:from-slate-950/60 dark:via-slate-950/50 dark:to-slate-900/60 dark:text-slate-300">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">
            Bitácora rápida
          </p>
          <ul className="space-y-1">
            {activityLog.map((entry, index) => (
              <li key={`${entry}-${index}`} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 dark:bg-sky-300" />
                <span>{entry}</span>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.75fr_1fr]">
        <div className="flex flex-col gap-6">
          <ItemsGrid
            items={filteredItems}
            toolbar={toolbar}
            selectedIds={selectedItemIds}
            onToggleSelect={handleToggleSelect}
            onStatusChange={handleStatusChange}
            onRequestTransfer={handleRequestTransfer}
          />
          <TransferPipeline
            transfers={transfers}
            onAdvance={handleAdvanceTransfer}
            onViewManifest={handleManifestView}
          />
          <QuarantineQueue
            items={quarantine}
            onResolve={handleResolveQuarantine}
            onEscalate={handleEscalateQuarantine}
          />
        </div>
        <div className="flex flex-col gap-6">
          <ValueSnapshot metrics={valuationMetrics} />
          <ReceiveWizard
            shipments={shipments}
            onAdvance={handleAdvanceShipment}
            onTogglePhotos={handleTogglePhotos}
          />
          <CountsProgress
            sessions={countSessions}
            onAdvance={handleAdvanceCount}
            onOpenReconciliation={handleOpenReconciliation}
          />
        </div>
      </div>
    </div>
  );
}
