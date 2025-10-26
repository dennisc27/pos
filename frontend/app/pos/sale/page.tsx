"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Landmark,
  Loader2,
  PenSquare,
  Plus,
  ScanLine,
  Trash2,
  Wallet,
  X
} from "lucide-react";

import {
  type CartLine,
  type PriceOverrideApproval,
  type SaleSummary,
  type TenderBreakdown,
  type ValidatedOrder
} from "@/components/pos/types";
import { formatCurrency, fromCents, toCents } from "@/components/pos/utils";
import { requestPriceOverride, searchProducts, validateOrder } from "@/lib/pos-client";

const DEFAULT_BRANCH_ID = 1;
const DEFAULT_TAX_RATE = 0.18;
const DISCOUNT_OVERRIDE_THRESHOLD = 0.1; // 10%

const TENDER_OPTIONS = [
  { value: "cash", label: "Cash drawer", icon: Wallet },
  { value: "card", label: "Card (Azul)", icon: CreditCard },
  { value: "transfer", label: "Bank transfer", icon: Landmark },
  { value: "store_credit", label: "Store credit", icon: PenSquare },
  { value: "gift", label: "Gift card", icon: PenSquare }
] as const;

type TenderMethod = (typeof TENDER_OPTIONS)[number]["value"];

type TenderLine = TenderBreakdown & { method: TenderMethod };

type ValidationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; payload: ValidatedOrder }
  | { status: "error"; message: string };

type OverrideRequest = { lineId: string; nextPrice: number };

type TenderDraft = {
  method: TenderMethod;
  amount: string;
  reference: string;
};

type OverrideDraft = {
  managerId: string;
  pin: string;
  reason: string;
};

function buildSummary(cartLines: CartLine[], tenderLines: TenderLine[]): SaleSummary {
  const subtotal = cartLines.reduce(
    (sum, line) => sum + (line.listPrice ?? line.price) * line.qty,
    0
  );
  const total = cartLines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const discounts = Math.max(0, subtotal - total);
  const tax = cartLines.reduce((sum, line) => {
    const lineTotal = line.price * line.qty;
    const rate = line.taxRate ?? DEFAULT_TAX_RATE;
    const net = lineTotal / (1 + rate);
    return sum + Math.max(lineTotal - net, 0);
  }, 0);
  const tendered = tenderLines.reduce((sum, tender) => sum + tender.amount, 0);
  const nonCashTendered = tenderLines
    .filter((tender) => tender.method !== "cash")
    .reduce((sum, tender) => sum + tender.amount, 0);
  const balanceDue = Math.max(total - tendered, 0);
  const changeDue = Math.max(tendered - total, 0);
  const cashDue = Math.max(total - nonCashTendered, 0);

  return {
    subtotal,
    discounts,
    tax,
    total,
    balanceDue,
    cashDue,
    nonCashTendered,
    tendered,
    changeDue
  };
}

function createLineFromSearch(product: Awaited<ReturnType<typeof searchProducts>>[number]): CartLine {
  const displayPrice = fromCents(product.priceCents);
  return {
    id: product.versionId ? String(product.versionId) : `product-${product.id}`,
    productCodeId: product.id,
    productCodeVersionId: product.versionId ?? undefined,
    code: product.code,
    name: product.name,
    sku: product.sku ?? product.code,
    qty: 1,
    price: displayPrice,
    listPrice: displayPrice,
    taxRate: DEFAULT_TAX_RATE,
    override: null
  };
}

