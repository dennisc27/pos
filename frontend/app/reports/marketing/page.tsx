"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { AlertTriangle, Calendar, Loader2, RefreshCw } from "lucide-react";

import { useActiveBranch } from "@/components/providers/active-branch-provider";
import { formatDateForDisplay, isValidDateRange, todayIsoDate } from "@/lib/utils";

import { DateRangeDialog } from "../components/date-range-dialog";
import { MetricCard } from "../components/metric-card";
import { ReportPageShell } from "../components/report-shell";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type CampaignRow = {
  id: number;
  name: string;
  status: string;
  channel: string | null;
  scheduledAt: string | null;
  createdAt: string | null;
  segmentName: string | null;
  totalMessages: number;
  delivered: number;
  failed: number;
};

type MarketingReportResponse = {
  generatedAt: string;
  filters: {
    startDate: string | null;
    endDate: string | null;
    branchId: number | null;
  };
  summary: {
    totalCampaigns: number;
    totalDeliveries: number;
    deliveryRate: number;
  };
  campaigns: CampaignRow[];
};

export default function MarketingReportPage() {
  const { branch: activeBranch, loading: branchLoading, error: branchError } = useActiveBranch();
  const [startDate, setStartDate] = useState(() => todayIsoDate());
  const [endDate, setEndDate] = useState(() => todayIsoDate());
  const [report, setReport] = useState<MarketingReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);

  const branchUnavailable = branchLoading || !activeBranch || Boolean(branchError);

  const loadReport = useCallback(async () => {
    if (!activeBranch) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("branchId", String(activeBranch.id));
      params.set("startDate", startDate);
      params.set("endDate", endDate);

      const response = await fetch(`${API_BASE_URL}/api/reports/marketing?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No se pudo cargar el reporte de marketing");
      }

      const payload: MarketingReportResponse = await response.json();
      setReport(payload);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Error inesperado al cargar el reporte");
    } finally {
      setLoading(false);
    }
  }, [activeBranch, startDate, endDate]);

  useEffect(() => {
    if (branchUnavailable) {
      return;
    }

    loadReport();
  }, [branchUnavailable, loadReport]);

  const handleApplyDateRange = useCallback(() => {
    if (!isValidDateRange(startDate, endDate)) {
      setError("La fecha de inicio no puede ser posterior a la fecha de fin");
      return;
    }
    setIsDateDialogOpen(false);
    if (!branchUnavailable) {
      loadReport();
    }
  }, [branchUnavailable, endDate, loadReport, startDate]);

  const dateRangeLabel = useMemo(() => {
    return `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`;
  }, [startDate, endDate]);

  return (
    <ReportPageShell
      title="Marketing"
      description="Measure campaign deliveries, redemptions, and engagement for promotions."
    >
      <div className="space-y-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Rango de fechas</p>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{dateRangeLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDateDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <Calendar className="h-4 w-4" /> Cambiar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => (!branchUnavailable ? loadReport() : null)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <RefreshCw className="h-4 w-4" /> Actualizar
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : null}

        {branchUnavailable ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            Configura una sucursal activa en ajustes para generar el reporte.
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Indicadores</h2>
              <p className="text-sm text-slate-500">Estado general de campañas y envíos.</p>
            </div>
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Campañas activas"
              value={new Intl.NumberFormat("es-DO").format(report?.summary.totalCampaigns ?? 0)}
            />
            <MetricCard
              label="Mensajes entregados"
              value={new Intl.NumberFormat("es-DO").format(report?.summary.totalDeliveries ?? 0)}
            />
            <MetricCard
              label="Tasa de entrega"
              value={`${report?.summary.deliveryRate ?? 0}%`}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Campañas</h2>
              <p className="text-sm text-slate-500">Incluye canal, segmento y entregas.</p>
            </div>
            <p className="text-xs text-slate-500">Actualizado {formatDateForDisplay(report?.generatedAt)}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
                  <th className="px-4 py-3">Campaña</th>
                  <th className="px-4 py-3">Segmento</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Programada</th>
                  <th className="px-4 py-3 text-right">Entregados</th>
                  <th className="px-4 py-3 text-right">Fallidos</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(report?.campaigns ?? []).map((row) => (
                  <tr key={row.id} className="bg-white/80 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
                    <td className="px-4 py-3 font-medium">
                      <p>{row.name}</p>
                      <p className="text-xs text-slate-500">Creada {formatDateForDisplay(row.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">{row.segmentName ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{row.channel ?? "—"}</td>
                    <td className="px-4 py-3">{formatDateForDisplay(row.scheduledAt)}</td>
                    <td className="px-4 py-3 text-right">{row.delivered}</td>
                    <td className="px-4 py-3 text-right">{row.failed}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {report?.campaigns?.length ? null : (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                      No hay campañas en el período seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex justify-end">
          <Link
            href="/reports/all"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Regresar
          </Link>
        </div>
      </div>

      <DateRangeDialog
        open={isDateDialogOpen}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={handleApplyDateRange}
        onClose={() => setIsDateDialogOpen(false)}
      />
    </ReportPageShell>
  );
}

