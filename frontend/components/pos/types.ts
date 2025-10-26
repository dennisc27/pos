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

export type CreatedOrder = {
  order: {
    id: number;
    orderNumber: string | null;
    branchId: number;
    userId: number;
    customerId: number | null;
    status: string;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    createdAt: string | null;
    updatedAt: string | null;
  };
  items: {
    productCodeVersionId: number;
    qty: number;
    unitPriceCents: number;
    totalCents: number;
    listPriceCents: number;
    overrideApplied: boolean;
  }[];
};

export type CreatedInvoice = {
  invoice: {
    id: number;
    invoiceNo: string;
    orderId: number;
    totalCents: number;
    taxCents: number;
    createdAt: string | null;
  };
  totals: {
    totalCents: number;
    netCents: number;
    taxCents: number;
  };
  order: {
    id: number;
    branchId: number;
    status: string;
  };
  items: {
    id: number;
    qty: number;
    unitPriceCents: number;
    totalCents: number;
    netCents: number;
    taxCents: number;
  }[];
};

export type RecordedPayment = {
  payment: {
    id: number;
    orderId: number | null;
    invoiceId: number | null;
    shiftId: number | null;
    method: string;
    amountCents: number;
    meta: Record<string, unknown> | null;
    createdAt: string | null;
  };
  invoice: {
    invoiceId: number;
    totalCents: number | null;
    paidCents: number;
    remainingCents: number;
  } | null;
  order: {
    orderId: number;
    paidCents: number;
  } | null;
  ledger: {
    giftCard: { giftCardId: number; balanceCents: number } | null;
    creditNote: { creditNoteId: number; balanceCents: number } | null;
    stockPosted: boolean;
  };
};

export type ReceiptPrintJob = {
  invoice: {
    id: number;
    invoiceNo: string;
    orderId: number;
    totalCents: number;
    taxCents: number;
    createdAt: string | null;
  };
  order: {
    id: number;
    orderNumber: string | null;
    branchId: number;
    userId: number;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
  };
  items: {
    id: number;
    qty: number;
    unitPriceCents: number;
    totalCents: number;
    code: string | null;
    name: string | null;
    netCents: number;
    taxCents: number;
  }[];
  payments: {
    id: number;
    method: string;
    amountCents: number;
    createdAt: string | null;
  }[];
  printJob: {
    preview: string[];
    escposBase64: string;
  };
};

export type RefundMethod = "cash" | "store_credit";

export type InvoiceLookupItem = {
  id: number;
  qty: number;
  unitPriceCents: number;
  totalCents: number;
  product: {
    codeId: number;
    code: string | null;
    name: string | null;
    sku: string | null;
    versionId: number;
  };
  refunded: {
    qty: number;
    cents: number;
  };
  refundable: {
    qty: number;
    cents: number;
  };
};

export type InvoiceLookupResult = {
  invoice: {
    id: number;
    invoiceNo: string;
    totalCents: number;
    taxCents: number;
    createdAt: string | null;
  };
  order: {
    id: number;
    orderNumber: string | null;
    status: string;
    branchId: number;
    userId: number;
    customerId: number | null;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
  };
  items: InvoiceLookupItem[];
  totals: {
    refundableCents: number;
    refundedCents: number;
  };
};

export type SalesReturnLine = {
  orderItemId: number;
  qty: number;
  refundCents: number;
  remainingQty: number;
  remainingCents: number;
};

export type CreatedRefund = {
  salesReturn: {
    id: number;
    invoiceId: number;
    condition: string;
    refundMethod: RefundMethod;
    totalRefundCents: number;
    createdAt: string | null;
    reason: string | null;
  };
  lines: SalesReturnLine[];
  restocked: { productCodeVersionId: number; qty: number }[];
  creditNote: {
    id: number;
    customerId: number;
    balanceCents: number;
    reason: string | null;
    createdAt: string | null;
  } | null;
};
