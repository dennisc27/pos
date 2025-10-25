export type InventoryItem = {
  id: string;
  sku: string;
  description: string;
  category: string;
  location: {
    name: string;
    kind: "store" | "safe" | "bench" | "wip" | "quarantine" | "transfer";
  };
  qty: number;
  uom: "pcs" | "grams" | "carats";
  wac: number;
  retail: number;
  agedDays: number;
  channel: "Storefront" | "eBay" | "Amazon" | "Website" | "Wholesale";
  status: "available" | "hold" | "pending_transfer" | "quarantine";
};

export type ReceivingShipment = {
  id: string;
  vendor: string;
  eta: string;
  items: number;
  photosRequired: number;
  value: number;
  status: "unpacked" | "counting" | "tagging" | "ready";
};

export type InventoryTransfer = {
  id: string;
  reference: string;
  from: string;
  to: string;
  items: number;
  value: number;
  status: "in_transit" | "received" | "staged";
  carrier: string;
  lastScan: string;
};

export type QuarantineItem = {
  id: string;
  sku: string;
  description: string;
  reason: string;
  assignedTo: string;
  since: string;
  nextAction: string;
};

export type CountSession = {
  id: string;
  name: string;
  scope: string;
  type: "cycle" | "full" | "blind";
  scheduledFor: string;
  progress: number;
  counted: number;
  expected: number;
  status: "scheduled" | "in_progress" | "reconciling" | "posted";
};

export type ValueMetric = {
  label: string;
  amount: number;
  currency?: "DOP" | "USD";
  trend?: {
    direction: "up" | "down" | "flat";
    label: string;
  };
};
