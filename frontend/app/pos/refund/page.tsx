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

type InvoiceLine = {
  id: string;
  sku: string;
  description: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  condition: "new" | "used" | "damaged";
  restockable: boolean;
};

type InvoicePayment = {
  method: "cash" | "card" | "transfer" | "store_credit";
  reference?: string;
  amount: number;
};

type Invoice = {
  id: string;
  number: string;
  customer: string;
  createdAt: string;
  clerk: string;
  lines: InvoiceLine[];
  payments: InvoicePayment[];
  policyFlags: string[];
};

const invoices: Invoice[] = [
  {
    id: "inv-10245",
    number: "INV-10245",
    customer: "Carlos Rodriguez",
    createdAt: "2024-06-18 14:22",
    clerk: "Maria P.",
    policyFlags: ["Within 15 day window", "ITBIS included"],
    lines: [
      {
        id: "line-1",
        sku: "MB-2100",
        description: "Red Note Laser · 128GB",
        qty: 1,
        unitPrice: 18500,
        taxRate: 0.18,
        condition: "used",
        restockable: true
      },
      {
        id: "line-2",
        sku: "HD-3019",
        description: "Retro Wave Headphones",
        qty: 1,
        unitPrice: 9200,
        taxRate: 0.18,
        condition: "new",
        restockable: true
      },
      {
        id: "line-3",
        sku: "WT-4413",
        description: "Times Track Silver",
        qty: 1,
        unitPrice: 14500,
        taxRate: 0.18,
        condition: "damaged",
        restockable: false
      }
    ],
    payments: [
      { method: "card", amount: 32000, reference: "AUTH-783202" },
      { method: "cash", amount: 10200 }
    ]
  }
];

type LineSelection = {
  selected: boolean;
  restock: boolean;
};

const DEFAULT_LOOKUP = invoices[0];

export default function PosRefundPage() {
  const [search, setSearch] = useState(DEFAULT_LOOKUP.number);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(DEFAULT_LOOKUP);
  const [lineSelections, setLineSelections] = useState<Record<string, LineSelection>>({});
  const [refundMethod, setRefundMethod] = useState<"cash" | "store_credit">("cash");
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (!activeInvoice) {
      setLineSelections({});
      return;
    }
    setLineSelections(() => {
      return activeInvoice.lines.reduce<Record<string, LineSelection>>((acc, line) => {
        acc[line.id] = {
          selected: line.condition !== "damaged",
          restock: line.restockable
        };
        return acc;
      }, {});
    });
  }, [activeInvoice?.id]);

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
        subtotal: 0,
        tax: 0,
        refundTotal: 0,
        restockCount: 0,
        restockValue: 0
      };
    }
    return activeInvoice.lines.reduce(
      (acc, line) => {
        const selection = lineSelections[line.id];
        if (!selection?.selected) return acc;
        const lineSubtotal = line.unitPrice * line.qty;
        const lineTax = lineSubtotal * line.taxRate;
        acc.subtotal += lineSubtotal;
        acc.tax += lineTax;
        acc.refundTotal += lineSubtotal + lineTax;
        if (selection.restock && line.restockable) {
          acc.restockCount += 1;
          acc.restockValue += lineSubtotal;
        }
        return acc;
      },
      { subtotal: 0, tax: 0, refundTotal: 0, restockCount: 0, restockValue: 0 }
    );
  }, [activeInvoice, lineSelections]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = invoices.find((invoice) => invoice.number === search.trim().toUpperCase());
    setActiveInvoice(result ?? null);
  };

  const toggleSelection = (line: InvoiceLine, field: keyof LineSelection) => {
    setLineSelections((prev) => {
      const current = prev[line.id] ?? { selected: false, restock: false };
      if (field === "restock" && !line.restockable) {
        return prev;
      }
      return {
        ...prev,
        [line.id]: {
          ...current,
          [field]: field === "restock" ? !current.restock : !current.selected
        }
      };
    });
  };

  const selectedCount = useMemo(() => {
    return Object.values(lineSelections).filter((value) => value.selected).length;
  }, [lineSelections]);

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
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
              {activeInvoice ? (
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:from-slate-900/70 dark:to-slate-950/80 dark:text-slate-300">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Invoice #{activeInvoice.number}</span>
                    <span>{activeInvoice.createdAt}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{activeInvoice.customer}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Handled by {activeInvoice.clerk}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/80">
                      {selectedCount} line{selectedCount === 1 ? "" : "s"} selected
                    </div>
                  </div>
                  <div className="space-y-2 text-xs text-slate-500">
                    {activeInvoice.policyFlags.map((flag) => (
                      <div key={flag} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> {flag}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 pt-2 text-xs text-slate-500">
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Payments collected</p>
                    {activeInvoice.payments.map((payment) => (
                      <div key={`${payment.method}-${payment.reference ?? payment.amount}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60">
                        <span className="inline-flex items-center gap-2">
                          {payment.method === "cash" ? (
                            <DollarSign className="h-3.5 w-3.5" />
                          ) : payment.method === "card" ? (
                            <CreditCard className="h-3.5 w-3.5" />
                          ) : (
                            <Store className="h-3.5 w-3.5" />
                          )}
                          {payment.method.replace("_", " ").toUpperCase()}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                  No invoice found. Verify the receipt number or switch to manual refund mode.
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
                      <th className="px-4 py-3 text-left">Line</th>
                      <th className="px-4 py-3 text-left">Condition</th>
                      <th className="px-4 py-3 text-right">Unit price</th>
                      <th className="px-4 py-3 text-right">ITBIS</th>
                      <th className="px-4 py-3 text-center">Restock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {activeInvoice.lines.map((line) => {
                      const selection = lineSelections[line.id] ?? { selected: false, restock: false };
                      const lineSubtotal = line.unitPrice * line.qty;
                      const lineTax = lineSubtotal * line.taxRate;
                      return (
                        <tr
                          key={line.id}
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
                                <p className="font-medium text-slate-900 dark:text-slate-100">{line.description}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">SKU {line.sku}</p>
                              </div>
                            </label>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                            {line.condition === "damaged" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-rose-500 dark:bg-rose-500/10 dark:text-rose-200">
                                <AlertTriangle className="h-3 w-3" /> Damaged
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                                <ShieldCheck className="h-3 w-3" /> {line.condition === "new" ? "New" : "Used"}
                              </span>
                            )}
                          </td>
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
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
                <span className="text-xs text-slate-500">{totals.restockCount} lines · {formatCurrency(totals.restockValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <DollarSign className="h-4 w-4" /> Subtotal
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sky-600 dark:text-sky-300">
                <span className="inline-flex items-center gap-2">
                  <Info className="h-4 w-4" /> ITBIS included
                </span>
                <span>{formatCurrency(totals.tax)}</span>
              </div>
              <div className="flex items-center justify-between text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                <span>Total refund</span>
                <span>{formatCurrency(totals.refundTotal)}</span>
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
                <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60">
                  <option>Wrong color / mismatch</option>
                  <option>Defective on arrival</option>
                  <option>Customer remorse</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Notes for audit log
                <textarea
                  className="mt-1 h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                  placeholder="Add context for the manager approval and inspection results"
                />
              </label>
              <p className="flex items-start gap-2 rounded-xl border border-rose-200/70 bg-rose-50/70 p-3 text-xs leading-5 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4" /> Refunds above RD$25,000 require manager PIN entry and capture of the
                customer's signature.
              </p>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2"
              >
                <CreditCard className="h-4 w-4" /> Post refund
              </button>
            </div>
          </PosCard>
        </div>
      </form>
    </main>
  );
}
