"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Download,
  MessageCircle,
  MessageSquareText,
  Printer,
  RefreshCw
} from "lucide-react";

import { formatCurrencyFromCents } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const bucketOrder = ["all", "1-7", "8-14", "15-29", "30-59", "60+"] as const;

type BucketOption = (typeof bucketOrder)[number];

type LoanNotification = {
  id: number;
  loanId: number | null;
  channel: "sms" | "whatsapp";
  recipient: string;
  message: string;
  status: "pending" | "sent" | "failed";
  error: string | null;
  sentAt: string | null;
  createdAt: string | null;
};

type PastDueLoan = {
  id: number;
  branchId: number;
  branchName: string | null;
  customerId: number | null;
  ticketNumber: string;
  status: string;
  dueDate: string | null;
  graceDays: number;
  calendarDaysLate: number | null;
  daysLate: number | null;
  bucket: string;
  principalCents: number;
  interestModelId: number | null;
  interestModelName: string | null;
  outstandingPrincipalCents: number;
  outstandingInterestCents: number;
  totalDueCents: number;
  balance: {
    principalCents?: number;
    interestAccruedCents?: number;
    feeAccruedCents?: number;
    interestPaidCents?: number;
    principalPaidCents?: number;
    totalPaidCents?: number;
    outstandingPrincipalCents: number;
    outstandingInterestCents: number;
    totalDueCents: number;
  };
  customer: {
    id: number | null;
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    phone: string | null;
    email: string | null;
  };
  contactPhone: string | null;
  lastPayment: {
    id: number;
    amountCents: number;
    kind: string;
    method: string;
    createdAt: string | null;
  } | null;
  paymentsCount: number;
  notifications: LoanNotification[];
  lastOutreachAt: string | null;
};

type PastDueSummary = {
  totalCount: number;
  totalPrincipalCents: number;
  totalInterestCents: number;
  totalDueCents: number;
  bucketCounts: Record<string, number>;
};

type PastDueResponse = {
  generatedAt: string;
  asOf: string;
  filters: {
    branchId: number | null;
    statuses: string[];
    bucket: string | null;
    minDaysLate: number | null;
    maxDaysLate: number | null;
    search: string;
    limit: number;
  };
  availableBranches: { id: number; name: string }[];
  summary: PastDueSummary;
  loans: PastDueLoan[];
};

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short"
});

const channelLabels: Record<"sms" | "whatsapp", string> = {
  sms: "SMS",
  whatsapp: "WhatsApp"
};

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

function buildTemplateContext(loan: PastDueLoan) {
  const customerName =
    loan.customer?.fullName ||
    [loan.customer?.firstName, loan.customer?.lastName].filter(Boolean).join(" ") ||
    "cliente";

  const principalDue = Math.max(0, Number(loan.outstandingPrincipalCents ?? 0));
  const interestDue = Math.max(0, Number(loan.outstandingInterestCents ?? 0));
  const totalDue = Math.max(0, Number(loan.totalDueCents ?? 0));

  return {
    customerFirstName: loan.customer?.firstName ?? "",
    customerLastName: loan.customer?.lastName ?? "",
    customerName,
    ticketNumber: loan.ticketNumber,
    dueDate: loan.dueDate ?? "",
    daysLate: loan.daysLate ?? 0,
    calendarDaysLate: loan.calendarDaysLate ?? loan.daysLate ?? 0,
    graceDays: loan.graceDays ?? 0,
    totalDueCents: totalDue,
    outstandingPrincipalCents: principalDue,
    outstandingInterestCents: interestDue,
    totalDueFormatted: formatCurrencyFromCents(totalDue),
    outstandingPrincipalFormatted: formatCurrencyFromCents(principalDue),
    outstandingInterestFormatted: formatCurrencyFromCents(interestDue),
    branchName: loan.branchName ?? ""
  };
}

function renderTemplate(template: string, loan: PastDueLoan) {
  const context = buildTemplateContext(loan);

  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => {
    const normalized = key.toLowerCase();
    const replacements: Record<string, string> = {
      customerfirstname: context.customerFirstName,
      customerlastname: context.customerLastName,
      customername: context.customerName,
      ticketnumber: context.ticketNumber,
      duedate: context.dueDate,
      dayslate: String(context.daysLate ?? ""),
      calendardayslate: String(context.calendarDaysLate ?? ""),
      gracedays: String(context.graceDays ?? ""),
      totaldue: context.totalDueFormatted,
      totalduecents: String(context.totalDueCents ?? ""),
      principaldue: context.outstandingPrincipalFormatted,
      principalduecents: String(context.outstandingPrincipalCents ?? ""),
      interestdue: context.outstandingInterestFormatted,
      interestduecents: String(context.outstandingInterestCents ?? ""),
      branchname: context.branchName
    };

    return replacements[normalized] ?? "";
  });
}

