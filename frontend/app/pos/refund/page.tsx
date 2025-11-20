"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BadgeInfo,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  DollarSign,
  Info,
  Loader2,
  Package,
  Printer,
  Receipt,
  Search,
  ShieldCheck,
  Store,
  X
} from "lucide-react";

import { PosCard } from "@/components/pos/pos-card";
import { formatCurrency } from "@/components/pos/utils";
import { breakdownPriceWithTax, calculateLineTotal } from "@/lib/price-calculations";

type ApiInvoice = {
  id: number;
  invoiceNo: string | null;
  createdAt: string | null;
  customerName: string;
  userId: number;
};

type ApiInvoiceLine = {
  orderItemId: number;
  productCodeVersionId: number;
  sku: string | null;
  description: string | null;
  qty: number;
  unitPriceCents: number;
  taxCents: number;
  subtotalCents: number;
  totalCents: number;
  restockable: boolean;
};

type ApiInvoicePayment = {
  id: number;
  method: "cash" | "card" | "transfer" | "gift_card" | "credit_note" | "store_credit";
  amountCents: number;
  reference: string | null;
  createdAt: string | null;
};

type InvoiceDetail = {
  invoice: ApiInvoice;
  lines: ApiInvoiceLine[];
  payments: ApiInvoicePayment[];
  policyFlags: string[];
};

type RefundLineSelection = {
  selected: boolean;
  restock: boolean;
  qty: number; // Quantity to refund (can be less than original)
};

type RefundTotals = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  restockValueCents: number;
};

type RefundResponse = {
  salesReturn: {
    id: number;
    refundMethod: "cash" | "store_credit";
    totalRefundCents: number;
    restockValueCents: number;
    createdAt: string | null;
  };
  totals: RefundTotals;
  creditNote: { id: number; balanceCents: number; createdAt: string | null } | null;
};

