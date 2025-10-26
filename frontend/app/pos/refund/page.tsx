"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, CheckCircle2, FileSearch, Loader2, RefreshCcw, ShieldAlert } from "lucide-react";

import type { InvoiceLookupItem, InvoiceLookupResult, RefundMethod } from "@/components/pos/types";
import { createRefund, fetchInvoiceDetails } from "@/lib/pos-client";
import { formatCurrencyFromCents } from "@/lib/utils";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: InvoiceLookupResult };

type SubmissionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

type Condition = "new" | "used" | "damaged";

type SelectedQtyMap = Record<number, number>;

const REFUND_CONDITIONS: { value: Condition; label: string; description: string }[] = [
  {
    value: "new",
    label: "New",
    description: "Factory sealed or unused — restock as sellable inventory."
  },
  {
    value: "used",
    label: "Used",
    description: "Opened but functional — restock with inspection tag."
  },
  {
    value: "damaged",
    label: "Damaged",
    description: "Broken or incomplete — skip restock and escalate."
  }
];

const REFUND_METHOD_OPTIONS: { value: RefundMethod; label: string; helper: string }[] = [
  {
    value: "cash",
    label: "Cash refund",
    helper: "Return to drawer and capture in the shift log."
  },
  {
    value: "store_credit",
    label: "Store credit",
    helper: "Issue a credit note tied to the customer profile."
  }
];

function calculateUnitPriceCents(item: InvoiceLookupItem) {
  if (item.refundable.qty <= 0) {
    return 0;
  }

  const base = item.refundable.cents / item.refundable.qty;
  return Math.round(base);
}

function buildSelectedLines(
  items: InvoiceLookupItem[],
  selectedQty: SelectedQtyMap
): { orderItemId: number; qty: number; refundCents: number }[] {
  const result: { orderItemId: number; qty: number; refundCents: number }[] = [];

  for (const item of items) {
    const qty = selectedQty[item.id];
    if (!qty || qty <= 0) {
      continue;
    }

    const clampedQty = Math.min(qty, item.refundable.qty);
    const unitPriceCents = calculateUnitPriceCents(item);
    const computed = Math.round(unitPriceCents * clampedQty);
    const refundCents = Math.min(computed, item.refundable.cents);

    if (refundCents > 0) {
      result.push({
        orderItemId: item.id,
        qty: clampedQty,
        refundCents
      });
    }
  }

  return result;
}

