"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  PackageCheck,
  RefreshCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

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
  approved: "bg-sky-500/10 text-sky-300 border border-sky-500/40",
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
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-300">
        <ArrowRightLeft className="h-3 w-3" /> No restock
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sky-400">
          <ArrowRightLeft className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Devoluciones</span>
        </div>
        <h1 className="text-3xl font-semibold text-white">E-Commerce · RMA y reembolsos</h1>
        <p className="max-w-3xl text-sm text-slate-400">
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

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300" htmlFor="filter-status">
                Estado
              </label>
              <select
                id="filter-status"
                className="w-40 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
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
              <label className="text-xs font-medium text-slate-300" htmlFor="filter-channel">
                Canal
              </label>
              <select
                id="filter-channel"
                className="w-48 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
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
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            onClick={() => fetchReturns(filters)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Actualizar
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-md border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-950/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">RMA</th>
                <th className="px-3 py-2">Orden</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Artículos</th>
                <th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-sm text-slate-200">
              {returns.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No se encontraron devoluciones.
                  </td>
                </tr>
              )}

              {returns.map((record) => (
                <tr key={record.id}>
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-white">#{record.id}</div>
                    <div className="text-xs text-slate-400">{record.channelName ?? `Canal #${record.channelId}`}</div>
                    <div className="text-xs text-slate-500">{record.createdAt ? new Date(record.createdAt).toLocaleString() : ""}</div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-white">{record.externalOrderId ?? record.orderId}</div>
                  </td>
                  <td className="px-3 py-3 align-top">{statusBadge(record.status)}</td>
                  <td className="px-3 py-3 align-top">
                    <ul className="space-y-1 text-xs text-slate-400">
                      {record.items.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3">
                          <span>Item #{item.orderItemId}</span>
                          {restockBadge(item)}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <span className="text-xs text-slate-400">{record.reason ?? "—"}</span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap justify-end gap-2">
                      {actionOrder.map((action) => {
                        const meta = actionLabels[action];
                        const Icon = meta.icon;
                        return (
                          <button
                            key={action}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => runReturnAction(record, action)}
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
    </div>
  );
}

type OrdersResponseWithChannels = {
  metadata?: { channels?: { id: number; name: string; provider: string; status: string }[] };
};
