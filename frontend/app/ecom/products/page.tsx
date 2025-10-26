"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Loader2,
  PackageSearch,
  RefreshCcw,
  ShieldCheck,
  Store,
  Tags,
} from "lucide-react";

import { formatCurrencyFromCents } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  inactive: "Inactivo",
};

const statusTone: Record<string, string> = {
  draft: "bg-amber-500/10 text-amber-300 border border-amber-500/40",
  active: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/40",
  inactive: "bg-slate-500/10 text-slate-300 border border-slate-500/40",
};

type StatusMessage = { tone: "success" | "error"; message: string } | null;

type ListingChannel = {
  channelId: number;
  channelName: string | null;
  provider: string | null;
  status: string;
  lastSyncedAt: string | null;
};

type Listing = {
  id: number;
  productCodeId: number | null;
  code: string | null;
  name: string | null;
  title: string;
  description: string | null;
  priceCents: number | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  channels: ListingChannel[];
};

type ListingsResponse = {
  listings: Listing[];
  pagination: { page: number; pageSize: number; hasMore: boolean; nextPage: number | null };
  summary: { total: number; byStatus: Record<string, number> };
  metadata: {
    channels: { id: number; name: string; provider: string; status: string }[];
  };
  filtersApplied: { search: string; status: string; channelId: number | null };
  warnings?: Record<string, unknown>;
};

const statusFilterOptions = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Borrador" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
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