export default function POSRefundPage() {
  const [invoiceInput, setInvoiceInput] = useState("");
  const [lookupState, setLookupState] = useState<LookupState>({ status: "idle" });
  const [selectedQuantities, setSelectedQuantities] = useState<SelectedQtyMap>({});
  const [condition, setCondition] = useState<Condition>("used");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("cash");
  const [reason, setReason] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>({ status: "idle" });

  const lookupData = lookupState.status === "success" ? lookupState.data : null;

  const selectedLines = useMemo(() => {
    if (!lookupData) {
      return [] as ReturnType<typeof buildSelectedLines>;
    }

    return buildSelectedLines(lookupData.items, selectedQuantities);
  }, [lookupData, selectedQuantities]);

  const selectedTotals = useMemo(() => {
    let totalCents = 0;
    let totalQty = 0;

    for (const line of selectedLines) {
      totalCents += line.refundCents;
      totalQty += line.qty;
    }

    return { totalCents, totalQty };
  }, [selectedLines]);

  const policyAlerts = useMemo(() => {
    const alerts: { type: "info" | "warning" | "success"; message: string }[] = [];

    if (!lookupData) {
      alerts.push({
        type: "info",
        message: "Search an invoice to review refundable lines and policy eligibility."
      });
      return alerts;
    }

    if (lookupData.totals.refundableCents <= 0) {
      alerts.push({
        type: "warning",
        message: "This invoice has already been fully refunded. No refundable balance remains."
      });
    }

    const exhaustedLines = lookupData.items.filter((item) => item.refundable.qty === 0).length;
    if (exhaustedLines > 0) {
      alerts.push({
        type: "info",
        message: `${exhaustedLines} line${exhaustedLines === 1 ? " has" : "s have"} already been fully refunded.`
      });
    }

    if (refundMethod === "store_credit" && !lookupData.order.customerId) {
      alerts.push({
        type: "warning",
        message: "Store credit requires the sale to be linked to a customer profile."
      });
    }

    if (condition === "damaged") {
      alerts.push({
        type: "info",
        message: "Damaged returns will skip restock and should be set aside for inspection."
      });
    }

    if (selectedTotals.totalCents > 0) {
      alerts.push({
        type: "success",
        message: `Ready to refund ${formatCurrencyFromCents(selectedTotals.totalCents)} across ${selectedTotals.totalQty} item${
          selectedTotals.totalQty === 1 ? "" : "s"
        }.`
      });
    }

    return alerts;
  }, [condition, lookupData, refundMethod, selectedTotals.totalCents, selectedTotals.totalQty]);

  const lookupError = lookupState.status === "error" ? lookupState.message : null;
  const submissionError = submissionState.status === "error" ? submissionState.message : null;
  const submissionSuccess = submissionState.status === "success" ? submissionState.message : null;

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = invoiceInput.trim();

    if (!value) {
      setLookupState({ status: "error", message: "Provide an invoice number to continue." });
      return;
    }

    setLookupState({ status: "loading" });
    setSubmissionState({ status: "idle" });

    try {
      const data = await fetchInvoiceDetails(value);
      setLookupState({ status: "success", data });
      setSelectedQuantities({});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to find the invoice.";
      setLookupState({ status: "error", message });
    }
  }

  function toggleLine(item: InvoiceLookupItem, checked: boolean) {
    setSelectedQuantities((previous) => {
      const next: SelectedQtyMap = { ...previous };
      if (!checked) {
        delete next[item.id];
        return next;
      }

      const defaultQty = Math.min(1, Math.max(item.refundable.qty, 0));
      if (defaultQty <= 0) {
        return next;
      }

      next[item.id] = defaultQty;
      return next;
    });
  }

  function updateQuantity(item: InvoiceLookupItem, rawValue: string) {
    const parsed = Number.parseInt(rawValue, 10);

    setSelectedQuantities((previous) => {
      const next: SelectedQtyMap = { ...previous };

      if (!Number.isFinite(parsed) || parsed <= 0) {
        delete next[item.id];
        return next;
      }

      const clamped = Math.min(parsed, item.refundable.qty);
      if (clamped <= 0) {
        delete next[item.id];
        return next;
      }

      next[item.id] = clamped;
      return next;
    });
  }

  async function handleSubmitRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!lookupData) {
      return;
    }

    const lines = buildSelectedLines(lookupData.items, selectedQuantities);
    if (lines.length === 0) {
      setSubmissionState({ status: "error", message: "Select at least one line to refund." });
      return;
    }

    if (refundMethod === "store_credit" && !lookupData.order.customerId) {
      setSubmissionState({
        status: "error",
        message: "This sale is not linked to a customer, so store credit cannot be issued."
      });
      return;
    }

    setSubmissionState({ status: "submitting" });

    try {
      const payload = {
        invoiceNo: lookupData.invoice.invoiceNo,
        condition,
        refundMethod,
        reason: reason.trim() ? reason.trim() : null,
        items: lines
      } as const;

      const result = await createRefund(payload);
      const confirmationMessage = `Refund ${result.salesReturn.id} recorded for ${formatCurrencyFromCents(
        result.salesReturn.totalRefundCents
      )}.`;
      setSubmissionState({ status: "success", message: confirmationMessage });
      setSelectedQuantities({});

      try {
        const refreshed = await fetchInvoiceDetails(lookupData.invoice.invoiceNo);
        setLookupState({ status: "success", data: refreshed });
      } catch (refreshError) {
        const message = refreshError instanceof Error ? refreshError.message : "";
        setLookupState({
          status: "error",
          message: message || "Refund saved but invoice refresh failed. Reload to continue."
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit the refund.";
      setSubmissionState({ status: "error", message });
    }
  }

  const submitting = submissionState.status === "submitting";
  const disableStoreCredit = lookupData ? !lookupData.order.customerId : true;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Refunds</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          Process returns with policy controls
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Look up invoices, select eligible lines, and finalize the refund method while policy alerts
          surface any conditions that require escalation.
        </p>
      </header>

      <form
        onSubmit={handleLookup}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="flex w-full flex-col gap-2 md:max-w-sm">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Invoice number</span>
            <input
              value={invoiceInput}
              onChange={(event) => setInvoiceInput(event.target.value.toUpperCase())}
              placeholder="INV-000000"
              autoComplete="off"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium uppercase tracking-wide text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-slate-700"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={lookupState.status === "loading"}
          >
            {lookupState.status === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching
              </>
            ) : (
              <>
                <FileSearch className="h-4 w-4" />
                Lookup invoice
              </>
            )}
          </button>
        </div>
        {lookupError ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{lookupError}</p>
        ) : null}
      </form>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Invoice lines</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Toggle eligible lines and capture the quantity being returned.
                </p>
              </div>
              {lookupState.status === "loading" ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : null}
            </header>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-3">Return</th>
                    <th className="px-6 py-3">Item</th>
                    <th className="px-6 py-3">Sold</th>
                    <th className="px-6 py-3">Refundable</th>
                    <th className="px-6 py-3">Qty to refund</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {lookupData && lookupData.items.length > 0 ? (
                    lookupData.items.map((item) => {
                      const selectedQty = selectedQuantities[item.id] ?? 0;
                      const unitPrice = calculateUnitPriceCents(item);
                      const refundCents = selectedLines.find((line) => line.orderItemId === item.id)?.refundCents ?? 0;
                      const disabled = item.refundable.qty <= 0;

                      return (
                        <tr key={item.id} className="bg-white dark:bg-slate-950">
                          <td className="px-6 py-4">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-900"
                                checked={selectedQty > 0}
                                disabled={disabled}
                                onChange={(event) => toggleLine(item, event.target.checked)}
                              />
                              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                {disabled ? "N/A" : "Select"}
                              </span>
                            </label>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <p className="font-medium text-slate-900 dark:text-slate-100">{item.product.name ?? "Unnamed item"}</p>
                              <p className="text-xs text-slate-500">{item.product.code ?? "Code pending"}</p>
                              <p className="text-xs text-slate-500">SKU: {item.product.sku ?? "—"}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                            <div className="space-y-1">
                              <p>{item.qty} units</p>
                              <p className="text-xs text-slate-500">{formatCurrencyFromCents(item.totalCents)}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                            <div className="space-y-1">
                              <p>{item.refundable.qty} units</p>
                              <p className="text-xs text-slate-500">
                                {formatCurrencyFromCents(item.refundable.cents)} remaining
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {selectedQty > 0 ? (
                              <input
                                type="number"
                                min={1}
                                max={item.refundable.qty}
                                step={1}
                                value={selectedQty}
                                onChange={(event) => updateQuantity(item, event.target.value)}
                                className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              />
                            ) : (
                              <span className="text-xs uppercase tracking-wide text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                            {selectedQty > 0 ? (
                              <div className="space-y-1">
                                <p>{formatCurrencyFromCents(refundCents)}</p>
                                <p className="text-xs font-normal text-slate-500">
                                  {formatCurrencyFromCents(unitPrice)} ea.
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs uppercase tracking-wide text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                        {lookupState.status === "loading"
                          ? "Fetching invoice details..."
                          : "Look up an invoice to list eligible lines."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <header className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Policy alerts</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Review eligibility warnings before completing the refund.
              </p>
            </header>
            <ul className="space-y-3 px-6 py-4">
              {policyAlerts.map((alert, index) => {
                const Icon = alert.type === "warning" ? AlertTriangle : alert.type === "success" ? CheckCircle2 : ShieldAlert;
                const colorClass =
                  alert.type === "warning"
                    ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-500/10 dark:text-amber-200"
                    : alert.type === "success"
                    ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-200"
                    : "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200";

                return (
                  <li key={`${alert.message}-${index}`} className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${colorClass}`}>
                    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{alert.message}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <form
          onSubmit={handleSubmitRefund}
          className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Totals</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Confirm the refund amount and method before finalizing.
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
            <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>Refundable balance</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {lookupData ? formatCurrencyFromCents(lookupData.totals.refundableCents) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>Already refunded</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {lookupData ? formatCurrencyFromCents(lookupData.totals.refundedCents) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between text-base font-semibold text-slate-900 dark:text-slate-100">
              <span>Refund due</span>
              <span>{formatCurrencyFromCents(selectedTotals.totalCents)}</span>
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-200">Item condition</legend>
            <div className="space-y-3">
              {REFUND_CONDITIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                    condition === option.value
                      ? "border-slate-900 bg-slate-900/5 text-slate-900 dark:border-slate-100 dark:bg-slate-100/10 dark:text-slate-100"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="condition"
                    value={option.value}
                    checked={condition === option.value}
                    onChange={() => setCondition(option.value)}
                    className="mt-1 h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-900"
                  />
                  <span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{option.label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-800 dark:text-slate-200">Refund method</legend>
            <div className="space-y-3">
              {REFUND_METHOD_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                    refundMethod === option.value
                      ? "border-slate-900 bg-slate-900/5 text-slate-900 dark:border-slate-100 dark:bg-slate-100/10 dark:text-slate-100"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  } ${
                    option.value === "store_credit" && disableStoreCredit
                      ? "cursor-not-allowed opacity-50"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="refundMethod"
                    value={option.value}
                    checked={refundMethod === option.value}
                    onChange={() => setRefundMethod(option.value)}
                    disabled={option.value === "store_credit" && disableStoreCredit}
                    className="mt-1 h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-900"
                  />
                  <span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{option.label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{option.helper}</span>
                    {option.value === "store_credit" && disableStoreCredit ? (
                      <span className="mt-1 block text-xs font-semibold text-amber-600 dark:text-amber-400">
                        Requires a customer on the original sale.
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Refund reason</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Optional note for the credit memo or audit trail"
              className="resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          {submissionError ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500 dark:bg-red-500/10 dark:text-red-200">
              <AlertTriangle className="h-4 w-4" />
              <span>{submissionError}</span>
            </div>
          ) : null}

          {submissionSuccess ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-400 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              <span>{submissionSuccess}</span>
            </div>
          ) : null}

          <button
            type="submit"
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-400"
            disabled={
              submitting ||
              selectedLines.length === 0 ||
              selectedTotals.totalCents <= 0 ||
              (refundMethod === "store_credit" && disableStoreCredit)
            }
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {submitting ? "Posting refund" : "Finalize refund"}
          </button>
        </form>
      </section>
    </div>
  );
}
