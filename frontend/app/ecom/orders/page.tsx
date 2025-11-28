"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Download,
  Edit,
  FileText,
  Loader2,
  MapPin,
  Package,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Truck,
  Undo2,
  User,
} from "lucide-react";
import { OrderTimeline } from "@/components/ecom/order-timeline";
import { InventoryAllocationView } from "@/components/ecom/inventory-allocation-view";
import { formatCurrencyFromCents } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  fulfilled: "Despachado",
  cancelled: "Cancelado",
};

const statusTone: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-300 border border-amber-500/40",
  paid: "bg-primary/10 text-sky-300 border border-sky-500/40",
  fulfilled: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40",
  cancelled: "bg-rose-500/10 text-rose-300 border border-rose-500/40",
};

type StatusMessage = { tone: "success" | "error"; message: string } | null;

type OrderItem = {
  listingId: number | null;
  productCodeId: number | null;
  quantity: number;
  priceCents: number;
};

type OrderRecord = {
  id: number;
  channelId: number;
  channelName: string | null;
  provider: string | null;
  externalId: string;
  customerName: string;
  customerEmail: string | null;
  status: string;
  paymentStatus: string | null;
  fulfillmentStatus: string | null;
  totalCents: number;
  subtotalCents: number | null;
  taxCents: number | null;
  shippingCents: number | null;
  currency: string;
  createdAt: string | null;
  updatedAt: string | null;
  shippingAddress: unknown;
  billingAddress: unknown;
  trackingNumber: string | null;
  shippingCarrier: string | null;
  internalOrderId: number | null;
  items: OrderItem[];
};

type OrdersResponse = {
  orders: OrderRecord[];
  pagination: { page: number; pageSize: number; hasMore: boolean; nextPage: number | null };
  metadata: { channels: { id: number; name: string; provider: string; status: string }[] };
  filtersApplied: { search?: string; status?: string; channelId?: number | null };
};

const statusFilterOptions = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendiente" },
  { value: "paid", label: "Pagado" },
  { value: "fulfilled", label: "Despachado" },
  { value: "cancelled", label: "Cancelado" },
] as const;

type FiltersState = {
  search: string;
  status: (typeof statusFilterOptions)[number]["value"];
  channelId: number | "all";
};

const defaultFilters: FiltersState = {
  search: "",
  status: "all",
  channelId: "all",
};

const actionLabels: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  pick: { label: "Pick", icon: Package },
  pack: { label: "Pack", icon: ClipboardList },
  label: { label: "Label", icon: CheckCircle2 },
  ship: { label: "Ship", icon: Truck },
  cancel: { label: "Cancelar", icon: Undo2 },
};

const actionOrder = ["pick", "pack", "label", "ship", "cancel"] as const;

