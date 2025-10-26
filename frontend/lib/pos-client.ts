import type { ProductSearchResult, ValidatedOrder } from "@/components/pos/types";

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
