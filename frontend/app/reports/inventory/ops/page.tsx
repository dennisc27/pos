"use client";

import { FormEvent, useEffect, useState } from "react";

import { AlertTriangle, BarChart3, Boxes, Clock3, Loader2, PackageSearch } from "lucide-react";

import { formatCurrencyFromCents, formatDateForDisplay, formatDateTimeForDisplay, todayIsoDate } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type Movement = {
  id: number;
  reason: string;
  qtyChange: number;
  createdAt: string | null;
  code: string;
  name: string;
  branchName: string | null;
};

type CountRow = {
  id: number;
  name: string;
  status: string;
  scope: string;
  branchName: string | null;
  variance: number;
  createdAt: string | null;
};

type AgedItem = {
  productCodeVersionId: number;
  code: string;
  name: string;
  qtyOnHand: number;
  branchName: string | null;
  lastMovementAt: string | null;
};

type LowStock = {
  productCodeVersionId: number;
  code: string;
  name: string;
  branchName: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  reorderPoint: number;
  reorderQty: number;
};

type OpsReport = {
  filters: { branchId: number | null; startDate: string; endDate: string; staleDays: number };
  valuation: { totalCents: number; byBranch: { branchId: number | null; branchName: string | null; valueCents: number }[] };
  movements: Movement[];
  counts: CountRow[];
  aged: { thresholdDate: string; items: AgedItem[] };
  lowStock: LowStock[];
};

export default function InventoryOpsReportPage() {
  const [report, setReport] = useState<OpsReport | null>(null);
  const [branchId, setBranchId] = useState("");
  const [startDate, setStartDate] = useState(todayIsoDate());
  const [endDate, setEndDate] = useState(todayIsoDate());
  const [staleDays, setStaleDays] = useState("30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        staleDays,
      });
      if (branchId) params.append("branchId", branchId);

      const response = await fetch(`${API_BASE_URL}/api/reports/inventory/ops?${params.toString()}`);
      const payload = (await response.json().catch(() => ({}))) as OpsReport & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo cargar el reporte");
      }
      setReport(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el reporte");
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void loadReport();
  };

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <BarChart3 className="h-4 w-4" />
          <span>Reporte OPS inventario</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Salud operacional de inventario</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Valoración, movimientos, conteos y alertas de stock bajo.</p>
      </header>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Sucursal</span>
          <input
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            placeholder="Todas"
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Desde</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Hasta</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Días sin movimiento</span>
          <input
            type="number"
            min={1}
            value={staleDays}
            onChange={(event) => setStaleDays(event.target.value)}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <button
          type="submit"
          className="col-span-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 md:col-span-1"
          disabled={loading}
        >
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </form>

      {report && (
        <div className="space-y-6">
          <section className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Valor total</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {formatCurrencyFromCents(report.valuation.totalCents)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sumatoria de stock a costo</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Sucursales</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                {report.valuation.byBranch.map((row) => (
                  <li key={`${row.branchId ?? "all"}`} className="flex justify-between">
                    <span>{row.branchName ?? "Todas"}</span>
                    <span className="font-semibold">{formatCurrencyFromCents(row.valueCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Alertas</div>
              <p className="text-sm text-slate-700 dark:text-slate-200">{report.lowStock.length} productos en bajo stock.</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{report.aged.items.length} sin movimiento desde {formatDateForDisplay(report.aged.thresholdDate)}</p>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
                <div className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> Movimientos</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3">Razón</th>
                      <th className="px-4 py-3">Cantidad</th>
                      <th className="px-4 py-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {report.movements.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                          Sin movimientos.
                        </td>
                      </tr>
                    ) : (
                      report.movements.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{row.code}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{row.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{row.branchName ?? "—"}</div>
                          </td>
                          <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-200">{row.reason.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{row.qtyChange}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{formatDateTimeForDisplay(row.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
                <Boxes className="h-4 w-4" /> Sesiones de conteo
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Sesión</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Varianza</th>
                      <th className="px-4 py-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {report.counts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                          Sin conteos recientes.
                        </td>
                      </tr>
                    ) : (
                      report.counts.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">#{row.id} · {row.scope}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{row.status}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{row.variance}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{formatDateTimeForDisplay(row.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
                <Clock3 className="h-4 w-4" /> Inventario envejecido
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Último mov.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {report.aged.items.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                          Sin productos envejecidos.
                        </td>
                      </tr>
                    ) : (
                      report.aged.items.map((item) => (
                        <tr key={item.productCodeVersionId} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{item.code}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{item.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{item.branchName ?? "—"}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.qtyOnHand}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{formatDateTimeForDisplay(item.lastMovementAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
                <PackageSearch className="h-4 w-4" /> Bajo stock
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3">Disponible</th>
                      <th className="px-4 py-3">Punto pedido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {report.lowStock.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                          Sin alertas de stock bajo.
                        </td>
                      </tr>
                    ) : (
                      report.lowStock.map((item) => (
                        <tr key={item.productCodeVersionId} className="hover:bg-amber-50 dark:hover:bg-slate-800/60">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{item.code}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{item.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{item.branchName ?? "—"}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                            {item.qtyOnHand - item.qtyReserved} ({item.qtyOnHand} en stock)
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.reorderPoint} (sugerido: {item.reorderQty})</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
    </div>
  );
}