export default function EcommerceListingsPage() {
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [listings, setListings] = useState<Listing[]>([]);
  const [summary, setSummary] = useState<{ total: number; byStatus: Record<string, number> }>({
    total: 0,
    byStatus: {},
  });
  const [channels, setChannels] = useState<{ id: number; name: string; provider: string; status: string }[]>([]);
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; hasMore: boolean; nextPage: number | null }>(
    { page: 1, pageSize: 25, hasMore: false, nextPage: null }
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkChannelId, setBulkChannelId] = useState<number | "">("");
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: "", price: "", status: "draft", description: "" });

  const focusedListing = useMemo(
    () => listings.find((listing) => listing.id === focusedId) ?? null,
    [listings, focusedId]
  );

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

  const fetchListings = useCallback(
    async (state: FiltersState) => {
      setLoading(true);
      setStatus(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/ecom/listings?${buildQueryString(state)}`);
        const data = (await response.json()) as ListingsResponse;
        if (!response.ok) {
          throw new Error((data as { error?: string })?.error ?? "No se pudieron obtener los listados");
        }

        setListings(data.listings ?? []);
        setSummary(data.summary ?? { total: 0, byStatus: {} });
        setChannels(data.metadata?.channels ?? []);
        setPagination(data.pagination ?? { page: 1, pageSize: 25, hasMore: false, nextPage: null });
        setSelectedIds(new Set());
      } catch (error) {
        setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al cargar inventario" });
        setListings([]);
      } finally {
        setLoading(false);
      }
    },
    [buildQueryString]
  );

  useEffect(() => {
    fetchListings(filters).catch(() => {
      /* handled */
    });
  }, [fetchListings, filters]);

  useEffect(() => {
    if (focusedListing) {
      setEditForm({
        title: focusedListing.title,
        price: focusedListing.priceCents != null ? (focusedListing.priceCents / 100).toString() : "",
        status: focusedListing.status,
        description: focusedListing.description ?? "",
      });
    }
  }, [focusedListing]);

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const resetFocus = () => {
    setFocusedId(null);
    setEditForm({ title: "", price: "", status: "draft", description: "" });
  };

  const submitBulkAction = async (action: "publish" | "unpublish" | "sync") => {
    const ids = Array.from(selectedIds.values());
    if (ids.length === 0) {
      setStatus({ tone: "error", message: "Selecciona al menos un listado" });
      return;
    }

    if (action === "sync" && (bulkChannelId === "" || bulkChannelId == null)) {
      setStatus({ tone: "error", message: "Selecciona el canal destino para la sincronización" });
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const payload: Record<string, unknown> = { action, listingIds: ids };
      if (action === "sync") {
        payload.channelIds = [Number(bulkChannelId)];
      }
      const response = await fetch(`${API_BASE_URL}/api/ecom/listings/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo completar la acción");
      }

      setStatus({ tone: "success", message: "Acción ejecutada correctamente" });
      await fetchListings(filters);
      resetFocus();
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al ejecutar la acción" });
    } finally {
      setLoading(false);
    }
  };

  const submitEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!focusedListing) {
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const payload: Record<string, unknown> = {
        action: "update",
        listingIds: [focusedListing.id],
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        status: editForm.status,
      };

      if (editForm.price.trim()) {
        const numeric = Number(editForm.price.replace(/,/g, "."));
        if (!Number.isFinite(numeric) || numeric < 0) {
          throw new Error("Precio inválido");
        }
        payload.price = numeric;
      }

      const response = await fetch(`${API_BASE_URL}/api/ecom/listings/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo actualizar el listado");
      }

      setStatus({ tone: "success", message: "Listado actualizado" });
      await fetchListings(filters);
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al actualizar" });
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (statusValue: string) => {
    const tone = statusTone[statusValue] ?? statusTone.draft;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${tone}`}>
        {statusValue === "active" ? <CheckCircle2 className="h-3 w-3" /> : <Tags className="h-3 w-3" />} {statusLabels[statusValue] ?? statusValue}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sky-400">
          <PackageSearch className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Catálogo online</span>
        </div>
        <h1 className="text-3xl font-semibold text-white">E-Commerce · Listados publicados</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Gestiona precios, estado y sincronización de cada listado asociado a tus marketplaces. Las acciones se registran en el
          backend para mantener auditoría completa.
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
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total listados</p>
          <p className="mt-2 text-2xl font-semibold text-white">{summary.total}</p>
        </div>
        {Object.entries(summary.byStatus ?? {}).map(([key, count]) => (
          <div key={key} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">{statusLabels[key] ?? key}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{count}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-slate-950/40">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300" htmlFor="filter-search">
                Buscar
              </label>
              <input
                id="filter-search"
                className="w-60 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                placeholder="Título o SKU"
                value={filters.search}
                onChange={(event) => setFilters((state) => ({ ...state, search: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300" htmlFor="filter-status">
                Estado
              </label>
              <select
                id="filter-status"
                className="w-36 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
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
            onClick={() => fetchListings(filters)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Actualizar
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-md border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-950/60">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                    checked={selectedIds.size > 0 && selectedIds.size === listings.length}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedIds(new Set(listings.map((listing) => listing.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </th>
                <th className="px-3 py-2">Listado</th>
                <th className="px-3 py-2">Precio</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Canales</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40 text-sm text-slate-200">
              {listings.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No se encontraron listados con los filtros aplicados.
                  </td>
                </tr>
              )}
              {listings.map((listing) => (
                <tr key={listing.id} className={focusedId === listing.id ? "bg-sky-500/10" : undefined}>
                  <td className="px-3 py-3 align-top">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                      checked={selectedIds.has(listing.id)}
                      onChange={() => toggleSelection(listing.id)}
                    />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-white">{listing.title}</div>
                    <div className="text-xs text-slate-400">
                      {listing.code ? `${listing.code} · ${listing.name ?? ""}` : listing.name ?? "Sin SKU"}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    {listing.priceCents != null ? formatCurrencyFromCents(listing.priceCents) : "—"}
                  </td>
                  <td className="px-3 py-3 align-top">{statusBadge(listing.status)}</td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      {listing.channels.length === 0 && <span className="text-xs text-slate-500">Sin publicar</span>}
                      {listing.channels.map((channel) => (
                        <span
                          key={`${listing.id}-${channel.channelId}`}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-300"
                        >
                          <Store className="h-3 w-3" /> {channel.channelName ?? `#${channel.channelId}`}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right align-top">
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
                      onClick={() => setFocusedId(listing.id)}
                    >
                      <Edit3 className="h-3 w-3" /> Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4 text-xs text-slate-400">
          <div>
            Página {pagination.page} · {listings.length} elementos
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2">
              <select
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
                value={bulkChannelId}
                onChange={(event) => setBulkChannelId(event.target.value === "" ? "" : Number(event.target.value))}
              >
                <option value="">Canal para sincronizar…</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name} ({channel.provider})
                  </option>
                ))}
              </select>
              <button
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                onClick={() => submitBulkAction("publish")}
                disabled={loading}
              >
                Publicar
              </button>
              <button
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                onClick={() => submitBulkAction("unpublish")}
                disabled={loading}
              >
                Despublicar
              </button>
              <button
                className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => submitBulkAction("sync")}
                disabled={loading}
              >
                Sincronizar
              </button>
            </div>
          </div>
        </div>
      </section>

      {focusedListing && (
        <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Edición rápida</h2>
              <p className="text-xs text-slate-400">Actualiza título, precio o estado y vuelve a sincronizar cuando sea necesario.</p>
            </div>
            <button
              className="text-xs text-slate-400 hover:text-slate-200"
              onClick={() => resetFocus()}
            >
              Cerrar
            </button>
          </div>

          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={submitEdit}>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-slate-300" htmlFor="edit-title">
                Título
              </label>
              <input
                id="edit-title"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                value={editForm.title}
                onChange={(event) => setEditForm((state) => ({ ...state, title: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300" htmlFor="edit-price">
                Precio (RD$)
              </label>
              <input
                id="edit-price"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                value={editForm.price}
                onChange={(event) => setEditForm((state) => ({ ...state, price: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300" htmlFor="edit-status">
                Estado
              </label>
              <select
                id="edit-status"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                value={editForm.status}
                onChange={(event) => setEditForm((state) => ({ ...state, status: event.target.value }))}
              >
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-medium text-slate-300" htmlFor="edit-description">
                Descripción
              </label>
              <textarea
                id="edit-description"
                className="min-h-[120px] w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                value={editForm.description}
                onChange={(event) => setEditForm((state) => ({ ...state, description: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                onClick={() => resetFocus()}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-400"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />} Guardar cambios
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