export default function EcommerceOrdersPage() {
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [channels, setChannels] = useState<{ id: number; name: string; provider: string; status: string }[]>([]);
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; hasMore: boolean; nextPage: number | null }>(
    { page: 1, pageSize: 25, hasMore: false, nextPage: null }
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [importForm, setImportForm] = useState({ channelId: "", payload: "" });
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importProgress, setImportProgress] = useState<{ importing: boolean; progress: number }>({ importing: false, progress: 0 });
  const [importFilters, setImportFilters] = useState({
    channelId: "",
    startDate: "",
    endDate: "",
    status: "all",
  });
  const [orderNotes, setOrderNotes] = useState<Record<number, string>>({});
  const [showShippingModal, setShowShippingModal] = useState<number | null>(null);
  const [shippingData, setShippingData] = useState({ trackingNumber: "", carrier: "" });

  const orderSummary = useMemo(() => {
    const summary: Record<string, number> = { pending: 0, paid: 0, fulfilled: 0, cancelled: 0 };
    for (const order of orders) {
      if (summary[order.status] !== undefined) {
        summary[order.status] += 1;
      }
    }
    return summary;
  }, [orders]);

  const buildQueryString = useCallback((state: FiltersState) => {
    const params = new URLSearchParams();
    if (state.search.trim()) {
      params.set("search", state.search.trim());
    }
    if (state.status !== "all") {
      params.set("status", state.status);
    }
    if (state.channelId !== "all") {
      params.set("channelId", String(state.channelId));
    }
    params.set("page", "1");
    params.set("pageSize", "50");
    return params.toString();
  }, []);

  const fetchOrders = useCallback(
    async (state: FiltersState) => {
      setLoading(true);
      setStatus(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/ecom/orders?${buildQueryString(state)}`);
        const data = (await response.json()) as OrdersResponse;
        if (!response.ok) {
          throw new Error((data as { error?: string })?.error ?? "No se pudieron obtener las órdenes");
        }
        setOrders(data.orders ?? []);
        setChannels(data.metadata?.channels ?? []);
        setPagination(data.pagination ?? { page: 1, pageSize: 25, hasMore: false, nextPage: null });
      } catch (error) {
        setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al cargar órdenes" });
        setOrders([]);
      } finally {
        setLoading(false);
      }
    },
    [buildQueryString]
  );

  useEffect(() => {
    fetchOrders(filters).catch(() => {
      /* handled */
    });
  }, [fetchOrders, filters]);

  const statusBadge = (value: string) => {
    const tone = statusTone[value] ?? statusTone.pending;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${tone}`}>
        <CheckCircle2 className="h-3 w-3" /> {statusLabels[value] ?? value}
      </span>
    );
  };

  const runOrderAction = async (order: OrderRecord, action: (typeof actionOrder)[number]) => {
    setStatus(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ecom/orders/${order.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo ejecutar la acción");
      }
      setStatus({ tone: "success", message: `Orden ${order.externalId} actualizada (${action})` });
      await fetchOrders(filters);
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al actualizar orden" });
    } finally {
      setLoading(false);
    }
  };

  const submitImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!importForm.channelId) {
      setStatus({ tone: "error", message: "Selecciona el canal de destino" });
      return;
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(importForm.payload);
      if (!Array.isArray(parsedPayload)) {
        throw new Error("Debe ser un arreglo de órdenes");
      }
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "JSON inválido" });
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ecom/orders/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: Number(importForm.channelId), orders: parsedPayload }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudieron importar las órdenes");
      }
      setStatus({ tone: "success", message: `Órdenes importadas (nuevas: ${data.created ?? 0}, actualizadas: ${data.updated ?? 0})` });
      setImportForm({ channelId: importForm.channelId, payload: "" });
      await fetchOrders(filters);
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al importar" });
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (value: unknown) => {
    if (!value) {
      return "—";
    }
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <ClipboardList className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Pedidos en línea</span>
        </div>
        <h1 className="text-3xl font-semibold text-foreground dark:text-white">E-Commerce · Gestión de órdenes</h1>
        <p className="max-w-3xl text-sm text-muted-foreground dark:text-slate-400">
          Controla el flujo pick/pack/ship, registra etiquetas y cancela pedidos con trazabilidad total.
        </p>
      </header>

      {status && (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            status.tone === "success" ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200" : "border-rose-500/60 bg-rose-500/10 text-rose-200"
          }`}
        >
          {status.tone === "success" ? <ShieldCheck className="mt-0.5 h-4 w-4" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}
          <span>{status.message}</span>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(orderSummary).map(([key, value]) => (
          <div key={key} className="rounded-lg border border-border dark:border-slate-800 bg-card dark:bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground dark:text-slate-400">{statusLabels[key] ?? key}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground dark:text-white">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border dark:border-slate-800 bg-card dark:bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground dark:text-slate-300" htmlFor="filter-search">
                Buscar
              </label>
              <input
                id="filter-search"
                className="w-56 rounded-md border border-input dark:border-slate-700 bg-background dark:bg-slate-950 px-3 py-2 text-sm text-foreground dark:text-white focus:border-sky-500 focus:outline-none"
                placeholder="Ticket o cliente"
                value={filters.search}
                onChange={(event) => setFilters((state) => ({ ...state, search: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground dark:text-slate-300" htmlFor="filter-status">
                Estado
              </label>
              <select
                id="filter-status"
                className="w-40 rounded-md border border-input dark:border-slate-700 bg-background dark:bg-slate-950 px-3 py-2 text-sm text-foreground dark:text-white focus:border-sky-500 focus:outline-none"
                value={filters.status}
                onChange={(event) => setFilters((state) => ({ ...state, status: event.target.value as FiltersState["status"] }))}
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground dark:text-slate-300" htmlFor="filter-channel">
                Canal
              </label>
              <select
                id="filter-channel"
                className="w-48 rounded-md border border-input dark:border-slate-700 bg-background dark:bg-slate-950 px-3 py-2 text-sm text-foreground dark:text-white focus:border-sky-500 focus:outline-none"
                value={filters.channelId}
                onChange={(event) =>
                  setFilters((state) => ({
                    ...state,
                    channelId: event.target.value === "all" ? "all" : Number(event.target.value),
                  }))
                }
              >
                <option value="all">Todos los canales</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name} ({channel.provider})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md border border-input dark:border-slate-700 px-3 py-2 text-sm text-foreground dark:text-slate-200 hover:bg-muted/80 dark:hover:bg-slate-800"
              onClick={() => setShowImportModal(true)}
            >
              <Plus className="h-4 w-4" /> Importar
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-input dark:border-slate-700 px-3 py-2 text-sm text-foreground dark:text-slate-200 hover:bg-muted/80 dark:hover:bg-slate-800"
              onClick={() => {
                // Export orders as CSV
                const csv = [
                  ["Pedido", "Cliente", "Email", "Estado", "Total", "Fecha"].join(","),
                  ...orders.map((o) =>
                    [
                      o.externalId,
                      `"${o.customerName}"`,
                      `"${o.customerEmail || ""}"`,
                      o.status,
                      o.totalCents / 100,
                      o.createdAt || "",
                    ].join(",")
                  ),
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `orders-${new Date().toISOString().split("T")[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4" /> Exportar
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-input dark:border-slate-700 px-3 py-2 text-sm text-foreground dark:text-slate-200 hover:bg-muted/80 dark:hover:bg-slate-800"
              onClick={() => fetchOrders(filters)}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Actualizar
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-md border border-border dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-muted dark:bg-slate-950/60 text-left text-xs uppercase tracking-wide text-muted-foreground dark:text-slate-400">
              <tr>
                <th className="px-3 py-2">Pedido</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Artículos</th>
                <th className="px-3 py-2">Destino</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-muted dark:bg-slate-950/40 text-sm text-foreground dark:text-slate-200">
              {orders.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground dark:text-slate-500">
                    No se encontraron órdenes con los filtros aplicados.
                  </td>
                </tr>
              )}

              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-foreground dark:text-white">{order.externalId}</div>
                    <div className="text-xs text-muted-foreground dark:text-slate-400">{order.channelName ?? `Canal #${order.channelId}`}</div>
                  </td>
                  <td className="px-3 py-3 align-top">{order.customerName}</td>
                  <td className="px-3 py-3 align-top">{statusBadge(order.status)}</td>
                  <td className="px-3 py-3 align-top">{formatCurrencyFromCents(order.totalCents)}</td>
                  <td className="px-3 py-3 align-top">
                    <ul className="space-y-1 text-xs text-muted-foreground dark:text-slate-400">
                      {order.items.map((item, index) => (
                        <li key={`${order.id}-${index}`}>
                          {item.quantity} × RD${" "}
                          {formatCurrencyFromCents(item.priceCents)}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <pre className="max-h-24 overflow-auto rounded-md bg-background dark:bg-slate-950/80 p-2 text-[11px] leading-snug text-muted-foreground dark:text-slate-400">
                      {formatAddress(order.shippingAddress)}
                    </pre>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        className="inline-flex items-center gap-1 rounded-md border border-input dark:border-slate-700 px-2.5 py-1 text-xs text-foreground dark:text-slate-200 hover:bg-muted/80 dark:hover:bg-slate-800"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <FileText className="h-3 w-3" /> Ver
                      </button>
                      {actionOrder.map((action) => {
                        const meta = actionLabels[action];
                        const Icon = meta.icon;
                        const disabled = loading;
                        return (
                          <button
                            key={action}
                            className="inline-flex items-center gap-1 rounded-md border border-input dark:border-slate-700 px-2.5 py-1 text-xs text-foreground dark:text-slate-200 hover:bg-muted/80 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => {
                              if (action === "ship") {
                                setShowShippingModal(order.id);
                              } else {
                                runOrderAction(order, action);
                              }
                            }}
                            disabled={disabled}
                          >
                            <Icon className="h-3 w-3" /> {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Detalles de Orden: {selectedOrder.externalId}</h2>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Customer Information */}
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <User className="h-4 w-4" /> Información del Cliente
                </h3>
                <div className="grid gap-2 md:grid-cols-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nombre:</span>{" "}
                    <span className="font-medium">{selectedOrder.customerName}</span>
                  </div>
                  {selectedOrder.customerEmail && (
                    <div>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      <span className="font-medium">{selectedOrder.customerEmail}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Estado:</span> {statusBadge(selectedOrder.status)}
                  </div>
                  {selectedOrder.paymentStatus && (
                    <div>
                      <span className="text-muted-foreground">Pago:</span>{" "}
                      <span className="font-medium">{selectedOrder.paymentStatus}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Addresses */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <MapPin className="h-4 w-4" /> Dirección de Envío
                  </h3>
                  <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                    {formatAddress(selectedOrder.shippingAddress)}
                  </pre>
                </div>
                {selectedOrder.billingAddress && (
                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MapPin className="h-4 w-4" /> Dirección de Facturación
                    </h3>
                    <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {formatAddress(selectedOrder.billingAddress)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Order Timeline */}
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <OrderTimeline
                  status={selectedOrder.status as any}
                  fulfillmentStatus={selectedOrder.fulfillmentStatus as any}
                  createdAt={selectedOrder.createdAt || ""}
                  updatedAt={selectedOrder.updatedAt || ""}
                />
              </div>

              {/* Inventory Allocation */}
              {selectedOrder.items.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <InventoryAllocationView
                    allocations={selectedOrder.items.map((item) => ({
                      branchId: item.allocatedBranchId,
                      versionId: item.allocatedVersionId,
                      productCode: item.sku || null,
                      quantity: item.quantity,
                    }))}
                  />
                </div>
              )}

              {/* Order Items */}
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Artículos</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded border border-border bg-background p-2 text-sm">
                      <div>
                        <span className="font-medium">{item.title || `Item ${idx + 1}`}</span>
                        {item.sku && <span className="text-muted-foreground"> ({item.sku})</span>}
                      </div>
                      <div className="text-right">
                        <div>{item.quantity} × {formatCurrencyFromCents(item.priceCents)}</div>
                        <div className="text-xs text-muted-foreground">
                          = {formatCurrencyFromCents(item.quantity * item.priceCents)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end gap-4 border-t border-border pt-4 text-sm">
                  {selectedOrder.subtotalCents && (
                    <div>
                      <span className="text-muted-foreground">Subtotal:</span>{" "}
                      <span className="font-medium">{formatCurrencyFromCents(selectedOrder.subtotalCents)}</span>
                    </div>
                  )}
                  {selectedOrder.taxCents && (
                    <div>
                      <span className="text-muted-foreground">Impuestos:</span>{" "}
                      <span className="font-medium">{formatCurrencyFromCents(selectedOrder.taxCents)}</span>
                    </div>
                  )}
                  {selectedOrder.shippingCents && (
                    <div>
                      <span className="text-muted-foreground">Envío:</span>{" "}
                      <span className="font-medium">{formatCurrencyFromCents(selectedOrder.shippingCents)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Total:</span>{" "}
                    <span className="font-semibold text-lg">{formatCurrencyFromCents(selectedOrder.totalCents)}</span>
                  </div>
                </div>
              </div>

              {/* Order Notes */}
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Notas</h3>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  value={orderNotes[selectedOrder.id] || ""}
                  onChange={(e) => setOrderNotes((prev) => ({ ...prev, [selectedOrder.id]: e.target.value }))}
                  placeholder="Agregar notas sobre esta orden..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cerrar
                </button>
                {!selectedOrder.internalOrderId && (
                  <button
                    type="button"
                    onClick={async () => {
                      // Convert to internal order
                      try {
                        const response = await fetch(`${API_BASE_URL}/api/ecom/orders/${selectedOrder.id}/convert`, {
                          method: "POST",
                        });
                        if (!response.ok) {
                          const data = await response.json();
                          throw new Error(data?.error ?? "Error al convertir");
                        }
                        setStatus({ tone: "success", message: "Orden convertida a orden interna" });
                        await fetchOrders(filters);
                        setSelectedOrder(null);
                      } catch (error) {
                        setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error" });
                      }
                    }}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Convertir a Orden Interna
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Orders Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Importar Órdenes</h2>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportForm({ channelId: "", payload: "" });
                  setImportFilters({ channelId: "", startDate: "", endDate: "", status: "all" });
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!importFilters.channelId) {
                  setStatus({ tone: "error", message: "Selecciona el canal" });
                  return;
                }

                setImportProgress({ importing: true, progress: 0 });
                try {
                  // Fetch orders from marketplace
                  const response = await fetch(
                    `${API_BASE_URL}/api/ecom/channels/${importFilters.channelId}/orders?` +
                      new URLSearchParams({
                        startDate: importFilters.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                        endDate: importFilters.endDate || new Date().toISOString().split("T")[0],
                        status: importFilters.status !== "all" ? importFilters.status : "",
                      })
                  );
                  const data = await response.json();
                  if (!response.ok) {
                    throw new Error(data?.error ?? "Error al importar");
                  }

                  setStatus({ tone: "success", message: `Órdenes importadas: ${data.imported || 0}` });
                  setShowImportModal(false);
                  await fetchOrders(filters);
                } catch (error) {
                  setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error" });
                } finally {
                  setImportProgress({ importing: false, progress: 0 });
                }
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Canal *</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={importFilters.channelId}
                    onChange={(e) => setImportFilters((state) => ({ ...state, channelId: e.target.value }))}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.name} ({channel.provider})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Estado</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={importFilters.status}
                    onChange={(e) => setImportFilters((state) => ({ ...state, status: e.target.value }))}
                  >
                    <option value="all">Todos</option>
                    <option value="pending">Pendiente</option>
                    <option value="paid">Pagado</option>
                    <option value="fulfilled">Despachado</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Fecha Inicio</label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={importFilters.startDate}
                    onChange={(e) => setImportFilters((state) => ({ ...state, startDate: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Fecha Fin</label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={importFilters.endDate}
                    onChange={(e) => setImportFilters((state) => ({ ...state, endDate: e.target.value }))}
                  />
                </div>
              </div>

              {importProgress.importing && (
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Importando órdenes...</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFilters({ channelId: "", startDate: "", endDate: "", status: "all" });
                  }}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={importProgress.importing}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {importProgress.importing ? (
                    <>
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Importando...
                    </>
                  ) : (
                    <>
                      <ClipboardList className="mr-2 inline h-4 w-4" /> Importar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shipping Label Modal */}
      {showShippingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Agregar Información de Envío</h2>
              <button
                type="button"
                onClick={() => {
                  setShowShippingModal(null);
                  setShippingData({ trackingNumber: "", carrier: "" });
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const response = await fetch(`${API_BASE_URL}/api/ecom/orders/${showShippingModal}/ship`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      trackingNumber: shippingData.trackingNumber,
                      carrier: shippingData.carrier,
                    }),
                  });
                  if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data?.error ?? "Error");
                  }
                  setStatus({ tone: "success", message: "Información de envío actualizada" });
                  setShowShippingModal(null);
                  setShippingData({ trackingNumber: "", carrier: "" });
                  await fetchOrders(filters);
                } catch (error) {
                  setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error" });
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Número de Rastreo</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={shippingData.trackingNumber}
                  onChange={(e) => setShippingData((state) => ({ ...state, trackingNumber: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Transportista</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={shippingData.carrier}
                  onChange={(e) => setShippingData((state) => ({ ...state, carrier: e.target.value }))}
                  required
                >
                  <option value="">Seleccionar...</option>
                  <option value="fedex">FedEx</option>
                  <option value="ups">UPS</option>
                  <option value="usps">USPS</option>
                  <option value="dhl">DHL</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowShippingModal(null);
                    setShippingData({ trackingNumber: "", carrier: "" });
                  }}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
