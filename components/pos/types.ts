export type CartLine = {
  id: string;
  name: string;
  sku: string;
  status?: string;
  variant?: string;
  qty: number;
  price: number;
  discount?: number;
  taxRate?: number;
  note?: string;
};

export type SaleSummary = {
  subtotal: number;
  discounts: number;
  tax: number;
  total: number;
  balanceDue: number;
};

export type TenderBreakdown = {
  method: "cash" | "card" | "transfer" | "store_credit" | "gift";
  label: string;
  amount: number;
  reference?: string;
  status?: "captured" | "pending" | "offline";
};

export type RegisterEvent = {
  id: string;
  time: string;
  type: "sale" | "paid_in" | "paid_out" | "drop" | "refund";
  description: string;
  amount?: number;
  clerk: string;
};

export type QueuedSale = {
  id: string;
  receipt: string;
  customer: string;
  amount: number;
  reason: string;
  status: "waiting" | "retrying" | "synced";
};