type InvoiceSearchResult = {
  id: number;
  invoiceNo: string | null;
  customerName: string | null;
  totalCents: number;
  createdAt: string | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const defaultHistoryStartDate = () => {
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return formatDateInput(start);
};

const defaultHistoryEndDate = () => formatDateInput(new Date());

export default function PosRefundPage() {
  const [search, setSearch] = useState("");
  const [activeInvoice, setActiveInvoice] = useState<InvoiceDetail | null>(null);
  const [lineSelections, setLineSelections] = useState<Record<string, RefundLineSelection>>({});
  const [refundMethod, setRefundMethod] = useState<"cash" | "store_credit">("cash");
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState("Wrong color / mismatch");
  const [noteInput, setNoteInput] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [isHistoryDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState(() => defaultHistoryStartDate());
  const [historyEndDate, setHistoryEndDate] = useState(() => defaultHistoryEndDate());
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyResults, setHistoryResults] = useState<InvoiceSearchResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isSuccessDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!activeInvoice) {
      setLineSelections({});
      return;
    }

    setLineSelections(
      activeInvoice.lines.reduce<Record<string, RefundLineSelection>>((acc, line) => {
        const key = String(line.orderItemId);
        acc[key] = {
          selected: line.restockable,
          restock: line.restockable,
          qty: line.qty, // Initialize with original quantity
        };
        return acc;
      }, {}),
    );
  }, [activeInvoice]);

  useEffect(() => {
    setSubmitState("idle");
    setSubmitMessage(null);
  }, [refundMethod, activeInvoice]);

  useEffect(() => {
    if (!isPrinting) return;
    const timeout = setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 120);
    return () => clearTimeout(timeout);
  }, [isPrinting]);

  const totals = useMemo(() => {
    if (!activeInvoice) {
      return {
        totalQty: 0,
        subtotalCents: 0,
        taxCents: 0,
        totalCents: 0,
        restockValueCents: 0,
      };
    }

    // IMPORTANT: unitPriceCents already includes ITBIS (see PRICING_MODEL.md)
    return activeInvoice.lines.reduce(
      (acc, line) => {
        const selection = lineSelections[String(line.orderItemId)];
        if (!selection?.selected) {
          return acc;
        }

        const refundQty = selection.qty || 0;
        const unitPriceCents = line.unitPriceCents; // Already includes ITBIS
        
        // Calculate line total: unitPrice * qty (price already includes tax)
        const lineTotalCents = calculateLineTotal(unitPriceCents, refundQty);
        
        // Extract net and tax for display (price includes tax, so we break it down)
        const breakdown = breakdownPriceWithTax(lineTotalCents, 0.18);
        
        acc.totalQty += refundQty;
        acc.subtotalCents += breakdown.netCents; // Net without tax
        acc.taxCents += breakdown.taxCents; // Tax portion
        acc.totalCents += lineTotalCents; // Total (includes tax)

        if (selection.restock && line.restockable) {
          // Restock value is the net amount (without tax) for the refunded quantity
          acc.restockValueCents += breakdown.netCents;
        }

        return acc;
      },
      { totalQty: 0, subtotalCents: 0, taxCents: 0, totalCents: 0, restockValueCents: 0 },
    );
  }, [activeInvoice, lineSelections]);

  const lookupInvoice = useCallback(async (rawInvoice: string) => {
    const trimmed = rawInvoice.trim();

    if (!trimmed) {
      setLookupError("Enter an invoice number to search");
      setActiveInvoice(null);
      setLineSelections({});
      return;
    }

    setIsLoading(true);
    setLookupError(null);
    setSubmitState("idle");
    setSubmitMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/invoices/${encodeURIComponent(trimmed)}`);
      const payload = (await response.json().catch(() => null)) as InvoiceDetail | { error?: string } | null;

      if (!response.ok) {
        const message = payload && "error" in (payload as { error?: string })
          ? (payload as { error?: string }).error
          : null;
        throw new Error(message ?? `Unable to find invoice ${trimmed}`);
      }

      const data = payload as InvoiceDetail;
      setActiveInvoice(data);
      setSearch(data.invoice.invoiceNo ?? trimmed.toUpperCase());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to look up invoice";
      setLookupError(message);
      setActiveInvoice(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await lookupInvoice(search);
  };

  const loadInvoiceHistory = useCallback(async () => {
    const start = historyStartDate?.trim() ?? "";
    const end = historyEndDate?.trim() ?? "";

    if (start && end && start > end) {
      setHistoryError("Start date must be before end date");
      setHistoryResults([]);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const params = new URLSearchParams();
      if (start) params.set("from", start);
      if (end) params.set("to", end);
      if (historyQuery.trim()) params.set("q", historyQuery.trim());
      params.set("limit", "25");

      const response = await fetch(`${API_BASE_URL}/api/invoices?${params.toString()}`);
      const payload = (await response.json().catch(() => null)) as
        | { invoices?: InvoiceSearchResult[]; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to load invoices");
      }

      setHistoryResults(payload?.invoices ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load invoices";
      setHistoryError(message);
      setHistoryResults([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyStartDate, historyEndDate, historyQuery]);

  const openHistoryDialog = useCallback(() => {
    setHistoryError(null);
    setHistoryDialogOpen(true);
    void loadInvoiceHistory();
  }, [loadInvoiceHistory]);

  const closeHistoryDialog = useCallback(() => {
    setHistoryDialogOpen(false);
  }, []);

  const resetPage = useCallback(() => {
    setSearch("");
    setActiveInvoice(null);
    setLineSelections({});
    setRefundMethod("cash");
    setReasonCode("Wrong color / mismatch");
    setNoteInput("");
    setSubmitState("idle");
    setSubmitMessage(null);
    setLookupError(null);
    setSuccessDialogOpen(false);
    setSuccessMessage(null);
  }, []);

  const handleSelectHistoryInvoice = useCallback(
    async (entry: InvoiceSearchResult) => {
      const identifier = entry.invoiceNo ?? String(entry.id);
      closeHistoryDialog();
      setSearch(identifier);
      await lookupInvoice(identifier);
    },
    [closeHistoryDialog, lookupInvoice]
  );

  const toggleSelection = (line: ApiInvoiceLine, field: keyof RefundLineSelection) => {
    setLineSelections((prev) => {
      const key = String(line.orderItemId);
      const current = prev[key] ?? { selected: false, restock: false, qty: line.qty };

      if (field === "restock" && !line.restockable) {
        return prev;
      }

      return {
        ...prev,
        [key]: {
          ...current,
          [field]: field === "restock" ? !current.restock : !current.selected,
        },
      };
    });
  };

  const updateQuantity = (line: ApiInvoiceLine, newQty: number) => {
    const qty = Math.max(0, Math.min(newQty, line.qty)); // Clamp between 0 and original qty
    setLineSelections((prev) => {
      const key = String(line.orderItemId);
      const current = prev[key] ?? { selected: false, restock: false, qty: line.qty };
      
      return {
        ...prev,
        [key]: {
          ...current,
          qty,
          // Auto-select if qty > 0, auto-deselect if qty = 0
          selected: qty > 0 ? (current.selected || true) : false,
        },
      };
    });
  };

  const selectedCount = useMemo(() => {
    return Object.values(lineSelections).filter((value) => value.selected).length;
  }, [lineSelections]);

  const handlePostRefund = async () => {
    if (!activeInvoice) {
      setSubmitState("error");
      setSubmitMessage("Look up an invoice before posting a refund.");
      return;
    }

    const selectedLines = activeInvoice.lines
      .map((line) => {
        const selection = lineSelections[String(line.orderItemId)];
        if (!selection?.selected || !selection.qty || selection.qty <= 0) {
          return null;
        }
        return { line, selection };
      })
      .filter((item): item is { line: ApiInvoiceLine; selection: RefundLineSelection } => item !== null);

    if (selectedLines.length === 0) {
      setSubmitState("error");
      setSubmitMessage("Select at least one line item with quantity > 0 to refund.");
      return;
    }

    // Validate quantities
    for (const { line, selection } of selectedLines) {
      if (selection.qty > line.qty) {
        setSubmitState("error");
        setSubmitMessage(`Quantity for ${line.description ?? "item"} cannot exceed ${line.qty} (original quantity).`);
        return;
      }
    }

    setSubmitState("submitting");
    setSubmitMessage("Posting refund...");

    try {
      const payload = {
        invoiceNo: activeInvoice.invoice.invoiceNo,
        method: refundMethod,
        lines: selectedLines.map(({ line, selection }) => ({
          orderItemId: line.orderItemId,
          qty: selection.qty,
          restock: Boolean(selection.restock && line.restockable),
        })),
        reason: reasonCode,
        notes: noteInput.trim() || null,
      };

      const response = await fetch(`${API_BASE_URL}/api/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to post refund");
      }

      const data = (await response.json()) as RefundResponse;

      // IMPORTANT: totalRefundCents already includes ITBIS (see PRICING_MODEL.md)
      // Use salesReturn.totalRefundCents which is the actual refund amount
      const refundAmountCents = data.salesReturn.totalRefundCents;
      const amountFormatted = formatCurrency(refundAmountCents / 100);
      let message = "";
      if (refundMethod === "store_credit" && data.creditNote) {
        message = `Store credit refund posted. Credit note #${data.creditNote.id} balance: ${formatCurrency(
          data.creditNote.balanceCents / 100,
        )}.`;
      } else {
        message = `Cash refund posted for ${amountFormatted}.`;
      }

      setSuccessMessage(message);
      setSubmitState("success");
      setSuccessDialogOpen(true);
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage(error instanceof Error ? error.message : "Unable to post refund");
    }
  };

  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">POS · Refunds</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Look up an invoice and return eligible items
        </h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Search by receipt number, select the items coming back, and decide whether to refund in cash or as
          store credit. Restockable products will flow back into inventory as soon as the return is posted.
        </p>
      </header>

      <form onSubmit={handleSearch} className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <PosCard
            title="Invoice lookup"
            subtitle="Scan or type the receipt number printed on the fiscal invoice"
            action={
              <button
                type="button"
                onClick={() => setIsPrinting(true)}
                disabled={!activeInvoice}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <Receipt className="h-3.5 w-3.5" /> Print duplicate
              </button>
            }
          >
            <div className="grid gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                    placeholder="INV-00000"
                  />
                </div>
                <button
                  type="button"
                  onClick={openHistoryDialog}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                  <Search className="h-4 w-4" /> Buscar
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800/80">
                  <Info className="h-3 w-3" /> Search covers the last 90 days
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800/80">
                  <Package className="h-3 w-3" /> Return window: 30 days
                </span>
              </div>
              {isLoading ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                  Looking up invoice...
                </p>
              ) : activeInvoice ? (
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:from-slate-900/70 dark:to-slate-950/80 dark:text-slate-300">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Invoice #{activeInvoice.invoice.invoiceNo ?? "(unassigned)"}</span>
                    <span>
                      {activeInvoice.invoice.createdAt
                        ? new Date(activeInvoice.invoice.createdAt).toLocaleString()
                        : "Unknown date"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{activeInvoice.invoice.customerName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Handled by user #{activeInvoice.invoice.userId}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/80">
                      {selectedCount} line{selectedCount === 1 ? "" : "s"} selected
                    </div>
                  </div>
                  {activeInvoice.policyFlags.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      {activeInvoice.policyFlags.map((flag) => (
                        <div key={flag} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> {flag}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2 pt-2 text-xs text-slate-500">
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Payments collected</p>
                    {activeInvoice.payments.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-slate-500 dark:border-slate-700 dark:bg-slate-900/60">
                        No payments recorded for this invoice.
                      </p>
                    ) : (
                      activeInvoice.payments.map((payment) => {
                        const methodLabel = payment.method.replace(/_/g, " ").toUpperCase();
                        return (
                          <div
                            key={`${payment.id}-${payment.method}-${payment.reference ?? ""}`}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60"
                          >
                            <span className="inline-flex items-center gap-2">
                              {payment.method === "cash" ? (
                                <DollarSign className="h-3.5 w-3.5" />
                              ) : payment.method === "card" ? (
                                <CreditCard className="h-3.5 w-3.5" />
                              ) : (
                                <Store className="h-3.5 w-3.5" />
                              )}
                              {methodLabel}
                            </span>
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {formatCurrency((payment.amountCents ?? 0) / 100)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : lookupError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50/70 p-6 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                  {lookupError}
                </p>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                  No invoice loaded. Enter a receipt number and search to begin.
                </p>
              )}
            </div>
          </PosCard>

          <PosCard
            title="Return items"
            subtitle="Select which lines are coming back and whether stock should be restocked"
            action={
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-300">
                <ClipboardList className="h-3.5 w-3.5" /> {selectedCount} selected
              </div>
            }
          >
            {activeInvoice ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Product</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Unit price</th>
                      <th className="px-4 py-3 text-right">ITBIS</th>
                      <th className="px-4 py-3 text-center">Restock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {activeInvoice.lines.map((line) => {
                      const key = String(line.orderItemId);
                      const selection = lineSelections[key] ?? { selected: false, restock: false, qty: line.qty };
                      
                      // Calculate unit price per unit (already includes ITBIS)
                      const unitPriceCents = line.unitPriceCents;
                      const unitPrice = unitPriceCents / 100;
                      
                      // Calculate ITBIS per unit for display (extract from price that includes tax)
                      const unitBreakdown = breakdownPriceWithTax(unitPriceCents, 0.18);
                      const unitTax = unitBreakdown.taxCents / 100;
                      
                      return (
                        <tr
                          key={line.orderItemId}
                          className={`bg-white transition dark:bg-slate-950/40 ${selection.selected ? "bg-sky-50/70 dark:bg-sky-500/10" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <label className="flex cursor-pointer items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selection.selected}
                                onChange={() => toggleSelection(line, "selected")}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                              />
                              <div>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{line.description ?? "Product"}</p>
                                {line.sku && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400">SKU {line.sku}</p>
                                )}
                                <p className="text-xs text-slate-400 dark:text-slate-500">Original qty: {line.qty}</p>
                              </div>
                            </label>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {selection.selected ? (
                              <input
                                type="number"
                                min="0"
                                max={line.qty}
                                value={selection.qty}
                                onChange={(e) => {
                                  const newQty = parseInt(e.target.value, 10) || 0;
                                  updateQuantity(line, newQty);
                                }}
                                className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                              />
                            ) : (
                              <span className="text-slate-600 dark:text-slate-300">{line.qty}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(unitPrice)}</td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(unitTax)}</td>
                          <td className="px-4 py-3 text-center text-xs">
                            <button
                              type="button"
                              disabled={!line.restockable}
                              onClick={() => toggleSelection(line, "restock")}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-800/60 ${
                                selection.restock && line.restockable
                                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400 dark:text-emerald-300"
                                  : "border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              } ${line.restockable ? "hover:border-emerald-400 hover:text-emerald-600" : "opacity-50"}`}
                            >
                              <ArrowLeftRight className="h-3 w-3" />
                              {line.restockable ? (selection.restock ? "Restocking" : "Restock") : "No restock"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                Find an invoice to list eligible return lines.
              </p>
            )}
          </PosCard>

          <PosCard
            title="Policy alerts"
            subtitle="Confirm the customer is eligible for a refund under store policy"
          >
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-3 rounded-xl border border-amber-200/70 bg-amber-50/60 p-4 text-xs leading-5 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                <BadgeInfo className="mt-0.5 h-4 w-4" /> Electronics require the manager to inspect serial numbers before
                restocking. Attach inspection photos if accessories are missing.
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-sky-200/70 bg-sky-50/70 p-4 text-xs leading-5 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200">
                <Info className="mt-0.5 h-4 w-4" /> Returns outside of 15 days must be issued as store credit even if
                original tender was cash.
              </div>
            </div>
          </PosCard>
        </div>

        <div className="space-y-6">
          <PosCard
            title="Refund summary"
            subtitle="Verify totals before issuing cash or credit"
            action={
              <button
                type="button"
                onClick={() => setIsPrinting(true)}
                disabled={!activeInvoice}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <Printer className="h-3.5 w-3.5" /> Preview credit note
              </button>
            }
          >
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <Package className="h-4 w-4" /> Items returned
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{totals.totalQty}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <Store className="h-4 w-4" /> Restocking
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totals.restockValueCents / 100)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <DollarSign className="h-4 w-4" /> Subtotal
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totals.subtotalCents / 100)}</span>
              </div>
              <div className="flex items-center justify-between text-sky-600 dark:text-sky-300">
                <span className="inline-flex items-center gap-2">
                  <Info className="h-4 w-4" /> ITBIS included
                </span>
                <span>{formatCurrency(totals.taxCents / 100)}</span>
              </div>
              <div className="flex items-center justify-between text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                <span>Total refund</span>
                <span>{formatCurrency(totals.totalCents / 100)}</span>
              </div>
              {refundMethod === "store_credit" ? (
                <p className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-3 text-xs leading-5 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                  Store credit will issue a credit note and update the customer&apos;s account balance immediately.
                </p>
              ) : (
                <p className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                  Ensure the drawer has sufficient cash before processing the payout.
                </p>
              )}
            </div>
          </PosCard>

          <PosCard title="Refund method" subtitle="Match policy and original tender when possible">
            <fieldset className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500/70">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="refund"
                    checked={refundMethod === "cash"}
                    onChange={() => setRefundMethod("cash")}
                    className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-100">Cash drawer</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Posts a paid-out movement when confirmed</p>
                  </div>
                </div>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500/70">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="refund"
                    checked={refundMethod === "store_credit"}
                    onChange={() => setRefundMethod("store_credit")}
                    className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-100">Store credit</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Generates a credit note and updates credit balance</p>
                  </div>
                </div>
                <Store className="h-4 w-4 text-sky-500" />
              </label>
            </fieldset>
          </PosCard>

          <PosCard title="Finalize refund" subtitle="Capture reason codes and manager approval">
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Reason code
                <select
                  value={reasonCode}
                  onChange={(event) => setReasonCode(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                >
                  <option>Wrong color / mismatch</option>
                  <option>Defective on arrival</option>
                  <option>Customer remorse</option>
                  <option>Accessory missing</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Notes for audit log
                <textarea
                  value={noteInput}
                  onChange={(event) => setNoteInput(event.target.value)}
                  className="mt-1 h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                  placeholder="Add context for the manager approval and inspection results"
                />
              </label>
              {submitMessage && (
                <p
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    submitState === "success"
                      ? "border-emerald-300 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : submitState === "error"
                      ? "border-rose-300 bg-rose-50/70 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
                      : "border-slate-200 bg-slate-50/70 text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"
                  }`}
                >
                  {submitMessage}
                </p>
              )}
              <button
                type="button"
                onClick={handlePostRefund}
                disabled={submitState === "submitting" || !activeInvoice}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2"
              >
                <CreditCard className="h-4 w-4" />
                {submitState === "submitting" ? "Posting refund..." : "Post refund"}
              </button>
            </div>
          </PosCard>
        </div>
      </form>
      </main>
      {isHistoryDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={closeHistoryDialog}
        >
          <div
            className="w-full max-w-3xl space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Buscar facturas recientes</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Selecciona un rango de fechas para revisar recibos emitidos recientemente y elige la factura correcta.
                </p>
              </div>
              <button
                type="button"
                onClick={closeHistoryDialog}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Cerrar historial de facturas"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
                Desde
                <input
                  type="date"
                  value={historyStartDate}
                  max={historyEndDate}
                  onChange={(event) => setHistoryStartDate(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
                Hasta
                <input
                  type="date"
                  value={historyEndDate}
                  min={historyStartDate}
                  onChange={(event) => setHistoryEndDate(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="md:col-span-2 flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
                Número de factura o cliente (opcional)
                <input
                  type="search"
                  value={historyQuery}
                  onChange={(event) => setHistoryQuery(event.target.value)}
                  placeholder="Ej. FAC-0001 o Ana"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">El historial muestra hasta 25 facturas en el rango seleccionado.</p>
              <button
                type="button"
                onClick={loadInvoiceHistory}
                className="inline-flex items-center gap-2 rounded-lg border border-sky-500/70 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-500 hover:text-sky-600 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100 dark:hover:border-sky-400/80 dark:hover:text-white"
              >
                {historyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar facturas
              </button>
            </div>

            {historyError ? (
              <div className="rounded-lg border border-rose-300/70 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {historyError}
              </div>
            ) : null}

            <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-inner dark:border-slate-800 dark:bg-slate-950/40">
              {historyLoading && historyResults.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando facturas...
                </div>
              ) : historyResults.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  No se encontraron facturas en el rango seleccionado.
                </div>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {historyResults.map((invoice) => {
                    const createdAt = invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : "Fecha desconocida";
                    return (
                      <li key={`${invoice.id}-${invoice.invoiceNo ?? "unknown"}`}>
                        <button
                          type="button"
                          onClick={() => void handleSelectHistoryInvoice(invoice)}
                          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {invoice.invoiceNo ?? `Factura #${invoice.id}`}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{invoice.customerName ?? "Sin cliente"}</p>
                          </div>
                          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                            <p>{createdAt}</p>
                            <p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(invoice.totalCents / 100)}</p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {isSuccessDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={resetPage}
        >
          <div
            className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-500/20">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-emerald-600 dark:text-emerald-300">Refund Successful</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {successMessage ?? "The refund has been processed successfully."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetPage}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Close success dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={resetPage}
                className="rounded-lg border border-emerald-500/70 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-500/25 dark:border-emerald-500/60 dark:bg-emerald-500/20 dark:text-emerald-100 dark:hover:border-emerald-400/80 dark:hover:bg-emerald-500/30"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
