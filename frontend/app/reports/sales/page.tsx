"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ArrowLeft, Calendar, Loader2, RefreshCw, X } from "lucide-react";

import { useActiveBranch } from "@/components/providers/active-branch-provider";
import { formatCurrencyFromCents } from "@/lib/utils";
import { ReportPageShell } from "../components/report-shell";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

// Formato dd/MM/yyyy
function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" });

function formatDateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return dateTimeFormatter.format(parsed);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type PaymentMethodBreakdown = {
  method: string;
  totalCents: number;
  count: number;
  percentage: number;
};

type SalesTableRow = {
  id: number;
  invoiceNo: string | null;
  createdAt: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  returnCents: number;
  paymentMethods: Array<{ method: string; amountCents: number }>;
};

type SalesReportResponse = {
  generatedAt: string;
  filters: {
    startDate: string | null;
    endDate: string | null;
    branchId: number | null;
  };
  summary: {
    totalSoldCents: number;
    totalReturnsCents: number;
    netSalesCents: number;
    totalInvoices: number;
    totalReturns: number;
  };
  paymentMethodBreakdown: PaymentMethodBreakdown[];
  sales: SalesTableRow[];
};

export default function ReportsSalesPage() {
  const { branch: activeBranch, loading: branchLoading, error: branchError } = useActiveBranch();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<SalesReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());

  const branchUnavailable = branchLoading || !activeBranch || Boolean(branchError);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!activeBranch) {
        throw new Error(
          branchError ?? "Configura una sucursal activa en ajustes antes de consultar el reporte de ventas."
        );
      }

      const params = new URLSearchParams();
      params.set("branchId", String(activeBranch.id));
      params.set("startDate", startDate);
      params.set("endDate", endDate);

      const url = `${API_BASE_URL}/api/reports/sales?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No se pudo cargar el reporte de ventas");
      }

      const payload: SalesReportResponse = await response.json();
      setReport(payload);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "No se pudo cargar el reporte");
    } finally {
      setLoading(false);
    }
  }, [activeBranch, branchError, startDate, endDate]);

  useEffect(() => {
    if (branchUnavailable) {
      return;
    }

    loadReport();
  }, [branchUnavailable, loadReport]);

  const handleOpenDateDialog = useCallback(() => {
    setIsDateDialogOpen(true);
  }, []);

  const handleCloseDateDialog = useCallback(() => {
    setIsDateDialogOpen(false);
  }, []);

  const handleApplyDateRange = useCallback(() => {
    if (startDate && endDate && startDate > endDate) {
      setError("La fecha de inicio no puede ser posterior a la fecha de fin");
      return;
    }
    setIsDateDialogOpen(false);
    if (branchUnavailable) {
      return;
    }
    loadReport();
  }, [startDate, endDate, branchUnavailable, loadReport]);

  const paymentMethodLabels: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
    gift_card: "Tarjeta de regalo",
    credit_note: "Nota de crédito",
  };

  return (
    <ReportPageShell
      title="Sales"
      description="Review daily revenue, discounts, and tender mix across all sales channels."
    >
      <div className="space-y-8">
        {/* Date Range Dialog */}
        {isDateDialogOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
            onClick={handleCloseDateDialog}
          >
            <div
              className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Rango de fechas</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Selecciona el período para el reporte de ventas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseDateDialog}
                  className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <label htmlFor="startDate" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Fecha de inicio
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="endDate" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Fecha de fin
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseDateDialog}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyDateRange}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Actions */}
        <section className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Período</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(report?.filters.startDate ?? startDate)} - {formatDate(report?.filters.endDate ?? endDate)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenDateDialog}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200"
              >
                <Calendar className="h-4 w-4" /> Cambiar período
              </button>
              <button
                type="button"
                onClick={loadReport}
                disabled={branchUnavailable || loading}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-400"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Actualizar
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {loading && (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando reporte de ventas…
          </div>
        )}

        {!loading && report ? (
          <>
            {/* Metrics */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Total vendido
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrencyFromCents(report.summary.totalSoldCents)}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {report.summary.totalInvoices} factura{report.summary.totalInvoices !== 1 ? "s" : ""}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Total devoluciones
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrencyFromCents(report.summary.totalReturnsCents)}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {report.summary.totalReturns} devolución{report.summary.totalReturns !== 1 ? "es" : ""}
                </p>
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm dark:border-indigo-500/70 dark:bg-indigo-950/40">
                <p className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                  Ventas netas
                </p>
                <p className="mt-2 text-2xl font-semibold text-indigo-900 dark:text-indigo-100">
                  {formatCurrencyFromCents(report.summary.netSalesCents)}
                </p>
                <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-300">
                  Después de devoluciones
                </p>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            <section className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Porcentaje por método de pago
              </h2>
              <div className="mt-4 space-y-3">
                {report.paymentMethodBreakdown.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No hay pagos registrados en este período.</p>
                ) : (
                  report.paymentMethodBreakdown.map((item) => (
                    <div key={item.method} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          {paymentMethodLabels[item.method] || item.method}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300">
                          {item.percentage.toFixed(1)}% · {formatCurrencyFromCents(item.totalCents)} ({item.count}{" "}
                          transacciones)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-indigo-500 transition-all"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Sales Table */}
            <section className="rounded-xl border border-slate-200 bg-white/80 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Ventas</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Generado el {formatDateTime(report.generatedAt)}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <tr>
                      <th className="px-6 py-3">Factura</th>
                      <th className="px-6 py-3">Fecha</th>
                      <th className="px-6 py-3 text-right">Subtotal</th>
                      <th className="px-6 py-3 text-right">Impuestos</th>
                      <th className="px-6 py-3 text-right">Total</th>
                      <th className="px-6 py-3 text-right">Devoluciones</th>
                      <th className="px-6 py-3">Métodos de pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {report.sales.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-6 text-center text-xs text-slate-500">
                          No se encontraron ventas en el período seleccionado.
                        </td>
                      </tr>
                    ) : (
                      report.sales.map((sale) => {
                        const totalPaidCents = sale.paymentMethods.reduce((sum, pm) => sum + pm.amountCents, 0);
                        return (
                          <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            <td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-200">
                              {sale.invoiceNo ?? `#${sale.id}`}
                            </td>
                            <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                              {formatDateTime(sale.createdAt)}
                            </td>
                            <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">
                              {formatCurrencyFromCents(sale.subtotalCents)}
                            </td>
                            <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">
                              {formatCurrencyFromCents(sale.taxCents)}
                            </td>
                            <td className="px-6 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                              {formatCurrencyFromCents(sale.totalCents)}
                            </td>
                            <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">
                              {sale.returnCents > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400">
                                  {formatCurrencyFromCents(sale.returnCents)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                              {sale.paymentMethods.length > 0 ? (
                                <div className="space-y-1">
                                  <div className="flex flex-wrap gap-1">
                                    {sale.paymentMethods.map((pm, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200"
                                      >
                                        {paymentMethodLabels[pm.method] || pm.method}: {formatCurrencyFromCents(pm.amountCents)}
                                      </span>
                                    ))}
                                  </div>
                                  {totalPaidCents !== sale.totalCents && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                      Total pagado: {formatCurrencyFromCents(totalPaidCents)} (debe: {formatCurrencyFromCents(sale.totalCents - totalPaidCents)})
                                    </p>
                                  )}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </ReportPageShell>
  );
}

