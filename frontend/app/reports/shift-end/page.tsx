"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  Clock,
  Download,
  FileText,
  Loader2,
  RefreshCw
} from "lucide-react";

import { useActiveBranch } from "@/components/providers/active-branch-provider";
import { formatCurrencyFromCents } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const MOVEMENT_LABELS: Record<string, string> = {
  deposit: "Depósito",
  cash_to_safe: "Envio a bóveda",
  drop: "Declaración",
  paid_in: "Entrada",
  paid_out: "Salida",
  refund: "Reembolso",
  expense: "Gasto",
  income: "Ingreso"
};

const MOVEMENT_DIRECTIONS: Record<string, number> = {
  deposit: 1,
  cash_to_safe: -1,
  drop: -1,
  paid_in: 1,
  paid_out: -1,
  refund: -1,
  expense: -1,
  income: 1
};

const pesoFormatter = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  maximumFractionDigits: 2
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
  timeStyle: "short"
});

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

function formatAmount(cents?: number | null) {
  if (cents == null) {
    return "—";
  }

  return formatCurrencyFromCents(cents);
}

type ShiftInfo = {
  id: number;
  branchId: number | null;
  branchName: string | null;
  openedBy: number | null;
  openedByName: string | null;
  closedBy: number | null;
  closedByName: string | null;
  openedAt: string | null;
  closedAt: string | null;
  openingCashCents: number;
  closingCashCents: number | null;
  expectedCashCents: number;
  overShortCents: number | null;
};

type PaymentEntry = {
  id: number;
  orderId: number | null;
  invoiceId: number | null;
  method: string;
  amountCents: number;
  meta: unknown;
  createdAt: string | null;
};

type MovementEntry = {
  id: number;
  kind: string;
  amountCents: number;
  direction: number;
  reason: string | null;
  createdAt: string | null;
};

type ShiftEndReport = {
  generatedAt: string;
  reportSource: "snapshot" | "live";
  shift: ShiftInfo;
  totals: {
    openingCashCents: number;
    closingCashCents: number | null;
    expectedCashCents: number;
    overShortCents: number | null;
    cashPaymentsCents: number;
    totalPaymentsCents: number;
    netMovementCents: number;
    totalTransactions: number;
    flagged: boolean;
  };
  payments: {
    summary: {
      totalCents: number;
      cashPaymentsCents: number;
      methods: Record<string, { totalCents: number; count: number }>;
    };
    entries: PaymentEntry[];
  };
  cashMovements: {
    summary: {
      netMovementCents: number;
      totalsByKind: Record<string, { totalCents: number; count: number }>;
    };
    entries: MovementEntry[];
  };
  refunds: {
    totalCents: number;
    count: number;
  };
  countedCashCents: number | null;
  snapshot: unknown;
  recentShifts: {
    id: number;
    branchId: number | null;
    branchName: string | null;
    openedAt: string | null;
    closedAt: string | null;
    overShortCents: number | null;
  }[];
};

type ApiReportResponse = ShiftEndReport & { resolvedShiftId: number };

