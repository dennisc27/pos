import type { LucideIcon } from "lucide-react";

export type PriceOverrideApproval = {
  approvalCode: string;
  managerName: string;
  reason: string | null;
  createdAt: string | null;
};

export type CartLine = {
  /**
   * Unique identifier for the cart line. When the line maps to an existing
   * product code version the identifier should match that version so we can
   * reference it during API calls.
   */
  id: string;
  productCodeId?: number;
  productCodeVersionId?: number;
  code?: string;
  name: string;
  sku: string;
  status?: string;
  variant?: string;
  qty: number;
  price: number;
  listPrice?: number;
  taxRate?: number;
  note?: string;
  override?: PriceOverrideApproval | null;
};

export type SaleSummary = {
  subtotal: number;
  discounts: number;
  tax: number;
  total: number;
  balanceDue: number;
  cashDue: number;
  nonCashTendered: number;
  tendered: number;
  changeDue: number;
};

export type TenderBreakdown = {
  id: string;
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

export type ProductCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  price: number;
  stock: number;
  highlight?: string;
  previewLabel?: string;
  variant?: string;
};

export type ProductSearchResult = {
  id: number;
  code: string;
  name: string;
  sku: string | null;
  description: string | null;
  versionId: number | null;
  branchId: number | null;
  priceCents: number | null;
  costCents: number | null;
  qtyOnHand: number | null;
  qtyReserved: number | null;
  isActive: number | null;
};

export type ValidatedOrder = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  discountCents: number;
};
