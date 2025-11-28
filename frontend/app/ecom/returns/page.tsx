"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Loader2,
  PackageCheck,
  Plus,
  RefreshCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { ReturnConditionSelector } from "@/components/ecom/return-condition-selector";
import { formatCurrencyFromCents } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const statusLabels: Record<string, string> = {
  requested: "Solicitado",
  approved: "Aprobado",
  received: "Recibido",
  refunded: "Reembolsado",
  denied: "Rechazado",
};

const statusTone: Record<string, string> = {
  requested: "bg-amber-500/10 text-amber-300 border border-amber-500/40",
  approved: "bg-primary/10 text-sky-300 border border-sky-500/40",
  received: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40",
  refunded: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40",
  denied: "bg-rose-500/10 text-rose-300 border border-rose-500/40",
};

type StatusMessage = { tone: "success" | "error"; message: string } | null;

type ReturnItem = {
  id: number;
  orderItemId: number;
  condition: string;
  restock: boolean;
};

type ReturnRecord = {
  id: number;
  orderId: number;
  channelId: number;
  channelName: string | null;
  externalOrderId: string | null;
  status: string;
  reason: string | null;
  refundAmountCents: number | null;
  refundMethod: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  items: ReturnItem[];
};

type ReturnsResponse = {
  returns: ReturnRecord[];
  pagination: { page: number; pageSize: number; hasMore: boolean; nextPage: number | null };
  filtersApplied: { status?: string; channelId?: number | null };
};

const statusFilterOptions = [
  { value: "all", label: "Todos" },
  { value: "requested", label: "Solicitado" },
  { value: "approved", label: "Aprobado" },
  { value: "received", label: "Recibido" },
  { value: "refunded", label: "Reembolsado" },
  { value: "denied", label: "Rechazado" },
] as const;

type FiltersState = {
  status: (typeof statusFilterOptions)[number]["value"];
  channelId: number | "all";
};

const defaultFilters: FiltersState = {
  status: "all",
  channelId: "all",
};

const actionLabels: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  approve: { label: "Aprobar", icon: CheckCircle2 },
  receive: { label: "Recibir", icon: PackageCheck },
  refund: { label: "Reembolsar", icon: ClipboardCheck },
  deny: { label: "Rechazar", icon: XCircle },
};

const actionOrder = ["approve", "receive", "refund", "deny"] as const;

