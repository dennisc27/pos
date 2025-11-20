"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { AlertTriangle, ClipboardCheck, Loader2, PackageSearch, PanelTop, RefreshCcw } from "lucide-react";

import { formatDateTimeForDisplay } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type CountSession = {
  id: number;
  name: string;
  branchId: number | null;
  branchName: string | null;
  status: string;
  movementAfterSnapshot?: boolean;
  lastMovementAt?: string | null;
};

type CountItem = {
  productCodeVersionId: number;
  productCodeId: number;
  code: string;
  name: string;
  sku: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  availableQty: number;
  binLocation: string | null;
  reorderPoint: number;
  reorderQty: number;
};

type RecentEntry = {
  productCodeVersionId: number;
  productCodeId: number;
  code: string;
  name: string;
  sku: string | null;
  expectedQty: number;
  countedQty: number;
  variance: number;
  lastCapturedAt: string | null;
};

function StatusBadge({ status }: { status: string }) {
  const tone = useMemo(() => {
    if (["open"].includes(status)) return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100";
    if (["review"].includes(status)) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100";
    if (["posted"].includes(status)) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100";
    if (["cancelled"].includes(status)) return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-100";
    return "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200";
  }, [status]);

  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{status}</span>;
}

export default function InventoryCountPage() {
  const [sessionId, setSessionId] = useState("" as string);
  const [session, setSession] = useState<CountSession | null>(null);
  const [items, setItems] = useState<CountItem[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ productCodeVersionId: "", countedQty: "1", mode: "add", comment: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSessionDetail = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory/count-sessions/${id}`);
      const payload = (await response.json().catch(() => ({}))) as { session?: CountSession; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Sesión no encontrada");
      }
      setSession(payload.session ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la sesión");
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory/count/${sessionId}/items?q=${encodeURIComponent(search)}`);
      const payload = (await response.json().catch(() => ({}))) as { items?: CountItem[]; session?: CountSession; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo cargar el inventario");
      }
      setItems(payload.items ?? []);
      if (payload.session) setSession(payload.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el inventario");
    } finally {
      setLoading(false);
    }
  }, [search, sessionId]);

  const loadRecent = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory/count/${sessionId}/recent`);
      const payload = (await response.json().catch(() => ({}))) as { recent?: RecentEntry[]; session?: CountSession };
      setRecent(payload.recent ?? []);
      if (payload.session) setSession(payload.session);
    } catch (err) {
      // ignore
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      void loadSessionDetail(sessionId);
      void loadRecent();
    }
  }, [loadRecent, loadSessionDetail, sessionId]);

  const handleCount = async (event: FormEvent) => {
    event.preventDefault();
    if (!sessionId) return;
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory/count-lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: Number(sessionId),
          productCodeVersionId: Number(form.productCodeVersionId),
          countedQty: Number(form.countedQty || "0"),
          mode: form.mode,
          comment: form.comment.trim() || undefined,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { session?: CountSession; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo registrar la lectura");
      }

      setSession(payload.session ?? session);
      setMessage("Lectura guardada");
      setForm((prev) => ({ ...prev, countedQty: "1", comment: "" }));
      void loadRecent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la lectura");
    }
  };

  const selectItem = (item: CountItem) => {
    setForm((prev) => ({ ...prev, productCodeVersionId: String(item.productCodeVersionId) }));
  };

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <ClipboardCheck className="h-4 w-4" />
          <span>Conteo en piso</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Captura de conteo</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Escanea o busca productos, registra cantidades y revisa los últimos ítems capturados.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr,1fr] xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Sesión</div>
            {session && <StatusBadge status={session.status} />}
          </div>
          <div className="grid grid-cols-[1fr,auto] gap-3">
            <input
              placeholder="ID de sesión"
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <button
              type="button"
              onClick={() => void loadSessionDetail(sessionId)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCcw className="h-4 w-4" /> Cargar
            </button>
          </div>
          {session && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
              <div className="font-semibold">{session.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {session.branchName ?? (session.branchId ? `Sucursal #${session.branchId}` : "—")}
              </div>
              {session.movementAfterSnapshot && (
                <div className="mt-2 inline-flex items-center gap-2 rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-100">
                  <AlertTriangle className="h-4 w-4" /> Movimientos detectados después del corte {formatDateTimeForDisplay(session.lastMovementAt)}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleCount} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <PanelTop className="h-4 w-4" /> Registrar lectura
            </div>
            <label className="space-y-2 text-sm">
              <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Producto / versión</span>
              <input
                required
                type="number"
                value={form.productCodeVersionId}
                onChange={(event) => setForm((prev) => ({ ...prev, productCodeVersionId: event.target.value }))}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Cantidad</span>
                <input
                  type="number"
                  min={0}
                  value={form.countedQty}
                  onChange={(event) => setForm((prev) => ({ ...prev, countedQty: event.target.value }))}
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Modo</span>
                <select
                  value={form.mode}
                  onChange={(event) => setForm((prev) => ({ ...prev, mode: event.target.value }))}
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="add">Sumar</option>
                  <option value="set">Reemplazar</option>
                </select>
              </label>
            </div>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Comentario</span>
              <input
                value={form.comment}
                onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="Estante superior, caja dañada"
              />
            </label>
            <button
              type="submit"
              disabled={loading || !sessionId}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Registrar"}
            </button>
            {message && <p className="text-sm text-emerald-600 dark:text-emerald-300">{message}</p>}
            {error && <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
          </form>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <PackageSearch className="h-4 w-4" /> Buscar producto
              </div>
              <button
                type="button"
                onClick={() => void loadItems()}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Loader2 className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Actualizar
              </button>
            </div>
            <div className="flex gap-2 px-4 py-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Código, SKU o nombre"
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="button"
                onClick={() => void loadItems()}
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
              >
                Buscar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Disponible</th>
                    <th className="px-4 py-3">Ubicación</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                        Sin resultados. Ingresa un código o nombre.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.productCodeVersionId} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{item.code}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{item.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">SKU: {item.sku ?? "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                          {item.availableQty} uds · {item.qtyOnHand} en stock
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                          {item.binLocation ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          <button
                            type="button"
                            onClick={() => selectItem(item)}
                            className="rounded border border-slate-200 px-3 py-1 font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                          >
                            Usar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
              <PanelTop className="h-4 w-4" /> Últimos escaneos
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Esperado</th>
                    <th className="px-4 py-3">Conteo</th>
                    <th className="px-4 py-3">Varianza</th>
                    <th className="px-4 py-3">Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {recent.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                        Sin lecturas registradas.
                      </td>
                    </tr>
                  ) : (
                    recent.map((entry) => (
                      <tr key={entry.productCodeVersionId} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{entry.code}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{entry.name}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{entry.expectedQty}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{entry.countedQty}</td>
                        <td
                          className={`px-4 py-3 font-semibold ${
                            entry.variance === 0
                              ? "text-slate-500"
                              : entry.variance > 0
                                ? "text-amber-600"
                                : "text-rose-600"
                          }`}
                        >
                          {entry.variance}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                          {formatDateTimeForDisplay(entry.lastCapturedAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
    </div>
  );
}
