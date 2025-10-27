"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Package,
  RefreshCcw,
  ShieldCheck,
  Truck,
  Undo2,
} from "lucide-react";

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
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string | null;
  updatedAt: string | null;
  shippingAddress: unknown;
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
          <button
            className="inline-flex items-center gap-2 rounded-md border border-input dark:border-slate-700 px-3 py-2 text-sm text-foreground dark:text-slate-200 hover:bg-muted/80 dark:hover:bg-slate-800"
            onClick={() => fetchOrders(filters)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Actualizar
          </button>
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
                      {actionOrder.map((action) => {
                        const meta = actionLabels[action];
                        const Icon = meta.icon;
                        const disabled = loading;
                        return (
                          <button
                            key={action}
                            className="inline-flex items-center gap-1 rounded-md border border-input dark:border-slate-700 px-2.5 py-1 text-xs text-foreground dark:text-slate-200 hover:bg-muted/80 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => runOrderAction(order, action)}
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

      <section className="rounded-lg border border-border dark:border-slate-800 bg-card dark:bg-slate-900/70 p-5">
        <h2 className="text-lg font-semibold text-foreground dark:text-white">Importar órdenes desde marketplace</h2>
        <p className="text-xs text-muted-foreground dark:text-slate-400">
          Pega el payload recibido del marketplace (array JSON) y asigna el canal correspondiente. El backend deduplica por
          externalId.
        </p>

        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={submitImport}>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground dark:text-slate-300" htmlFor="import-channel">
              Canal destino
            </label>
            <select
              id="import-channel"
              className="w-full rounded-md border border-input dark:border-slate-700 bg-background dark:bg-slate-950 px-3 py-2 text-sm text-foreground dark:text-white focus:border-sky-500 focus:outline-none"
              value={importForm.channelId}
              onChange={(event) => setImportForm((state) => ({ ...state, channelId: event.target.value }))}
              required
            >
              <option value="">Selecciona…</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name} ({channel.provider})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground dark:text-slate-300" htmlFor="import-json">
              Payload JSON
            </label>
            <textarea
              id="import-json"
              className="min-h-[180px] w-full rounded-md border border-input dark:border-slate-700 bg-background dark:bg-slate-950 px-3 py-2 text-sm text-foreground dark:text-slate-100 focus:border-sky-500 focus:outline-none"
              placeholder='[{ "externalId": "1001", "customerName": "Cliente", "total": 1500, "items": [...] }]'
              value={importForm.payload}
              onChange={(event) => setImportForm((state) => ({ ...state, payload: event.target.value }))}
              required
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground dark:text-white hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />} Importar órdenes
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
