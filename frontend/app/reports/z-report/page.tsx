"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import { AlertTriangle, ArrowLeft, FileText, Loader2, ShieldCheck } from "lucide-react";

import { useActiveBranch } from "@/components/providers/active-branch-provider";
import { formatCurrency } from "@/components/cash/utils";
import { formatDateTimeForDisplay } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const numberFormatter = new Intl.NumberFormat("es-DO");
const OVER_SHORT_THRESHOLD_CENTS = 5_000; // RD$50 variance threshold

type ShiftEndReportResponse = {
  generatedAt: string;
  shift: {
    id: number;
    branchId: number | null;
    openedBy: number | null;
    closedBy: number | null;
    openedAt: string | null;
    closedAt: string | null;
  };
  totals: {
    openingCashCents?: number | null;
    closingCashCents?: number | null;
    expectedCashCents?: number | null;
    overShortCents?: number | null;
    cashPaymentsCents?: number | null;
    netMovementCents?: number | null;
  };
  payments?: {
    summary?: {
      methods?: Record<string, { totalCents: number; count: number }>;
    };
  };
  cashMovements?: {
    summary?: {
      totalsByKind?: Record<string, { totalCents: number; count: number }>;
      netMovementCents?: number | null;
    };
  };
  recentShifts?: Array<{ id: number | null }>;
  resolvedShiftId: number;
};

type ShiftSnapshot = {
  computedAt: string;
  shift: {
    id: number;
    branchId: number | null;
    openedBy: number | null;
    closedBy: number | null;
    openedAt: string | null;
    closedAt: string | null;
  };
  openingCashCents: number;
  closingCashCents: number | null;
  expectedCashCents: number;
  overShortCents: number | null;
  cashPaymentsCents: number;
  paymentsByMethod: Record<string, { totalCents: number; count: number }>;
  cashMovements: {
    totalsByKind: Record<string, { totalCents: number; count: number }>;
    netMovementCents: number;
  };
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    const error = new Error(data?.error ?? "Request failed");
    throw error;
  }

  return data;
}

const centsToCurrency = (value: number | null | undefined) => formatCurrency((Number(value ?? 0) / 100) || 0);

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return "—";
  }

  return formatDateTimeForDisplay(value);
};