export default function EcommerceReturnsPage() {
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [channels, setChannels] = useState<{ id: number; name: string; provider: string; status: string }[]>([]);
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; hasMore: boolean; nextPage: number | null }>(
    { page: 1, pageSize: 25, hasMore: false, nextPage: null }
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(null);
  const [createForm, setCreateForm] = useState({
    orderId: "",
    reason: "",
    items: [] as Array<{ orderItemId: number; quantity: number; condition: string | null }>,
  });
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [selectedOrderItems, setSelectedOrderItems] = useState<any[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState<number | null>(null);
  const [approvalComment, setApprovalComment] = useState("");
  const [showReceiveModal, setShowReceiveModal] = useState<number | null>(null);
  const [receiveData, setReceiveData] = useState<Record<number, { condition: string; restock: boolean }>>({});
  const [showRefundModal, setShowRefundModal] = useState<number | null>(null);
  const [refundData, setRefundData] = useState({ amount: "", method: "original" });

  const buildQueryString = useCallback((state: FiltersState) => {
    const params = new URLSearchParams();
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

  const fetchReturns = useCallback(
    async (state: FiltersState) => {
      setLoading(true);
      setStatus(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/ecom/returns?${buildQueryString(state)}`);
        const data = (await response.json()) as ReturnsResponse;
        if (!response.ok) {
          throw new Error((data as { error?: string })?.error ?? "No se pudieron obtener las devoluciones");
        }
        setReturns(data.returns ?? []);
        setPagination(data.pagination ?? { page: 1, pageSize: 25, hasMore: false, nextPage: null });
      } catch (error) {
        setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al cargar devoluciones" });
        setReturns([]);
      } finally {
        setLoading(false);
      }
    },
    [buildQueryString]
  );

  useEffect(() => {
    fetchReturns(filters).catch(() => {
      /* handled */
    });
  }, [fetchReturns, filters]);

  useEffect(() => {
    // Load available orders for return creation
    if (showCreateForm) {
      fetch(`${API_BASE_URL}/api/ecom/orders?limit=100`)
        .then((res) => res.json())
        .then((data) => {
          if (data.orders) {
            setAvailableOrders(data.orders);
          }
        })
        .catch(() => {
          /* handled */
        });
    }
  }, [showCreateForm]);

  useEffect(() => {
    // reuse channels from orders endpoint to avoid extra fetch
    async function loadChannels() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/ecom/orders?pageSize=1`);
        const data = (await response.json()) as OrdersResponseWithChannels;
        if (response.ok && Array.isArray(data.metadata?.channels)) {
          setChannels(data.metadata.channels);
        }
      } catch (error) {
        // ignore silently
      }
    }
    loadChannels().catch(() => undefined);
  }, []);

  const runReturnAction = async (record: ReturnRecord, action: (typeof actionOrder)[number]) => {
    setStatus(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ecom/returns/${record.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo ejecutar la acción");
      }
      const restocked = Array.isArray(data?.restockedItems) ? data.restockedItems.length : 0;
      setStatus({
        tone: "success",
        message: `Devolución #${record.id} actualizada (${action}). Restock: ${restocked}`,
      });
      await fetchReturns(filters);
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al actualizar devolución" });
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (value: string) => {
    const tone = statusTone[value] ?? statusTone.requested;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${tone}`}>
        <CheckCircle2 className="h-3 w-3" /> {statusLabels[value] ?? value}
      </span>
    );
  };

  const restockBadge = (item: ReturnItem) => {
    return item.restock && item.condition !== "damaged" ? (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
        <ArrowRightLeft className="h-3 w-3" /> Restock
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full border border-input dark:border-slate-700 bg-card dark:bg-slate-900/70 px-2 py-0.5 text-[10px] text-muted-foreground dark:text-slate-300">
        <ArrowRightLeft className="h-3 w-3" /> No restock
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <ArrowRightLeft className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Devoluciones</span>
        </div>
        <h1 className="text-3xl font-semibold text-foreground dark:text-white">E-Commerce · RMA y reembolsos</h1>
        <p className="max-w-3xl text-sm text-muted-foreground dark:text-slate-400">
          Gestiona devoluciones, controla inventario restock y publica reembolsos con trazabilidad total.
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

      <section className="rounded-lg border border-border dark:border-slate-800 bg-card dark:bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-3">
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
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-4 w-4" /> Crear Devolución
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-input dark:border-slate-700 px-3 py-2 text-sm text-foreground dark:text-slate-200 hover:bg-muted/80 dark:hover:bg-slate-800"
              onClick={() => {
                const csv = [
                  ["RMA", "Orden", "Estado", "Motivo", "Fecha"].join(","),
                  ...returns.map((r) =>
                    [
                      r.id,
                      r.externalOrderId || r.orderId,
                      r.status,
                      `"${r.reason || ""}"`,
                      r.createdAt || "",
                    ].join(",")
                  ),
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `returns-${new Date().toISOString().split("T")[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4" /> Exportar
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-input dark:border-slate-700 px-3 py-2 text-sm text-foreground dark:text-slate-200 hover:bg-muted/80 dark:hover:bg-slate-800"
              onClick={() => fetchReturns(filters)}
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
                <th className="px-3 py-2">RMA</th>
                <th className="px-3 py-2">Orden</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Artículos</th>
                <th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-muted dark:bg-slate-950/40 text-sm text-foreground dark:text-slate-200">
              {returns.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground dark:text-slate-500">
                    No se encontraron devoluciones.
                  </td>
                </tr>
              )}

              {returns.map((record) => (
                <tr key={record.id}>
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-foreground dark:text-white">#{record.id}</div>
                    <div className="text-xs text-muted-foreground dark:text-slate-400">{record.channelName ?? `Canal #${record.channelId}`}</div>
                    <div className="text-xs text-muted-foreground dark:text-slate-500">{record.createdAt ? new Date(record.createdAt).toLocaleString() : ""}</div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-foreground dark:text-white">{record.externalOrderId ?? record.orderId}</div>
                  </td>
                  <td className="px-3 py-3 align-top">{statusBadge(record.status)}</td>
                  <td className="px-3 py-3 align-top">
                    <ul className="space-y-1 text-xs text-muted-foreground dark:text-slate-400">
                      {record.items.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3">
                          <span>Item #{item.orderItemId}</span>
                          {restockBadge(item)}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <span className="text-xs text-muted-foreground dark:text-slate-400">{record.reason ?? "—"}</span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        className="inline-flex items-center gap-1 rounded-md border border-input dark:border-slate-700 px-2.5 py-1 text-xs text-foreground dark:text-slate-200 hover:bg-muted/80 dark:hover:bg-slate-800"
                        onClick={() => setSelectedReturn(record)}
                      >
                        <FileText className="h-3 w-3" /> Ver
                      </button>
                      {actionOrder.map((action) => {
                        const meta = actionLabels[action];
                        const Icon = meta.icon;
                        return (
                          <button
                            key={action}
                            className="inline-flex items-center gap-1 rounded-md border border-input dark:border-slate-700 px-2.5 py-1 text-xs text-foreground dark:text-slate-200 hover:bg-muted/80 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => {
                              if (action === "approve" || action === "deny") {
                                setShowApprovalModal(record.id);
                              } else if (action === "receive") {
                                setShowReceiveModal(record.id);
                                // Initialize receive data with item conditions
                                const initialData: Record<number, { condition: string; restock: boolean }> = {};
                                record.items.forEach((item) => {
                                  initialData[item.id] = { condition: item.condition, restock: item.restock };
                                });
                                setReceiveData(initialData);
                              } else if (action === "refund") {
                                setShowRefundModal(record.id);
                              } else {
                                runReturnAction(record, action);
                              }
                            }}
                            disabled={loading}
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

      {/* Create Return Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Crear Devolución</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateForm({ orderId: "", reason: "", items: [] });
                  setSelectedOrderItems([]);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!createForm.orderId || createForm.items.length === 0) {
                  setStatus({ tone: "error", message: "Selecciona una orden y al menos un artículo" });
                  return;
                }

                setLoading(true);
                try {
                  const response = await fetch(`${API_BASE_URL}/api/ecom/returns`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      ecomOrderId: Number.parseInt(createForm.orderId, 10),
                      reason: createForm.reason,
                      items: createForm.items.map((item) => ({
                        orderItemId: item.orderItemId,
                        quantity: item.quantity,
                        condition: item.condition,
                      })),
                    }),
                  });

                  const data = await response.json();
                  if (!response.ok) {
                    throw new Error(data?.error ?? "Error al crear devolución");
                  }

                  setStatus({ tone: "success", message: "Devolución creada correctamente" });
                  setShowCreateForm(false);
                  setCreateForm({ orderId: "", reason: "", items: [] });
                  setSelectedOrderItems([]);
                  await fetchReturns(filters);
                } catch (error) {
                  setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error" });
                } finally {
                  setLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Orden *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={createForm.orderId}
                  onChange={async (e) => {
                    const orderId = e.target.value;
                    setCreateForm((state) => ({ ...state, orderId, items: [] }));
                    if (orderId) {
                      try {
                        const response = await fetch(`${API_BASE_URL}/api/ecom/orders/${orderId}`);
                        const data = await response.json();
                        if (response.ok && data.order) {
                          setSelectedOrderItems(data.order.items || []);
                        }
                      } catch (error) {
                        // Handle error
                      }
                    } else {
                      setSelectedOrderItems([]);
                    }
                  }}
                  required
                >
                  <option value="">Seleccionar orden...</option>
                  {availableOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.externalId} - {order.customerName}
                    </option>
                  ))}
                </select>
              </div>

              {selectedOrderItems.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Artículos a Devolver *</label>
                  {selectedOrderItems.map((item) => {
                    const returnItem = createForm.items.find((i) => i.orderItemId === item.id);
                    return (
                      <div key={item.id} className="rounded-md border border-border bg-muted/40 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-medium text-sm">{item.title || `Item ${item.id}`}</div>
                            {item.sku && <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>}
                          </div>
                          <div className="text-sm font-medium">
                            {formatCurrencyFromCents((item.priceCents || 0) * (returnItem?.quantity || 0))}
                          </div>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Cantidad</label>
                            <input
                              type="number"
                              min="1"
                              max={item.quantity}
                              className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              value={returnItem?.quantity || 0}
                              onChange={(e) => {
                                const qty = Number.parseInt(e.target.value, 10) || 0;
                                if (qty > 0 && qty <= item.quantity) {
                                  setCreateForm((state) => {
                                    const existing = state.items.findIndex((i) => i.orderItemId === item.id);
                                    if (existing >= 0) {
                                      const newItems = [...state.items];
                                      newItems[existing] = { ...newItems[existing], quantity: qty };
                                      return { ...state, items: newItems };
                                    } else {
                                      return {
                                        ...state,
                                        items: [...state.items, { orderItemId: item.id, quantity: qty, condition: null }],
                                      };
                                    }
                                  });
                                } else if (qty === 0) {
                                  setCreateForm((state) => ({
                                    ...state,
                                    items: state.items.filter((i) => i.orderItemId !== item.id),
                                  }));
                                }
                              }}
                            />
                          </div>
                          {returnItem && returnItem.quantity > 0 && (
                            <div>
                              <ReturnConditionSelector
                                value={returnItem.condition as any}
                                onChange={(condition) => {
                                  setCreateForm((state) => {
                                    const existing = state.items.findIndex((i) => i.orderItemId === item.id);
                                    if (existing >= 0) {
                                      const newItems = [...state.items];
                                      newItems[existing] = { ...newItems[existing], condition };
                                      return { ...state, items: newItems };
                                    }
                                    return state;
                                  });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Motivo *</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  value={createForm.reason}
                  onChange={(e) => setCreateForm((state) => ({ ...state, reason: e.target.value }))}
                  required
                  placeholder="Describe el motivo de la devolución..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateForm({ orderId: "", reason: "", items: [] });
                    setSelectedOrderItems([]);
                  }}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Plus className="mr-2 inline h-4 w-4" />}
                  Crear Devolución
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Detail Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Devolución #{selectedReturn.id}</h2>
              <button
                type="button"
                onClick={() => setSelectedReturn(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Información</h3>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Orden:</span>{" "}
                      <span className="font-medium">{selectedReturn.externalOrderId || selectedReturn.orderId}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Estado:</span> {statusBadge(selectedReturn.status)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Canal:</span>{" "}
                      <span className="font-medium">{selectedReturn.channelName || `#${selectedReturn.channelId}`}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fecha:</span>{" "}
                      <span className="font-medium">
                        {selectedReturn.createdAt ? new Date(selectedReturn.createdAt).toLocaleString() : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Reembolso</h3>
                  <div className="space-y-1 text-sm">
                    {selectedReturn.refundAmountCents ? (
                      <>
                        <div>
                          <span className="text-muted-foreground">Monto:</span>{" "}
                          <span className="font-medium">{formatCurrencyFromCents(selectedReturn.refundAmountCents)}</span>
                        </div>
                        {selectedReturn.refundMethod && (
                          <div>
                            <span className="text-muted-foreground">Método:</span>{" "}
                            <span className="font-medium">{selectedReturn.refundMethod}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-muted-foreground">No procesado</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Motivo</h3>
                <p className="text-sm text-muted-foreground">{selectedReturn.reason || "—"}</p>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Artículos</h3>
                <div className="space-y-2">
                  {selectedReturn.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded border border-border bg-background p-2 text-sm">
                      <div>
                        <div className="font-medium">Item #{item.orderItemId}</div>
                        <div className="text-xs text-muted-foreground">
                          Condición: {item.condition} • {item.restock ? "Restock" : "No restock"}
                        </div>
                      </div>
                      {item.priceCents && (
                        <div className="font-medium">{formatCurrencyFromCents(item.priceCents * (item.quantity || 1))}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedReturn(null)}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Aprobar/Rechazar Devolución</h2>
              <button
                type="button"
                onClick={() => {
                  setShowApprovalModal(null);
                  setApprovalComment("");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const action = (e.nativeEvent as any).submitter?.name || "approve";
                try {
                  const response = await fetch(`${API_BASE_URL}/api/ecom/returns/${showApprovalModal}/${action}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ comment: approvalComment }),
                  });
                  if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data?.error ?? "Error");
                  }
                  setStatus({ tone: "success", message: `Devolución ${action === "approve" ? "aprobada" : "rechazada"}` });
                  setShowApprovalModal(null);
                  setApprovalComment("");
                  await fetchReturns(filters);
                } catch (error) {
                  setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error" });
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Comentario</label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder="Agregar comentario (opcional)..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowApprovalModal(null);
                    setApprovalComment("");
                  }}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  name="deny"
                  className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                >
                  Rechazar
                </button>
                <button
                  type="submit"
                  name="approve"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Aprobar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Recibir Devolución</h2>
              <button
                type="button"
                onClick={() => {
                  setShowReceiveModal(null);
                  setReceiveData({});
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
                  const response = await fetch(`${API_BASE_URL}/api/ecom/returns/${showReceiveModal}/receive`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      items: Object.entries(receiveData).map(([itemId, data]) => ({
                        itemId: Number.parseInt(itemId, 10),
                        condition: data.condition,
                        restock: data.restock,
                      })),
                    }),
                  });
                  if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data?.error ?? "Error");
                  }
                  setStatus({ tone: "success", message: "Devolución recibida" });
                  setShowReceiveModal(null);
                  setReceiveData({});
                  await fetchReturns(filters);
                } catch (error) {
                  setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error" });
                }
              }}
              className="space-y-4"
            >
              {selectedReturn.items.map((item) => (
                <div key={item.id} className="rounded-md border border-border bg-muted/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Item #{item.orderItemId}</div>
                      {item.sku && <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>}
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <ReturnConditionSelector
                      value={(receiveData[item.id]?.condition || item.condition) as any}
                      onChange={(condition) => {
                        setReceiveData((state) => ({
                          ...state,
                          [item.id]: { ...state[item.id], condition },
                        }));
                      }}
                    />
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Restock</label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={receiveData[item.id]?.restock ?? item.restock}
                          onChange={(e) => {
                            setReceiveData((state) => ({
                              ...state,
                              [item.id]: { ...state[item.id], restock: e.target.checked },
                            }));
                          }}
                          className="rounded border border-input"
                        />
                        <span className="text-sm">Restockear este artículo</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReceiveModal(null);
                    setReceiveData({});
                  }}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Recibir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Procesar Reembolso</h2>
              <button
                type="button"
                onClick={() => {
                  setShowRefundModal(null);
                  setRefundData({ amount: "", method: "original" });
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
                  const response = await fetch(`${API_BASE_URL}/api/ecom/returns/${showRefundModal}/refund`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      refundCents: refundData.amount ? Math.round(Number.parseFloat(refundData.amount) * 100) : null,
                      refundMethod: refundData.method,
                    }),
                  });
                  if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data?.error ?? "Error");
                  }
                  setStatus({ tone: "success", message: "Reembolso procesado" });
                  setShowRefundModal(null);
                  setRefundData({ amount: "", method: "original" });
                  await fetchReturns(filters);
                } catch (error) {
                  setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error" });
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Monto (RD$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={refundData.amount}
                  onChange={(e) => setRefundData((state) => ({ ...state, amount: e.target.value }))}
                  placeholder="Dejar vacío para reembolso completo"
                />
                <p className="text-xs text-muted-foreground">Dejar vacío para reembolso completo</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Método</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={refundData.method}
                  onChange={(e) => setRefundData((state) => ({ ...state, method: e.target.value }))}
                >
                  <option value="original">Método Original</option>
                  <option value="store_credit">Crédito de Tienda</option>
                  <option value="cash">Efectivo</option>
                  <option value="check">Cheque</option>
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRefundModal(null);
                    setRefundData({ amount: "", method: "original" });
                  }}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Procesar Reembolso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

type OrdersResponseWithChannels = {
  metadata?: { channels?: { id: number; name: string; provider: string; status: string }[] };
};