export default function ReportsShiftEndPage() {
  const { branch: activeBranch, loading: branchLoading, error: branchError } = useActiveBranch();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [report, setReport] = useState<ShiftEndReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shiftIdInput, setShiftIdInput] = useState<string>("");

  const branchUnavailable = branchLoading || !activeBranch || Boolean(branchError);

  const loadReport = useCallback(
    async ({ shiftId }: { shiftId?: number | null } = {}) => {
      setLoading(true);
      setError(null);

      try {
        if (!activeBranch) {
          throw new Error(
            branchError ?? "Configura una sucursal activa en ajustes antes de consultar cierres de caja."
          );
        }

        const params = new URLSearchParams();
        if (shiftId != null) {
          params.set("shiftId", String(shiftId));
        }
        params.set("branchId", String(activeBranch.id));

        const url = `${API_BASE_URL}/api/reports/shift-end${params.toString() ? `?${params}` : ""}`;
        const response = await fetch(url);

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? "Unable to load shift report");
        }

        const payload: ApiReportResponse = await response.json();
        if (payload.shift.branchId != null && payload.shift.branchId !== activeBranch.id) {
          throw new Error(
            "El turno pertenece a otra sucursal. Ajusta la sucursal activa para consultar este cierre."
          );
        }

        setReport(payload);
        setShiftIdInput(String(payload.shift.id));
      } catch (err) {
        setReport(null);
        setError(err instanceof Error ? err.message : "Unable to load shift report");
      } finally {
        setLoading(false);
      }
    },
    [activeBranch, branchError]
  );

  useEffect(() => {
    if (branchUnavailable) {
      return;
    }

    loadReport();
  }, [branchUnavailable, loadReport]);

  const paymentBreakdown = useMemo(() => {
    if (!report) {
      return [] as { method: string; totalCents: number; count: number; share: number }[];
    }

    const total = Math.max(0, Number(report.payments.summary.totalCents ?? 0));
    const entries = Object.entries(report.payments.summary.methods ?? {});

    return entries
      .map(([method, value]) => {
        const totalCents = Math.max(0, Number(value?.totalCents ?? 0));
        const count = Math.max(0, Number(value?.count ?? 0));
        const share = total > 0 ? (totalCents / total) * 100 : 0;
        return { method, totalCents, count, share };
      })
      .sort((a, b) => b.totalCents - a.totalCents);
  }, [report]);

  const movementBreakdown = useMemo(() => {
    if (!report) {
      return [] as { kind: string; totalCents: number; count: number; direction: number }[];
    }

    return Object.entries(report.cashMovements.summary.totalsByKind ?? {})
      .map(([kind, entry]) => ({
        kind,
        totalCents: Math.max(0, Number(entry.totalCents ?? 0)),
        count: Math.max(0, Number(entry.count ?? 0)),
        direction: MOVEMENT_DIRECTIONS[kind] ?? 0
      }))
      .sort((a, b) => b.totalCents - a.totalCents);
  }, [report]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const numericShift = Number(shiftIdInput.trim());
      if (shiftIdInput.trim() && (!Number.isInteger(numericShift) || numericShift <= 0)) {
        setError("Ingresa un ID de turno válido");
        return;
      }

      if (branchUnavailable) {
        setError(branchError ?? "Configura una sucursal activa en ajustes para consultar cierres.");
        return;
      }

      loadReport({
        shiftId: shiftIdInput.trim() ? numericShift : null
      });
    },
    [branchError, branchUnavailable, loadReport, shiftIdInput]
  );

  const handleLoadLatest = useCallback(() => {
    if (branchUnavailable) {
      setError(branchError ?? "Configura una sucursal activa en ajustes para consultar cierres.");
      return;
    }

    loadReport();
  }, [branchError, branchUnavailable, loadReport]);

  const handleExport = useCallback(async () => {
    if (!report) {
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/reports/shift-end/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId: report.shift.id })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No se pudo exportar el reporte");
      }

      const payload = await response.json();
      if (!payload?.data) {
        throw new Error("La respuesta del servidor no incluye el PDF");
      }

      const binary = atob(payload.data as string);
      const buffer = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        buffer[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([buffer], {
        type: payload.contentType ?? "application/pdf"
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = (payload.filename as string) ?? `shift-${report.shift.id}-end-report.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo exportar el reporte");
    } finally {
      setExporting(false);
    }
  }, [report]);

  const selectedVariance = report?.totals.overShortCents ?? 0;
  const varianceFormatted = formatAmount(selectedVariance);
  const varianceAbsolute = Math.abs(selectedVariance);
  const varianceThreshold = 5000; // RD$50 in cents

  return (
    <main className="space-y-8 px-6 py-10 lg:px-10">
      <div>
        <Link
          href="/reports/all"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a todos los reportes
        </Link>
      </div>

      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">Reportes</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Reporte de cierre de turno
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Analiza discrepancias entre el efectivo contado y el esperado. Exporta el resumen en PDF y consulta
          cierres recientes para auditar variaciones.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="shiftId" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              ID de turno
            </label>
            <input
              id="shiftId"
              value={shiftIdInput}
              onChange={(event) => setShiftIdInput(event.target.value)}
              placeholder="Ej. 128"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Sucursal activa</span>
            {branchLoading ? (
              <span className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" /> Sincronizando…
              </span>
            ) : branchError ? (
              <span className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500 dark:bg-rose-500/10 dark:text-rose-200">
                <AlertTriangle className="h-4 w-4" /> {branchError}
              </span>
            ) : activeBranch ? (
              <span className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 dark:border-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-200">
                {activeBranch.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500 dark:bg-amber-500/10 dark:text-amber-200">
                Configura una sucursal activa en ajustes.
              </span>
            )}
          </div>
          <div className="flex items-end gap-3">
            <button
              type="submit"
              disabled={branchUnavailable || loading}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-400"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />} Consultar
            </button>
            <button
              type="button"
              onClick={handleLoadLatest}
              disabled={branchUnavailable || loading}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Último cierre
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando datos del turno…
        </div>
      )}

      {!loading && !report ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          Selecciona un turno para ver el resumen del cierre de caja.
        </div>
      ) : null}

      {!loading && report ? (
        <section className="space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Turno #{report.shift.id}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {report.shift.branchName ?? `Sucursal ${report.shift.branchId ?? "N/D"}`} · Cerrado el {formatDateTime(report.shift.closedAt)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Origen del reporte: {report.reportSource === "snapshot" ? "Cierre registrado" : "Re cálculo en vivo"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => loadReport({ shiftId: report.shift.id })}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exportar PDF
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Efectivo inicial" value={report.totals.openingCashCents} subtitle="Declarado al abrir" />
            <SummaryCard
              title="Pagos en efectivo"
              value={report.totals.cashPaymentsCents}
              subtitle={`${report.payments.summary.methods.cash?.count ?? 0} transacciones`}
            />
            <SummaryCard
              title="Movimientos netos"
              value={report.cashMovements.summary.netMovementCents}
              subtitle="Depósitos, drops, gastos"
            />
            <SummaryCard
              title="Efectivo esperado"
              value={report.totals.expectedCashCents}
              subtitle="Cálculo automático"
            />
          </div>

          <section className="grid gap-6 lg:grid-cols-[2fr_3fr]">
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Discrepancia</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Diferencia entre el efectivo contado y lo esperado.
                  </p>
                </div>
                {report.totals.flagged ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
                ) : null}
              </div>
              <dl className="grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <dt>Contado por el cajero</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100">
                    {formatAmount(report.totals.closingCashCents ?? report.countedCashCents)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Esperado según sistema</dt>
                  <dd>{formatAmount(report.totals.expectedCashCents)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Varianza</dt>
                  <dd className={`font-semibold ${varianceAbsolute >= varianceThreshold ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-slate-100"}`}>
                    {varianceFormatted}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Reembolsos del turno</dt>
                  <dd>{formatAmount(report.refunds.totalCents)} ({report.refunds.count})</dd>
                </div>
              </dl>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Se marca en ámbar cuando la diferencia supera RD$50. Investiga con el gerente antes de aprobar el cierre definitivo.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Pagos por método</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Total transado: {formatAmount(report.payments.summary.totalCents)}
                  </p>
                </div>
                <ArrowDownToLine className="h-5 w-5 text-slate-400" aria-hidden />
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <tr>
                      <th className="py-2 pr-4">Método</th>
                      <th className="py-2 pr-4 text-right">Monto</th>
                      <th className="py-2 pr-4 text-right">% del total</th>
                      <th className="py-2 text-right">Transacciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {paymentBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-3 text-center text-xs text-slate-500">
                          No se registraron pagos en este turno.
                        </td>
                      </tr>
                    ) : (
                      paymentBreakdown.map((entry) => (
                        <tr key={entry.method}>
                          <td className="py-2 pr-4 capitalize text-slate-700 dark:text-slate-200">{entry.method.replace(/_/g, " ")}</td>
                          <td className="py-2 pr-4 text-right font-medium text-slate-900 dark:text-slate-100">
                            {formatAmount(entry.totalCents)}
                          </td>
                          <td className="py-2 pr-4 text-right text-slate-600 dark:text-slate-300">
                            {entry.share.toFixed(1)}%
                          </td>
                          <td className="py-2 text-right text-slate-600 dark:text-slate-300">{entry.count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <div className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Movimientos de caja</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Netos: {formatAmount(report.cashMovements.summary.netMovementCents)}
                  </p>
                </div>
                <Clock className="h-5 w-5 text-slate-400" aria-hidden />
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <tr>
                      <th className="py-2 pr-4">Movimiento</th>
                      <th className="py-2 pr-4 text-right">Monto</th>
                      <th className="py-2 text-right">Eventos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {movementBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-3 text-center text-xs text-slate-500">
                          Sin movimientos manuales registrados.
                        </td>
                      </tr>
                    ) : (
                      movementBreakdown.map((entry) => (
                        <tr key={entry.kind}>
                          <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">
                            {MOVEMENT_LABELS[entry.kind] ?? entry.kind}
                          </td>
                          <td
                            className={`py-2 pr-4 text-right font-medium ${
                              entry.direction < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-slate-900 dark:text-slate-100"
                            }`}
                          >
                            {formatAmount(entry.totalCents)}
                          </td>
                          <td className="py-2 text-right text-slate-600 dark:text-slate-300">{entry.count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Cierres recientes</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecciona un turno para comparar varianzas.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {report.recentShifts.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No se encontraron cierres previos.
                  </li>
                ) : (
                  report.recentShifts.map((shift) => {
                    const isCurrent = shift.id === report.shift.id;
                    const variance = shift.overShortCents ?? 0;
                    return (
                      <li key={shift.id}>
                        <button
                          type="button"
                          disabled={isCurrent}
                          onClick={() => {
                            setShiftIdInput(String(shift.id));
                            loadReport({ shiftId: shift.id });
                          }}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:cursor-not-allowed ${
                            isCurrent
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-200"
                              : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-slate-600"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Turno #{shift.id}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {formatDateTime(shift.closedAt)}
                              </p>
                            </div>
                            <div className="text-right text-xs font-medium">
                              <span
                                className={
                                  variance < 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : variance > 0
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-slate-500 dark:text-slate-300"
                                }
                              >
                                {formatAmount(variance)}
                              </span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white/80 p-6 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Bitácora del turno</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Apertura: {formatDateTime(report.shift.openedAt)} · Cajero: {report.shift.openedByName ?? "N/D"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cierre: {formatDateTime(report.shift.closedAt)} · Supervisor: {report.shift.closedByName ?? "—"}
            </p>
          </section>
        </section>
      ) : null}
    </main>
  );
}

type SummaryCardProps = {
  title: string;
  value: number | null;
  subtitle?: string;
};

function SummaryCard({ title, value, subtitle }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
        {value == null ? "—" : pesoFormatter.format(Math.round(value) / 100)}
      </p>
      {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
    </div>
  );
}