export default function ZReportPage() {
  const { branch: activeBranch, loading: branchLoading, error: branchError } = useActiveBranch();
  const [reports, setReports] = useState<ShiftSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapReportToSnapshot = useCallback((report: ShiftEndReportResponse): ShiftSnapshot => {
    const paymentsByMethod = report.payments?.summary?.methods ?? {};
    const totalsByKind = report.cashMovements?.summary?.totalsByKind ?? {};

    return {
      computedAt: report.generatedAt,
      shift: {
        id: report.shift.id,
        branchId: report.shift.branchId ?? null,
        openedBy: report.shift.openedBy ?? null,
        closedBy: report.shift.closedBy ?? null,
        openedAt: report.shift.openedAt ?? null,
        closedAt: report.shift.closedAt ?? null,
      },
      openingCashCents: Number(report.totals?.openingCashCents ?? 0),
      closingCashCents:
        report.totals?.closingCashCents == null
          ? null
          : Number(report.totals?.closingCashCents ?? 0),
      expectedCashCents: Number(report.totals?.expectedCashCents ?? 0),
      overShortCents:
        report.totals?.overShortCents == null ? null : Number(report.totals?.overShortCents ?? 0),
      cashPaymentsCents: Number(report.totals?.cashPaymentsCents ?? 0),
      paymentsByMethod,
      cashMovements: {
        totalsByKind,
        netMovementCents: Number(report.cashMovements?.summary?.netMovementCents ?? 0),
      },
    };
  }, []);

  const loadReports = useCallback(
    async (branchId: number | null) => {
      setLoading(true);
      setError(null);

      try {
        const query = branchId != null ? `?branchId=${branchId}` : "";
        const primary = await getJson<ShiftEndReportResponse>(`/api/reports/shift-end${query}`);

        const snapshots: ShiftSnapshot[] = [mapReportToSnapshot(primary)];

        const additionalIds = Array.from(
          new Set(
            (primary.recentShifts ?? [])
              .map((item) => (item?.id ? Number(item.id) : null))
              .filter((id): id is number => Number.isInteger(id) && id > 0 && id !== primary.resolvedShiftId),
          ),
        ).slice(0, 19); // Load up to 20 total reports (1 primary + 19 additional)

        if (additionalIds.length > 0) {
          const extraReports = await Promise.all(
            additionalIds.map(async (id) => {
              try {
                const detail = await getJson<ShiftEndReportResponse>(`/api/reports/shift-end?shiftId=${id}`);
                return mapReportToSnapshot(detail);
              } catch (error) {
                return null;
              }
            }),
          );

          snapshots.push(...extraReports.filter((item): item is ShiftSnapshot => item != null));
        }

        setReports(snapshots);
      } catch (err) {
        setReports([]);
        const message = err instanceof Error ? err.message : "No se pudieron cargar los reportes.";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [mapReportToSnapshot],
  );

  useEffect(() => {
    if (branchLoading || !activeBranch) {
      return;
    }

    if (branchError) {
      setError(branchError);
      return;
    }

    void loadReports(activeBranch.id);
  }, [activeBranch, branchLoading, branchError, loadReports]);

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-6 py-12">
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
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Historial de Z-report</h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Guarda cada cierre con el conteo del cajón y resalta variaciones que requieran auditoría.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando reportes…
        </div>
      ) : null}

      {!loading && reports.length === 0 && !error ? (
        <p className="px-6 py-10 text-sm text-slate-500 dark:text-slate-400">
          Aún no hay Z-reports registrados. Cierra un turno para generar el primer registro.
        </p>
      ) : null}

      {!loading && reports.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900/60">
          <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
            {reports.map((report) => {
              const flagged = Math.abs(report.overShortCents ?? 0) >= OVER_SHORT_THRESHOLD_CENTS;
              return (
                <li
                  key={`${report.shift.id}-${report.computedAt}`}
                  className="grid gap-4 px-6 py-5 md:grid-cols-[1.2fr,1fr] md:items-start"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Shift #{report.shift.id} · {formatDate(report.shift.closedAt)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Calculado {formatDate(report.computedAt)} · Supervisor {numberFormatter.format(report.shift.closedBy ?? 0)}
                        </p>
                      </div>
                      {flagged ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                          <AlertTriangle className="h-3.5 w-3.5" /> Revisión requerida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                          <ShieldCheck className="h-3.5 w-3.5" /> Balanceado
                        </span>
                      )}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-4">
                      <div>
                        <dt className="uppercase tracking-wide text-[10px] text-slate-400">Apertura</dt>
                        <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {centsToCurrency(report.openingCashCents)}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide text-[10px] text-slate-400">Cierre contado</dt>
                        <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {centsToCurrency(report.closingCashCents)}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide text-[10px] text-slate-400">Esperado</dt>
                        <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {centsToCurrency(report.expectedCashCents)}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide text-[10px] text-slate-400">Over/Short</dt>
                        <dd
                          className={`text-sm font-semibold ${
                            report.overShortCents === 0
                              ? "text-slate-600 dark:text-slate-300"
                              : report.overShortCents && report.overShortCents > 0
                              ? "text-emerald-600 dark:text-emerald-300"
                              : "text-rose-600 dark:text-rose-300"
                          }`}
                        >
                          {centsToCurrency(report.overShortCents)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        Pagos
                      </p>
                      <ul className="space-y-1">
                        {Object.entries(report.paymentsByMethod).map(([method, breakdown]) => (
                          <li key={method} className="flex justify-between">
                            <span className="capitalize text-slate-500 dark:text-slate-400">{method}</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {centsToCurrency(breakdown.totalCents)} · {numberFormatter.format(breakdown.count)}
                            </span>
                          </li>
                        ))}
                        {Object.keys(report.paymentsByMethod).length === 0 ? (
                          <li className="text-slate-400">Sin pagos registrados</li>
                        ) : null}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        Movimientos de cajón
                      </p>
                      <ul className="space-y-1">
                        {Object.entries(report.cashMovements.totalsByKind).map(([kind, breakdown]) => (
                          <li key={kind} className="flex justify-between">
                            <span className="capitalize text-slate-500 dark:text-slate-400">{kind.replace(/_/g, " ")}</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {centsToCurrency(breakdown.totalCents)} · {numberFormatter.format(breakdown.count)}
                            </span>
                          </li>
                        ))}
                        {Object.keys(report.cashMovements.totalsByKind).length === 0 ? (
                          <li className="text-slate-400">Sin movimientos adicionales</li>
                        ) : null}
                      </ul>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Netos: {centsToCurrency(report.cashMovements.netMovementCents)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}