function hasManagerOverride(line: CartLine, nextPrice: number) {
  const listUnit = line.listPrice ?? line.price;
  if (listUnit <= 0) {
    return false;
  }

  const discountRatio = (listUnit - nextPrice) / listUnit;
  return discountRatio > DISCOUNT_OVERRIDE_THRESHOLD;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export default function PosSalePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "error">("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Awaited<ReturnType<typeof searchProducts>>>([]);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [tenderLines, setTenderLines] = useState<TenderLine[]>([]);
  const [pendingTender, setPendingTender] = useState<{ tenderId: string | null; draft: TenderDraft } | null>(null);
  const [pendingOverride, setPendingOverride] = useState<OverrideRequest | null>(null);
  const [overrideDraft, setOverrideDraft] = useState<OverrideDraft>({ managerId: "", pin: "", reason: "" });
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [validationState, setValidationState] = useState<ValidationState>({ status: "idle" });

  const summary = useMemo(() => buildSummary(cartLines, tenderLines), [cartLines, tenderLines]);
  const changeDueDisplay = summary.changeDue > 0 ? summary.changeDue : 0;

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setSearchStatus("idle");
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    setSearchStatus("loading");
    setSearchError(null);

    const debounce = setTimeout(() => {
      searchProducts(searchTerm, {
        signal: controller.signal,
        limit: 12,
        branchId: DEFAULT_BRANCH_ID
      })
        .then((results) => {
          setSearchResults(results);
          setSearchStatus("idle");
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }
          setSearchStatus("error");
          setSearchError(error instanceof Error ? error.message : "Unable to search inventory");
        });
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(debounce);
    };
  }, [searchTerm]);

  useEffect(() => {
    setValidationState((state) => (state.status === "idle" ? state : { status: "idle" }));
  }, [cartLines, tenderLines]);

  const handleAddProduct = (product: Awaited<ReturnType<typeof searchProducts>>[number]) => {
    if (!product.versionId) {
      setSearchError("Selected item does not have an active version for this branch.");
      return;
    }

    const line = createLineFromSearch(product);
    setCartLines((previous) => {
      const existing = previous.find((item) => item.id === line.id);
      if (existing) {
        return previous.map((item) =>
          item.id === line.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...previous, line];
    });
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!searchTerm.trim()) {
      return;
    }

    searchProducts(searchTerm, { limit: 1, branchId: DEFAULT_BRANCH_ID })
      .then((results) => {
        if (results[0]) {
          handleAddProduct(results[0]);
          setSearchTerm("");
        } else {
          setSearchError("No inventory matches were found for the provided code.");
        }
      })
      .catch((error) => {
        setSearchError(error instanceof Error ? error.message : "Unable to search inventory");
      });
  };

  const handleUpdateQuantity = (lineId: string, qty: number) => {
    setCartLines((previous) =>
      previous.map((item) => (item.id === lineId ? { ...item, qty: Math.max(1, qty) } : item))
    );
  };

  const handleRemoveLine = (lineId: string) => {
    setCartLines((previous) => previous.filter((item) => item.id !== lineId));
  };

  const handleRequestPriceChange = (lineId: string, nextPrice: number) => {
    const sanitizedPrice = Number.isFinite(nextPrice) ? Math.max(0, nextPrice) : 0;
    if (sanitizedPrice <= 0) {
      return;
    }

    const line = cartLines.find((item) => item.id === lineId);
    if (!line) {
      return;
    }

    if (hasManagerOverride(line, sanitizedPrice) && !line.override) {
      setPendingOverride({ lineId, nextPrice: sanitizedPrice });
      setOverrideDraft({ managerId: "", pin: "", reason: "" });
      setOverrideError(null);
      return;
    }

    setCartLines((previous) =>
      previous.map((item) =>
        item.id === lineId
          ? {
              ...item,
              price: sanitizedPrice,
              override: hasManagerOverride(item, sanitizedPrice)
                ? item.override ?? null
                : null
            }
          : item
      )
    );
  };

  const handleOpenTenderModal = (tenderId: string | null = null) => {
    const draft: TenderDraft = tenderId
      ? (() => {
          const existing = tenderLines.find((item) => item.id === tenderId);
          return {
            method: existing?.method ?? "cash",
            amount: existing ? existing.amount.toFixed(2) : summary.balanceDue.toFixed(2),
            reference: existing?.reference ?? ""
          };
        })()
      : {
          method: "cash",
          amount: summary.balanceDue > 0 ? summary.balanceDue.toFixed(2) : "0.00",
          reference: ""
        };

    setPendingTender({ tenderId, draft });
  };

  const handleTenderDraftChange = (field: keyof TenderDraft, value: string) => {
    setPendingTender((previous) =>
      previous
        ? {
            ...previous,
            draft: {
              ...previous.draft,
              [field]: value
            }
          }
        : previous
    );
  };

  const handleSubmitTender = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingTender) {
      return;
    }

    const { tenderId, draft } = pendingTender;
    const normalizedAmount = Number.parseFloat(draft.amount.replace(/,/g, ""));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return;
    }

    const amount = draft.method === "cash" ? normalizedAmount : Math.min(normalizedAmount, summary.balanceDue || normalizedAmount);
    const reference = draft.reference.trim();

    if (tenderId) {
      setTenderLines((previous) =>
        previous.map((item) =>
          item.id === tenderId
            ? { ...item, method: draft.method, amount, reference: reference || undefined }
            : item
        )
      );
    } else {
      setTenderLines((previous) => [
        ...previous,
        {
          id: `tender-${Date.now()}`,
          method: draft.method,
          label: TENDER_OPTIONS.find((option) => option.value === draft.method)?.label ?? draft.method,
          amount,
          reference: reference || undefined,
          status: draft.method === "cash" ? "captured" : "pending"
        }
      ]);
    }

    setPendingTender(null);
  };

  const handleRemoveTender = (tenderId: string) => {
    setTenderLines((previous) => previous.filter((item) => item.id !== tenderId));
  };

  const handleSubmitOverride = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pendingOverride) {
      return;
    }

    const targetLine = cartLines.find((item) => item.id === pendingOverride.lineId);
    if (!targetLine) {
      setPendingOverride(null);
      return;
    }

    const managerId = Number.parseInt(overrideDraft.managerId, 10);
    if (!Number.isInteger(managerId) || managerId <= 0 || overrideDraft.pin.trim().length < 4) {
      setOverrideError("Manager ID and PIN are required to approve this discount.");
      return;
    }

    const cartListTotal = cartLines.reduce(
      (sum, item) => sum + (item.listPrice ?? item.price) * item.qty,
      0
    );
    const originalLineTotal = (targetLine.listPrice ?? targetLine.price) * targetLine.qty;
    const overrideLineTotal = pendingOverride.nextPrice * targetLine.qty;
    const overrideCartTotal = cartListTotal - (originalLineTotal - overrideLineTotal);

    setOverrideSubmitting(true);
    setOverrideError(null);
    try {
      const approval = await requestPriceOverride({
        managerId,
        pin: overrideDraft.pin.trim(),
        reason: overrideDraft.reason.trim() || undefined,
        cartTotalCents: toCents(cartListTotal),
        overrideTotalCents: toCents(overrideCartTotal)
      });

      const approvalDetails: PriceOverrideApproval = {
        approvalCode: approval.approvalCode,
        managerName: approval.manager.fullName,
        reason: approval.reason,
        createdAt: approval.createdAt
      };

      setCartLines((previous) =>
        previous.map((item) =>
          item.id === pendingOverride.lineId
            ? { ...item, price: pendingOverride.nextPrice, override: approvalDetails }
            : item
        )
      );
      setPendingOverride(null);
    } catch (error) {
      setOverrideError(
        error instanceof Error ? error.message : "Unable to approve manager override."
      );
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleValidateSale = async () => {
    if (cartLines.length === 0) {
      return;
    }

    const missingVersion = cartLines.some((line) => !line.productCodeVersionId);
    if (missingVersion) {
      setValidationState({
        status: "error",
        message: "One or more items cannot be validated because they are missing a version."
      });
      return;
    }

    setValidationState({ status: "loading" });
    try {
      const payload = await validateOrder({
        branchId: DEFAULT_BRANCH_ID,
        items: cartLines.map((line) => ({
          productCodeVersionId: line.productCodeVersionId!,
          qty: line.qty,
          unitPriceCents: toCents(line.price)
        }))
      });
      setValidationState({ status: "success", payload });
    } catch (error) {
      setValidationState({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to validate sale"
      });
    }
  };

  return (
    <div className="space-y-6 pb-28">
      <header className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm transition focus-within:border-sky-500 dark:border-slate-800 dark:bg-slate-900">
            <ScanLine className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Scan barcode or search SKU, name, description"
              className="flex-1 bg-transparent text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {searchStatus === "loading" ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <Plus className="h-4 w-4" />
            Add by code
          </button>
        </form>
        {searchError ? (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{searchError}</p>
        ) : null}
      </header>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Inventory results</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select a result to add it to the current cart. Results refresh as you type.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {searchResults.length === 0 && searchStatus !== "loading" ? (
                <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 p-8 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <span>No products found</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Try adjusting the search term or scanning a different code.
                  </span>
                </div>
              ) : null}
              {searchResults.map((product) => (
                <button
                  key={`${product.id}-${product.versionId ?? "missing"}`}
                  type="button"
                  onClick={() => handleAddProduct(product)}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 text-left text-sm text-slate-700 shadow-sm transition hover:border-sky-400 hover:shadow-lg dark:border-slate-800 dark:from-slate-950 dark:to-slate-950/60 dark:text-slate-200 dark:hover:border-sky-500"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{product.name}</span>
                    <span className="text-sm font-semibold text-sky-600 dark:text-sky-300">
                      {formatCurrency(fromCents(product.priceCents))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{product.sku ?? product.code}</span>
                    <span>{product.qtyOnHand ?? 0} in stock</span>
                  </div>
                  {product.description ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{product.description}</p>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Cart</h2>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {cartLines.length} {cartLines.length === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {cartLines.map((line) => {
                    const listUnit = line.listPrice ?? line.price;
                    const discount = Math.max(0, (listUnit - line.price) * line.qty);
                    const requiresOverride = hasManagerOverride(line, line.price) && !line.override;
                    return (
                      <tr key={line.id} className="align-top">
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 dark:text-slate-50">{line.name}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                {line.sku}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {line.code}
                            </div>
                            {line.override ? (
                              <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-600 dark:text-emerald-300">
                                <span>Override {line.override.approvalCode}</span>
                                <span>Manager: {line.override.managerName}</span>
                              </div>
                            ) : null}
                            {requiresOverride ? (
                              <div className="flex items-center gap-1 text-xs text-amber-600">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>Pending manager approval</span>
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <input
                            type="number"
                            min={1}
                            value={line.qty}
                            onChange={(event) => handleUpdateQuantity(line.id, Number(event.target.value))}
                            className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right text-sm text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={line.price.toFixed(2)}
                            onChange={(event) => handleRequestPriceChange(line.id, Number(event.target.value))}
                            className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right text-sm text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          />
                          {discount > 0 ? (
                            <p className="text-xs text-rose-500">-{formatCurrency(discount)}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                          {formatCurrency(line.price * line.qty)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-500 transition hover:border-rose-500 hover:text-rose-500 dark:border-slate-700 dark:text-slate-400 dark:hover:border-rose-400 dark:hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {cartLines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        Start scanning inventory to build the cart.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tender</h2>
              <button
                type="button"
                onClick={() => handleOpenTenderModal(null)}
                className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300"
              >
                <Plus className="h-3.5 w-3.5" /> Add tender
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>Subtotal</span>
                <span>{formatCurrency(summary.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-rose-600 dark:text-rose-300">
                <span>Discounts</span>
                <span>-{formatCurrency(summary.discounts)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-sky-600 dark:text-sky-300">
                <span>ITBIS</span>
                <span>{formatCurrency(summary.tax)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
                <span>Total</span>
                <span>{formatCurrency(summary.total)}</span>
              </div>
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Tendered</span>
                  <span>{formatCurrency(summary.tendered)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Balance due</span>
                  <span>{formatCurrency(summary.balanceDue)}</span>
                </div>
                {changeDueDisplay > 0 ? (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-300">
                    <span>Change</span>
                    <span>{formatCurrency(changeDueDisplay)}</span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                {tenderLines.map((tender) => {
                  const option = TENDER_OPTIONS.find((item) => item.value === tender.method);
                  const Icon = option?.icon ?? Wallet;
                  return (
                    <div
                      key={tender.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Icon className="h-4 w-4 text-sky-500" />
                          {tender.label}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {tender.reference ? `Ref: ${tender.reference}` : "No reference"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{formatCurrency(tender.amount)}</span>
                        <button
                          type="button"
                          onClick={() => handleOpenTenderModal(tender.id)}
                          className="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveTender(tender.id)}
                          className="rounded-full border border-rose-400 px-2 py-1 text-xs text-rose-500 transition hover:border-rose-500 dark:border-rose-500/60 dark:text-rose-400"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
                {tenderLines.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Add tenders as you collect payment. Split tender is supported.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Receipt preview</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500 dark:text-slate-500">
                <span>Ticket</span>
                <span>Walk-in</span>
              </div>
              <ul className="space-y-2">
                {cartLines.map((line) => (
                  <li key={line.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-700 dark:text-slate-200">{line.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {line.qty} x {formatCurrency(line.price)}
                      </p>
                    </div>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(line.price * line.qty)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="space-y-1 border-t border-dashed border-slate-200 pt-3 text-xs dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(summary.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-rose-500">
                  <span>Discounts</span>
                  <span>-{formatCurrency(summary.discounts)}</span>
                </div>
                <div className="flex items-center justify-between text-sky-600 dark:text-sky-300">
                  <span>ITBIS</span>
                  <span>{formatCurrency(summary.tax)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <span>Total</span>
                  <span>{formatCurrency(summary.total)}</span>
                </div>
              </div>
              <div className="space-y-1 pt-2 text-xs">
                {tenderLines.map((tender) => (
                  <div key={tender.id} className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span>{tender.label}</span>
                    <span>{formatCurrency(tender.amount)}</span>
                  </div>
                ))}
                {changeDueDisplay > 0 ? (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-300">
                    <span>Change</span>
                    <span>{formatCurrency(changeDueDisplay)}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleValidateSale}
                disabled={cartLines.length === 0 || validationState.status === "loading"}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-600/60"
              >
                {validationState.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Validate sale totals
              </button>
            </div>
            {validationState.status === "success" ? (
              <div className="mt-3 rounded-2xl border border-emerald-500/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                <p className="font-medium">Server totals confirmed</p>
                <p className="text-xs">
                  Total {formatCurrency(fromCents(validationState.payload.totalCents))} · Discounts {formatCurrency(fromCents(validationState.payload.discountCents))}
                </p>
              </div>
            ) : null}
            {validationState.status === "error" ? (
              <div className="mt-3 rounded-2xl border border-rose-500/70 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-300">
                {validationState.message}
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {pendingTender ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur">
          <form
            onSubmit={handleSubmitTender}
            className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {pendingTender.tenderId ? "Edit tender" : "Add tender"}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Capture payment details and optional reference numbers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingTender(null)}
                className="rounded-full border border-slate-300 p-2 text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Method
                <select
                  value={pendingTender.draft.method}
                  onChange={(event) => handleTenderDraftChange("method", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {TENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Amount
                <input
                  value={pendingTender.draft.amount}
                  onChange={(event) => handleTenderDraftChange("amount", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="0.00"
                />
              </label>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Reference (optional)
                <input
                  value={pendingTender.draft.reference}
                  onChange={(event) => handleTenderDraftChange("reference", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="Authorization code"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingTender(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                {pendingTender.tenderId ? "Update" : "Add"} tender
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {pendingOverride ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur">
          <form
            onSubmit={handleSubmitOverride}
            className="w-full max-w-lg space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Manager approval</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Discounts above {formatPercent(DISCOUNT_OVERRIDE_THRESHOLD)} require a manager PIN.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingOverride(null)}
                className="rounded-full border border-slate-300 p-2 text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Manager ID
                <input
                  value={overrideDraft.managerId}
                  onChange={(event) =>
                    setOverrideDraft((draft) => ({ ...draft, managerId: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="123"
                />
              </label>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Manager PIN
                <input
                  type="password"
                  value={overrideDraft.pin}
                  onChange={(event) =>
                    setOverrideDraft((draft) => ({ ...draft, pin: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="••••"
                />
              </label>
              <label className="sm:col-span-2 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Reason (optional)
                <textarea
                  value={overrideDraft.reason}
                  onChange={(event) =>
                    setOverrideDraft((draft) => ({ ...draft, reason: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  rows={3}
                  placeholder="Describe why the override is needed"
                />
              </label>
            </div>
            {overrideError ? (
              <div className="rounded-2xl border border-rose-500/60 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
                {overrideError}
              </div>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingOverride(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={overrideSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-sky-600/70"
              >
                {overrideSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldIcon />}
                Approve discount
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function ShieldIcon() {
  return <AlertTriangle className="h-4 w-4" />;
}
