"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { ArrowLeft, AlertTriangle, Check, Download, Loader2, MessageCircle, RefreshCw, Send } from "lucide-react";

import { formatCurrencyFromCents } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const dateFormatter = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" });

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return dateFormatter.format(parsed);
}

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

type LoanCustomer = {
  id: number | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phone: string | null;
  email: string | null;
};

type LoanAgingLoan = {
  id: number;
  branchId: number | null;
  branchName: string | null;
  ticketNumber: string;
  status: string;
  dueDate: string | null;
  graceDays: number;
  calendarDaysLate: number | null;
  daysLate: number | null;
  bucket: string | null;
  principalCents: number;
  outstandingPrincipalCents: number;
  outstandingInterestCents: number;
  totalDueCents: number;
  customer: LoanCustomer;
};

type BucketSummary = {
  count: number;
  principalCents: number;
  interestCents: number;
  totalDueCents: number;
};

type LoanAgingSummary = {
  totalCount: number;
  totalPrincipalCents: number;
  totalInterestCents: number;
  totalDueCents: number;
  bucketTotals: Record<string, BucketSummary>;
};

type LoansAgingResponse = {
  generatedAt: string;
  asOf: string;
  filters: {
    branchId: number | null;
    statuses: string[];
    bucket: string | null;
    minDaysLate: number | null;
    maxDaysLate: number | null;
    limit: number;
  };
  bucketOrder: string[];
  availableBranches: { id: number; name: string }[];
  summary: LoanAgingSummary;
  loans: LoanAgingLoan[];
};

const DEFAULT_BUCKET_LABELS: Record<string, string> = {
  current: "Al día",
  "1-7": "1-7 días",
  "8-14": "8-14 días",
  "15-29": "15-29 días",
  "30-59": "30-59 días",
  "60+": "60+ días"
};

