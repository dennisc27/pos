import type {
  CreatedInvoice,
  CreatedOrder,
  ProductSearchResult,
  ReceiptPrintJob,
  RecordedPayment,
  ValidatedOrder
} from "@/components/pos/types";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

type OrderItemPayload = {
  productCodeVersionId: number;
  qty: number;
  unitPriceCents?: number;
};

type ValidateOrderResponse = {
  data: ValidatedOrder & {
    items: {
      productCodeVersionId: number;
      qty: number;
      unitPriceCents: number;
      totalCents: number;
      listPriceCents: number;
      overrideApplied: boolean;
    }[];
  };
  meta: { validated: boolean };
};

type PriceOverrideResponse = {
  data: {
    approvalId: number | null;
    approvalCode: string;
    manager: { id: number; fullName: string; role: string };
    cartTotalCents: number;
    overrideTotalCents: number;
    overrideDeltaCents: number;
    reason: string | null;
    createdAt: string | null;
  };
  meta: { approved: boolean };
};

export async function searchProducts(
  query: string,
  { signal, limit, branchId }: { signal?: AbortSignal; limit?: number; branchId?: number } = {}
) {
  const params = new URLSearchParams({ q: query.trim() });
  if (limit) {
    params.set("limit", String(limit));
  }
  if (branchId) {
    params.set("branchId", String(branchId));
  }

  const response = await fetch(`/api/products?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message =
      (errorPayload && typeof errorPayload.message === "string" && errorPayload.message) ||
      `Unable to search products (status ${response.status})`;
    throw new Error(message);
  }

  const payload = (await response.json()) as { data: ProductSearchResult[] };
  return payload.data ?? [];
}

export async function validateOrder(
  payload: {
    branchId: number;
    taxCents?: number;
    items: OrderItemPayload[];
  },
  { signal }: { signal?: AbortSignal } = {}
) {
  const response = await fetch("/api/orders/validate", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message =
      (errorPayload && typeof errorPayload.message === "string" && errorPayload.message) ||
      `Unable to validate order (status ${response.status})`;
    throw new Error(message);
  }

  const json = (await response.json()) as ValidateOrderResponse;
  return json.data;
}

export async function requestPriceOverride(
  payload: {
    managerId: number;
    pin: string;
    cartTotalCents: number;
    overrideTotalCents: number;
    reason?: string;
  },
  { signal }: { signal?: AbortSignal } = {}
) {
  const response = await fetch("/api/cart/price-override", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message =
      (errorPayload && typeof errorPayload.message === "string" && errorPayload.message) ||
      `Unable to approve price override (status ${response.status})`;
    throw new Error(message);
  }

  const json = (await response.json()) as PriceOverrideResponse;
  return json.data;
}

type CreateOrderResponse = {
  data: CreatedOrder;
  meta: { created: boolean };
};

export async function createOrder(
  payload: {
    branchId: number;
    userId: number;
    customerId?: number | null;
    orderNumber?: string;
    status?: string;
    taxCents?: number;
    items: OrderItemPayload[];
  },
  { signal }: { signal?: AbortSignal } = {}
) {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message =
      (errorPayload && typeof errorPayload.message === "string" && errorPayload.message) ||
      `Unable to create order (status ${response.status})`;
    throw new Error(message);
  }

  const json = (await response.json()) as CreateOrderResponse;
  return json.data;
}

type CreateInvoiceResponse = {
  data: CreatedInvoice;
  meta: { created: boolean };
};

export async function createInvoice(
  payload: { orderId: number; invoiceNumber?: string },
  { signal }: { signal?: AbortSignal } = {}
) {
  const response = await fetch("/api/invoices", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message =
      (errorPayload && typeof errorPayload.message === "string" && errorPayload.message) ||
      `Unable to create invoice (status ${response.status})`;
    throw new Error(message);
  }

  const json = (await response.json()) as CreateInvoiceResponse;
  return json.data;
}

type RecordPaymentResponse = {
  data: RecordedPayment;
  meta: { created: boolean };
};

export async function recordPayment(
  payload: {
    orderId?: number | null;
    invoiceId?: number | null;
    shiftId?: number | null;
    method: string;
    amountCents: number;
    meta?: Record<string, unknown> | null;
  },
  { signal }: { signal?: AbortSignal } = {}
) {
  const response = await fetch("/api/payments", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message =
      (errorPayload && typeof errorPayload.message === "string" && errorPayload.message) ||
      `Unable to record payment (status ${response.status})`;
    throw new Error(message);
  }

  const json = (await response.json()) as RecordPaymentResponse;
  return json.data;
}

type PrintReceiptResponse = {
  data: ReceiptPrintJob;
  meta: { queued: boolean };
};

export async function queueReceiptPrint(
  invoiceId: number,
  { signal }: { signal?: AbortSignal } = {}
) {
  const response = await fetch(`/api/receipts/${invoiceId}/print`, {
    method: "POST",
    headers: JSON_HEADERS,
    signal,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    const message =
      (errorPayload && typeof errorPayload.message === "string" && errorPayload.message) ||
      `Unable to queue receipt print (status ${response.status})`;
    throw new Error(message);
  }

  const json = (await response.json()) as PrintReceiptResponse;
  return json.data;
}
