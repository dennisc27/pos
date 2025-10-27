"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeInfo,
  ClipboardList,
  CreditCard,
  DollarSign,
  Info,
  Package,
  Printer,
  Receipt,
  Search,
  ShieldCheck,
  Store
} from "lucide-react";

import { PosCard } from "@/components/pos/pos-card";
import { formatCurrency } from "@/components/pos/utils";

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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
        };
        return acc;
      }, {}),
    );
  }, [activeInvoice?.invoice.id]);

  useEffect(() => {
    setSubmitState("idle");
    setSubmitMessage(null);
  }, [refundMethod, activeInvoice?.invoice.id]);

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
        subtotalCents: 0,
        taxCents: 0,
        totalCents: 0,
        restockCount: 0,
        restockValueCents: 0,
      };
    }

    return activeInvoice.lines.reduce(
      (acc, line) => {
        const selection = lineSelections[String(line.orderItemId)];
        if (!selection?.selected) {
          return acc;
        }

        acc.subtotalCents += line.subtotalCents;
        acc.taxCents += line.taxCents;
        acc.totalCents += line.totalCents;

        if (selection.restock && line.restockable) {
          acc.restockCount += 1;
          acc.restockValueCents += line.subtotalCents;
        }

        return acc;
      },
      { subtotalCents: 0, taxCents: 0, totalCents: 0, restockCount: 0, restockValueCents: 0 },
    );
  }, [activeInvoice, lineSelections]);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = search.trim();
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

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Unable to find invoice ${trimmed}`);
      }

      const data = (await response.json()) as InvoiceDetail;
      setActiveInvoice(data);
      setSearch(data.invoice.invoiceNo ?? trimmed.toUpperCase());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to look up invoice";
      setLookupError(message);
      setActiveInvoice(null);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (line: ApiInvoiceLine, field: keyof RefundLineSelection) => {
    setLineSelections((prev) => {
      const key = String(line.orderItemId);
      const current = prev[key] ?? { selected: false, restock: false };

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

  const selectedCount = useMemo(() => {
    return Object.values(lineSelections).filter((value) => value.selected).length;
  }, [lineSelections]);

  const handlePostRefund = async () => {
    if (!activeInvoice) {
      setSubmitState("error");
      setSubmitMessage("Look up an invoice before posting a refund.");
      return;
    }

    const selectedLines = activeInvoice.lines.filter((line) => lineSelections[String(line.orderItemId)]?.selected);

    if (selectedLines.length === 0) {
      setSubmitState("error");
      setSubmitMessage("Select at least one line item to refund.");
      return;
    }

    setSubmitState("submitting");
    setSubmitMessage("Posting refund...");

    try {
      const payload = {
        invoiceNo: activeInvoice.invoice.invoiceNo,
        method: refundMethod,
        lines: selectedLines.map((line) => ({
          orderItemId: line.orderItemId,
          qty: line.qty,
          restock: Boolean(lineSelections[String(line.orderItemId)]?.restock && line.restockable),
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

      const amountFormatted = formatCurrency(data.totals.totalCents / 100);
      if (refundMethod === "store_credit" && data.creditNote) {
        setSubmitMessage(
          `Store credit refund posted. Credit note #${data.creditNote.id} balance: ${formatCurrency(
            data.creditNote.balanceCents / 100,
          )}.`,
        );
      } else {
        setSubmitMessage(`Cash refund posted for ${amountFormatted}.`);
      }

      setSubmitState("success");
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage(error instanceof Error ? error.message : "Unable to post refund");
    }
  };

  return (
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
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                  placeholder="INV-00000"
                />
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
                      const selection = lineSelections[key] ?? { selected: false, restock: false };
                      const lineSubtotal = line.subtotalCents / 100;
                      const lineTax = line.taxCents / 100;
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
                              </div>
                            </label>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{line.qty}</td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(lineSubtotal)}</td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(lineTax)}</td>
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
                <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <Store className="h-4 w-4" /> Restocking
                </span>
                <span className="text-xs text-slate-500">{totals.restockCount} lines · {formatCurrency(totals.restockValueCents / 100)}</span>
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
                  Store credit will issue a credit note and update the customer's account balance immediately.
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
              <p className="flex items-start gap-2 rounded-xl border border-rose-200/70 bg-rose-50/70 p-3 text-xs leading-5 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4" /> Refunds above RD$25,000 require manager PIN entry and capture of the
                customer's signature.
              </p>
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
  );
}