export default function ReportsLoansAgingPage() {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<LoansAgingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [branchIdFilter, setBranchIdFilter] = useState<string>("");
  const [bucketFilter, setBucketFilter] = useState<string>("all");
  const [minDaysFilter, setMinDaysFilter] = useState<string>("");
  const [maxDaysFilter, setMaxDaysFilter] = useState<string>("");

  const [selectedLoanIds, setSelectedLoanIds] = useState<Set<number>>(new Set());
  const [channel, setChannel] = useState<"sms" | "whatsapp">("whatsapp");
  const [message, setMessage] = useState<string>("Hola {{customerName}}, tu préstamo {{ticketNumber}} tiene saldo pendiente de {{totalDue}}. Acércate a la sucursal para evitar cargos adicionales.");

  const bucketOrder = report?.bucketOrder ?? ["current", "1-7", "8-14", "15-29", "30-59", "60+"];

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const params = new URLSearchParams();
      if (branchIdFilter.trim()) {
        params.set("branchId", branchIdFilter.trim());
      }
      if (bucketFilter !== "all") {
        params.set("bucket", bucketFilter);
      }
      if (minDaysFilter.trim()) {
        params.set("minDaysLate", minDaysFilter.trim());
      }
      if (maxDaysFilter.trim()) {
        params.set("maxDaysLate", maxDaysFilter.trim());
      }

      const url = `${API_BASE_URL}/api/reports/loans-aging${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No se pudo cargar el reporte de aging");
      }

      const payload: LoansAgingResponse = await response.json();
      setReport(payload);
      setSelectedLoanIds(new Set());
      if (payload.filters.branchId != null && !branchIdFilter) {
        setBranchIdFilter(String(payload.filters.branchId));
      }
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "No se pudo cargar el reporte");
    } finally {
      setLoading(false);
    }
  }, [branchIdFilter, bucketFilter, maxDaysFilter, minDaysFilter]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const toggleLoanSelection = useCallback(
    (loanId: number) => {
      setSelectedLoanIds((prev) => {
        const next = new Set(prev);
        if (next.has(loanId)) {
          next.delete(loanId);
        } else {
          next.add(loanId);
        }
        return next;
      });
    },
    []
  );

  const toggleSelectAll = useCallback(() => {
    if (!report) {
      return;
    }

    setSelectedLoanIds((prev) => {
      if (prev.size === report.loans.length) {
        return new Set();
      }
      return new Set(report.loans.map((loan) => loan.id));
    });
  }, [report]);

  const handleSendOutreach = useCallback(async () => {
    if (selectedLoanIds.size === 0) {
      setError("Selecciona al menos un préstamo para enviar un mensaje");
      return;
    }

    if (!message.trim()) {
      setError("Escribe un mensaje para enviar a los clientes seleccionados");
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/loans/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanIds: Array.from(selectedLoanIds),
          channel,
          message,
          dryRun: false
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "No se pudo enviar la campaña");
      }

      const payload = await response.json();
      setSuccess(`Se encolaron ${payload.summary?.queued ?? payload.queued?.length ?? 0} mensajes.`);
      setSelectedLoanIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la campaña");
    } finally {
      setSending(false);
    }
  }, [channel, message, selectedLoanIds]);

  const handleExportCsv = useCallback(() => {
    if (!report) {
      return;
    }

    const headers = [
      "loan_id",
      "ticket_number",
      "branch",
      "bucket",
      "days_late",
      "due_date",
      "principal_due",
      "interest_due",
      "total_due",
      "customer_name",
      "customer_phone"
    ];

    const rows = report.loans.map((loan) => [
      loan.id,
      loan.ticketNumber,
      loan.branchName ?? loan.branchId ?? "",
      loan.bucket ?? "current",
      loan.daysLate ?? 0,
      loan.dueDate ?? "",
      (loan.outstandingPrincipalCents ?? 0) / 100,
      (loan.outstandingInterestCents ?? 0) / 100,
      (loan.totalDueCents ?? 0) / 100,
      loan.customer.fullName ??
        [loan.customer.firstName, loan.customer.lastName].filter(Boolean).join(" "),
      loan.customer.phone ?? ""
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `loans-aging-${report.asOf}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [report]);

  const bucketSummaries = useMemo(() => {
    if (!report) {
      return [] as {
        bucket: string;
        label: string;
        summary: BucketSummary;
        share: number;
      }[];
    }

    const totalDue = Math.max(0, Number(report.summary.totalDueCents ?? 0));
    return bucketOrder.map((bucket) => {
      const summary = report.summary.bucketTotals[bucket] ?? {
        count: 0,
        principalCents: 0,
        interestCents: 0,
        totalDueCents: 0
      };
      const share = totalDue > 0 ? (summary.totalDueCents / totalDue) * 100 : 0;
      return {
        bucket,
        label: DEFAULT_BUCKET_LABELS[bucket] ?? bucket,
        summary,
        share
      };
    });
  }, [bucketOrder, report]);

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
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Aging de préstamos</h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Visualiza el saldo pendiente agrupado por antigüedad y toma acción con campañas de outreach para clientes en riesgo.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
        <form className="grid gap-4 md:grid-cols-[repeat(4,minmax(0,1fr))_auto] md:items-end" onSubmit={(event) => { event.preventDefault(); loadReport(); }}>
          <div className="space-y-2">
            <label htmlFor="branch" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Sucursal
            </label>
            <input
              id="branch"
              value={branchIdFilter}
              onChange={(event) => setBranchIdFilter(event.target.value)}
              placeholder="Todas"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="bucket" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Bucket
            </label>
            <select
              id="bucket"
              value={bucketFilter}
              onChange={(event) => setBucketFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="all">Todos</option>
              {bucketOrder.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {DEFAULT_BUCKET_LABELS[bucket] ?? bucket}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="minDays" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Días mínimos
            </label>
            <input
              id="minDays"
              value={minDaysFilter}
              onChange={(event) => setMinDaysFilter(event.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="maxDays" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Días máximos
            </label>
            <input
              id="maxDays"
              value={maxDaysFilter}
              onChange={(event) => setMaxDaysFilter(event.target.value)}
              placeholder=""
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Aplicar
            </button>
            <button
              type="button"
              onClick={() => {
                setBranchIdFilter("");
                setBucketFilter("all");
                setMinDaysFilter("");
                setMaxDaysFilter("");
                loadReport();
              }}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              Limpiar
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          {success}
        </div>
      ) : null}
      {loading && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando aging…
        </div>
      )}

      {!loading && report ? (
        <section className="space-y-8">
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryTile label="Préstamos" value={report.summary.totalCount.toString()} />
            <SummaryTile label="Principal vencido" value={formatCurrencyFromCents(report.summary.totalPrincipalCents)} />
            <SummaryTile label="Intereses vencidos" value={formatCurrencyFromCents(report.summary.totalInterestCents)} />
            <SummaryTile label="Total vencido" value={formatCurrencyFromCents(report.summary.totalDueCents)} highlight />
          </div>

          <section className="rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Distribución por bucket</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total calculado al {formatDateTime(report.generatedAt)} · As of {formatDate(report.asOf)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              >
                <Download className="mr-2 h-4 w-4" /> Exportar CSV
              </button>
            </header>

            <div className="mt-6 space-y-4">
              {bucketSummaries.map(({ bucket, label, summary, share }) => (
                <div key={bucket} className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{label}</span>
                    <span>{summary.count} · {formatCurrencyFromCents(summary.totalDueCents)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-3 rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${Math.max(share, summary.count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white/80 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                >
                  {selectedLoanIds.size === report.loans.length && report.loans.length > 0 ? "Quitar selección" : "Seleccionar todo"}
                </button>
                <span>{selectedLoanIds.size} seleccionados</span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">Ordenado por bucket &gt; días vencidos &gt; saldo</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-2">
                      <span className="sr-only">Seleccionar</span>
                    </th>
                    <th className="px-6 py-2">Ticket</th>
                    <th className="px-6 py-2">Cliente</th>
                    <th className="px-6 py-2">Sucursal</th>
                    <th className="px-6 py-2">Bucket</th>
                    <th className="px-6 py-2 text-right">Días</th>
                    <th className="px-6 py-2 text-right">Principal</th>
                    <th className="px-6 py-2 text-right">Interés</th>
                    <th className="px-6 py-2 text-right">Total</th>
                    <th className="px-6 py-2">Vence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {report.loans.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-6 text-center text-xs text-slate-500">
                        No se encontraron préstamos con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    report.loans.map((loan) => {
                      const isSelected = selectedLoanIds.has(loan.id);
                      const bucketLabel = DEFAULT_BUCKET_LABELS[loan.bucket ?? "current"] ?? loan.bucket ?? "current";
                      const variance = loan.daysLate ?? 0;
                      return (
                        <tr key={loan.id} className={isSelected ? "bg-indigo-50/60 dark:bg-indigo-950/20" : undefined}>
                          <td className="px-6 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleLoanSelection(loan.id)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400 dark:border-slate-600"
                            />
                          </td>
                          <td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-200">{loan.ticketNumber}</td>
                          <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                            {loan.customer.fullName ?? [loan.customer.firstName, loan.customer.lastName].filter(Boolean).join(" ") || "—"}
                          </td>
                          <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{loan.branchName ?? loan.branchId ?? "—"}</td>
                          <td className="px-6 py-3">
                            <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
                              {bucketLabel}
                            </span>
                          </td>
                          <td className={`px-6 py-3 text-right font-medium ${variance >= 30 ? "text-red-600 dark:text-red-400" : variance >= 15 ? "text-amber-600 dark:text-amber-400" : "text-slate-700 dark:text-slate-200"}`}>
                            {variance}
                          </td>
                          <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">
                            {formatCurrencyFromCents(loan.outstandingPrincipalCents)}
                          </td>
                          <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">
                            {formatCurrencyFromCents(loan.outstandingInterestCents)}
                          </td>
                          <td className="px-6 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrencyFromCents(loan.totalDueCents)}
                          </td>
                          <td className="px-6 py-3 text-slate-600 dark:text-slate-300">{formatDate(loan.dueDate)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Acciones masivas</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Envia recordatorios personalizados utilizando variables como {"{{ticketNumber}}"} o {"{{totalDue}}"}.
                </p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
            </header>

            <div className="grid gap-4 md:grid-cols-[160px_1fr]">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Canal</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel("whatsapp")}
                    className={`inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-300 ${
                      channel === "whatsapp"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-200"
                        : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel("sms")}
                    className={`inline-flex flex-1 items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                      channel === "sms"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-200"
                        : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    <Send className="mr-2 h-4 w-4" /> SMS
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="message" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Mensaje
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Variables disponibles: {"{{customerName}}"}, {"{{ticketNumber}}"}, {"{{totalDue}}"}, {"{{dueDate}}"}, {"{{daysLate}}"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Check className="h-4 w-4 text-emerald-500" />
                Seleccionados: {selectedLoanIds.size}
              </div>
              <button
                type="button"
                onClick={handleSendOutreach}
                disabled={sending || selectedLoanIds.size === 0}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Enviar mensajes
              </button>
            </div>
          </section>
        </section>
      ) : null}
    </main>
  );
}

type SummaryTileProps = {
  label: string;
  value: string;
  highlight?: boolean;
};

function SummaryTile({ label, value, highlight = false }: SummaryTileProps) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 shadow-sm ${
        highlight
          ? "border-indigo-400 bg-indigo-50 text-indigo-800 dark:border-indigo-500/70 dark:bg-indigo-950/40 dark:text-indigo-200"
          : "border-slate-200 bg-white/80 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
      }`}
    >
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
