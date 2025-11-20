"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { AlertTriangle, CheckSquare, ClipboardList, FileCheck2, Filter, Loader2 } from "lucide-react";

import { formatCurrencyFromCents, formatDateTimeForDisplay } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type ReviewLine = {
  id: number;
  productCodeVersionId: number;
  code: string;
  name: string;
  expectedQty: number;
  countedQty: number;
  variance: number;
  costCents: number;
  differenceValueCents: number;
  comment?: string | null;
};

type ReviewPayload = {
  session?: {
    id: number;
    name?: string;
    branchName?: string | null;
    status: string;
  };
  lines: ReviewLine[];
  totals: { varianceCount: number; totalVariance: number; totalValueCents: number };
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

export default function InventoryReviewPage() {
  const [sessionId, setSessionId] = useState("" as string);
  const [payload, setPayload] = useState<ReviewPayload>({ lines: [], totals: { varianceCount: 0, totalVariance: 0, totalValueCents: 0 } });
  const [minVariance, setMinVariance] = useState("0");
  const [direction, setDirection] = useState("all");
  const [reviewerId, setReviewerId] = useState("1");
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLines = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ minAbsVariance: minVariance || "0", direction }).toString();
      const response = await fetch(`${API_BASE_URL}/api/inventory/ops/review/${sessionId}?${query}`);
      const data = (await response.json().catch(() => ({}))) as ReviewPayload & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "No se pudieron cargar las diferencias");
      }
      setPayload({
        session: data.session,
        lines: data.lines ?? [],
        totals: data.totals ?? { varianceCount: 0, totalVariance: 0, totalValueCents: 0 },
      });
      setSelected([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las diferencias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const toggleSelected = (lineId: number) => {
    setSelected((prev) => (prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId]));
  };

  const requestRecount = async (lineId: number) => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory/ops/review/${sessionId}/recount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineId }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo marcar para recuento");
      }
      setMessage("Recuento solicitado");
      await loadLines();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo marcar para recuento");
    }
  };

  const approveSelection = async (event: FormEvent) => {
    event.preventDefault();
    if (!sessionId) return;
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory/ops/review/${sessionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerId: Number(reviewerId), lineIds: selected }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "No se pudieron aprobar los ajustes");
      }
      setMessage("Ajustes contabilizados");
      await loadLines();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron aprobar los ajustes");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <ClipboardList className="h-4 w-4" />
          <span>Revisión de discrepancias</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ajustes de conteo</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Filtra variaciones, solicita recuentos y aprueba ajustes al stock.</p>
      </header>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-[2fr,1fr,1fr,auto] gap-3">
          <input
            placeholder="ID de sesión"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          <input
            type="number"
            min={0}
            value={minVariance}
            onChange={(event) => setMinVariance(event.target.value)}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            placeholder="Varianza mínima"
          />
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="all">Todas</option>
            <option value="positive">Solo sobrantes</option>
            <option value="negative">Solo faltantes</option>
          </select>
          <button
            type="button"
            onClick={() => void loadLines()}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Filter className="h-4 w-4" /> Filtrar
          </button>
        </div>

        {payload.session && (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            <div>
              <div className="font-semibold">{payload.session.name ?? `Sesión #${payload.session.id}`}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{payload.session.branchName ?? "Sin sucursal"}</div>
            </div>
            <StatusBadge status={payload.session.status} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700 dark:text-slate-300">
          <span>Variaciones: {payload.totals.varianceCount}</span>
          <span>Unidades: {payload.totals.totalVariance}</span>
          <span>Valor: {formatCurrencyFromCents(payload.totals.totalValueCents)}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Esperado</th>
                <th className="px-4 py-3">Conteo</th>
                <th className="px-4 py-3">Varianza</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Comentario</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {payload.lines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    Sin discrepancias filtradas.
                  </td>
                </tr>
              ) : (
                payload.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(line.id)}
                        onChange={() => toggleSelected(line.id)}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{line.code}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{line.name}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{line.expectedQty}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{line.countedQty}</td>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        line.variance === 0 ? "text-slate-500" : line.variance > 0 ? "text-amber-600" : "text-rose-600"
                      }`}
                    >
                      {line.variance}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {formatCurrencyFromCents(line.differenceValueCents)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{line.comment ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-xs">
                      <button
                        type="button"
                        onClick={() => void requestRecount(line.id)}
                        className="rounded border border-slate-200 px-3 py-1 font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                      >
                        Recontar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={approveSelection} className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-700 dark:text-slate-200">
            Revisor
            <input
              required
              type="number"
              value={reviewerId}
              onChange={(event) => setReviewerId(event.target.value)}
              className="ml-2 w-24 rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <button
            type="submit"
            disabled={loading || selected.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            <FileCheck2 className="h-4 w-4" /> Aprobar ajustes ({selected.length})
          </button>
          {message && (
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">{message}</span>
          )}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </form>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
    </div>
  );
}