function createCsv(loans: PastDueLoan[]) {
  const rows = [
    [
      "Ticket",
      "Customer",
      "Phone",
      "Due Date",
      "Days Late",
      "Bucket",
      "Total Due",
      "Branch"
    ],
    ...loans.map((loan) => {
      const customerName =
        loan.customer?.fullName ||
        [loan.customer?.firstName, loan.customer?.lastName].filter(Boolean).join(" ") ||
        "N/A";

      return [
        loan.ticketNumber,
        customerName,
        loan.contactPhone ?? loan.customer?.phone ?? "N/A",
        formatDate(loan.dueDate),
        loan.daysLate == null ? "" : String(loan.daysLate),
        loan.bucket,
        formatCurrencyFromCents(loan.totalDueCents),
        loan.branchName ?? ""
      ];
    })
  ];

  return rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function downloadCsv(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function openPrintWindow(loans: PastDueLoan[]) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    return;
  }

  const rows = loans
    .map((loan) => {
      const customerName =
        loan.customer?.fullName ||
        [loan.customer?.firstName, loan.customer?.lastName].filter(Boolean).join(" ") ||
        "—";

      return `<tr>
        <td>${loan.ticketNumber}</td>
        <td>${customerName}</td>
        <td>${loan.contactPhone ?? loan.customer?.phone ?? ""}</td>
        <td>${formatDate(loan.dueDate)}</td>
        <td>${loan.daysLate ?? ""}</td>
        <td>${formatCurrencyFromCents(loan.totalDueCents)}</td>
        <td>${loan.branchName ?? ""}</td>
      </tr>`;
    })
    .join("\n");

  const generatedAt = new Date().toLocaleString();

  printWindow.document.write(`<!DOCTYPE html>
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Past-due loans</title>
        <style>
          body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #111827; }
          h1 { font-size: 20px; margin-bottom: 8px; }
          p { margin: 4px 0 16px 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
          th { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>Past-due loans (${loans.length})</h1>
        <p>Generated ${generatedAt}</p>
        <table>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Due Date</th>
              <th>Days Late</th>
              <th>Total Due</th>
              <th>Branch</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>`);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

const defaultTemplate =
  "Hola {{customerName}}, tu préstamo #{{ticketNumber}} tiene {{daysLate}} día(s) de atraso. Balance: {{totalDue}}. Visítanos hoy para evitar cargos.";

export default function LoansDuePage() {
  const [data, setData] = useState<PastDueResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    branchId: "all",
    bucket: "all" as BucketOption,
    minDaysLate: "",
    maxDaysLate: ""
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const fetchPastDue = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", "500");

      if (filters.branchId !== "all") {
        params.set("branchId", filters.branchId);
      }

      if (filters.bucket !== "all") {
        params.set("bucket", filters.bucket);
      }

      if (filters.minDaysLate) {
        params.set("minDaysLate", filters.minDaysLate);
      }

      if (filters.maxDaysLate) {
        params.set("maxDaysLate", filters.maxDaysLate);
      }

      if (appliedSearch) {
        params.set("search", appliedSearch);
      }

      const response = await fetch(`${API_BASE_URL}/api/loans/past-due?${params.toString()}`, {
        headers: { Accept: "application/json" }
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<PastDueResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to load past-due loans");
      }

      setData(payload as PastDueResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load past-due loans");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, filters.branchId, filters.bucket, filters.maxDaysLate, filters.minDaysLate]);

  useEffect(() => {
    void fetchPastDue();
  }, [fetchPastDue]);

  const loans = useMemo(() => data?.loans ?? [], [data]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => loans.some((loan) => loan.id === id)));
  }, [loans]);

  const selectedLoans = useMemo(
    () => loans.filter((loan) => selectedIds.includes(loan.id)),
    [loans, selectedIds]
  );

  const bucketCounts = data?.summary?.bucketCounts ?? {};
  const totalCount = data?.summary?.totalCount ?? 0;

  const allVisibleIds = useMemo(() => loans.map((loan) => loan.id), [loans]);
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id));

  const handleToggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allVisibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allVisibleIds])));
    }
  };

  const handleToggleRow = (loanId: number) => {
    setSelectedIds((prev) =>
      prev.includes(loanId) ? prev.filter((id) => id !== loanId) : [...prev, loanId]
    );
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(searchTerm.trim());
  };

  const [composer, setComposer] = useState({
    open: false,
    channel: null as "sms" | "whatsapp" | null,
    template: defaultTemplate,
    sending: false,
    error: null as string | null,
    success: null as string | null
  });

  const openComposer = (channel: "sms" | "whatsapp") => {
    setComposer({
      open: true,
      channel,
      template: defaultTemplate,
      sending: false,
      error: null,
      success: null
    });
  };

  const composerPreview = useMemo(() => {
    if (!selectedLoans.length || !composer.open) {
      return [] as { loanId: number; message: string; customerName: string }[];
    }

    return selectedLoans.slice(0, 5).map((loan) => ({
      loanId: loan.id,
      message: renderTemplate(composer.template, loan),
      customerName:
        loan.customer?.fullName ||
        [loan.customer?.firstName, loan.customer?.lastName].filter(Boolean).join(" ") ||
        "Cliente"
    }));
  }, [composer.open, composer.template, selectedLoans]);

  const closeComposer = () => {
    setComposer((state) => ({ ...state, open: false, channel: null, error: null, success: null }));
  };

  const handleTemplateChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setComposer((state) => ({ ...state, template: value }));
  };

  const handleSendMessages = async () => {
    if (!composer.channel || selectedIds.length === 0) {
      return;
    }

    setComposer((state) => ({ ...state, sending: true, error: null, success: null }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/loans/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanIds: selectedIds,
          channel: composer.channel,
          message: composer.template
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        summary?: { queued?: number };
      };

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to queue outreach messages");
      }

      setComposer((state) => ({
        ...state,
        sending: false,
        success: `Se enviaron ${payload.summary?.queued ?? 0} mensaje(s) para aprobación.`
      }));

      await fetchPastDue();
    } catch (err) {
      setComposer((state) => ({
        ...state,
        sending: false,
        error: err instanceof Error ? err.message : "Unable to queue outreach messages"
      }));
    }
  };

  const handleExportCsv = () => {
    const list = selectedIds.length > 0 ? selectedLoans : loans;
    if (list.length === 0) {
      return;
    }

    const csv = createCsv(list);
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `past-due-${today}.csv`);
  };

  const handlePrint = () => {
    const list = selectedIds.length > 0 ? selectedLoans : loans;
    if (list.length === 0) {
      return;
    }

    openPrintWindow(list);
  };

  const branchOptions = useMemo(() => {
    const base = [{ id: "all", name: "Todas las sucursales" }];
    const remote = (data?.availableBranches ?? []).map((branch) => ({
      id: String(branch.id),
      name: branch.name
    }));
    return [...base, ...remote];
  }, [data?.availableBranches]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-slate-900 dark:text-slate-100 lg:px-10">
      <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">Loans</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Past-due outreach</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Prioritize delinquent tickets, coordinate outreach, and export actionable worklists for field follow-up.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchPastDue()}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void fetchPastDue()}
              className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Balance total</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {formatCurrencyFromCents(data?.summary?.totalDueCents ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Principal: {formatCurrencyFromCents(data?.summary?.totalPrincipalCents ?? 0)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Interés: {formatCurrencyFromCents(data?.summary?.totalInterestCents ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tickets atrasados</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{totalCount}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Generado el {formatDateTime(data?.generatedAt)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Corte {formatDate(data?.asOf)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Selección actual</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{selectedIds.length}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Se enviará {selectedIds.length > 0 ? "a los tickets marcados" : "al filtro completo"}</p>
        </div>
      </section>

      <section className="mb-6 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {bucketOrder.map((bucketKey) => {
              const isActive = filters.bucket === bucketKey;
              const label = bucketKey === "all" ? "Todos" : bucketKey;
              const count = bucketKey === "all" ? totalCount : bucketCounts[bucketKey] ?? 0;

              return (
                <button
                  key={bucketKey}
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, bucket: bucketKey }))}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                    isActive
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-100"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  <span>{label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-200">{count}</span>
                </button>
              );
            })}
          </div>
          <form onSubmit={handleSearchSubmit} className="flex w-full max-w-md items-center gap-2">
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Ticket, nombre o teléfono"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Buscar
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex flex-col text-xs font-medium text-slate-600 dark:text-slate-300">
            Sucursal
            <select
              value={filters.branchId}
              onChange={(event) => setFilters((prev) => ({ ...prev, branchId: event.target.value }))}
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col text-xs font-medium text-slate-600 dark:text-slate-300 md:max-w-xs">
            Días mínimos de atraso
            <input
              type="number"
              min={0}
              value={filters.minDaysLate}
              onChange={(event) => setFilters((prev) => ({ ...prev, minDaysLate: event.target.value }))}
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-1 flex-col text-xs font-medium text-slate-600 dark:text-slate-300 md:max-w-xs">
            Días máximos de atraso
            <input
              type="number"
              min={0}
              value={filters.maxDaysLate}
              onChange={(event) => setFilters((prev) => ({ ...prev, maxDaysLate: event.target.value }))}
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
      </section>

      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-sm text-slate-700 dark:text-slate-200">
            {selectedIds.length} ticket(s) seleccionados para gestión.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openComposer("sms")}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <MessageSquareText className="h-4 w-4" />
              Enviar SMS
            </button>
            <button
              type="button"
              onClick={() => openComposer("whatsapp")}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar WhatsApp
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              Imprimir lista
            </button>
          </div>
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-200">Ticket</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-200">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-200">Vencimiento</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-200">Totales</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-200">Contacto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loans.map((loan) => {
                const isSelected = selectedIds.includes(loan.id);
                const customerName =
                  loan.customer?.fullName ||
                  [loan.customer?.firstName, loan.customer?.lastName].filter(Boolean).join(" ") ||
                  "Cliente";
                const lastOutreach = loan.lastOutreachAt ? formatDateTime(loan.lastOutreachAt) : "Nunca";
                const notifications = loan.notifications?.length ?? 0;

                return (
                  <tr key={loan.id} className={isSelected ? "bg-blue-50/40 dark:bg-blue-950/30" : undefined}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleRow(loan.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700"
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{loan.ticketNumber}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{loan.branchName ?? "—"}</div>
                      <div className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                        {loan.bucket} días
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{customerName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{loan.customer?.phone ?? "Sin teléfono"}</div>
                      {loan.customer?.email && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">{loan.customer.email}</div>
                      )}
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Pagos: {loan.paymentsCount} · Último: {loan.lastPayment?.createdAt ? formatDateTime(loan.lastPayment.createdAt) : "N/A"}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{formatDate(loan.dueDate)}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{loan.daysLate ?? 0} día(s) · Gracia {loan.graceDays}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Calendario: {loan.calendarDaysLate ?? 0} día(s)</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{formatCurrencyFromCents(loan.totalDueCents)}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Principal: {formatCurrencyFromCents(loan.outstandingPrincipalCents)}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Interés: {formatCurrencyFromCents(loan.outstandingInterestCents)}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Último contacto: {lastOutreach}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Mensajes: {notifications}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Teléfono envío: {loan.contactPhone ?? "—"}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">Cargando información de tickets...</div>
        )}
        {!loading && loans.length === 0 && (
          <div className="border-t border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            No existen préstamos vencidos con los filtros seleccionados.
          </div>
        )}
      </section>

      {composer.open && composer.channel && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 px-4 pb-8 pt-16">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:text-slate-100">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {channelLabels[composer.channel]} para {selectedIds.length} ticket(s)
              </h2>
              <button
                type="button"
                onClick={closeComposer}
                className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
              >
                Cerrar
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Variables disponibles: {'{'}customerName{'}'}, {'{'}ticketNumber{'}'}, {'{'}daysLate{'}'}, {'{'}totalDue{'}'}, {'{'}branchName{'}'}.
            </p>
            <textarea
              value={composer.template}
              onChange={handleTemplateChange}
              rows={5}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />

            {composer.error && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
                {composer.error}
              </div>
            )}
            {composer.success && (
              <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-600 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
                {composer.success}
              </div>
            )}

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Vista previa</p>
              <ul className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {composerPreview.length === 0 && <li>No hay vista previa disponible.</li>}
                {composerPreview.map((preview) => (
                  <li key={preview.loanId}>
                    <span className="font-medium text-slate-700 dark:text-slate-100">#{preview.loanId}:</span> {preview.message || "(mensaje vacío)"}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeComposer}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={composer.sending}
                onClick={() => void handleSendMessages()}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {composer.sending ? "Enviando…" : `Colocar en cola (${channelLabels[composer.channel]})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
