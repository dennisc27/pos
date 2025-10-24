import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { CreditCard, Minus, MoreHorizontal, Plus, Trash2, UserCircle2 } from "lucide-react";
import { PosCard } from "./pos-card";
import { formatCurrency } from "./utils";
import type { CartLine, SaleSummary, TenderBreakdown } from "./types";

const DEFAULT_TAX_RATE = 0.18;

function parsePriceInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(/[^0-9,.-]/g, "");
  if (!normalized) {
    return null;
  }

  const candidate = normalized.includes(",") && !normalized.includes(".")
    ? normalized.replace(/,/g, ".")
    : normalized.replace(/,/g, "");

  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : null;
}

export function OrderPanel({
  items,
  summary,
  tenders,
  customerName,
  customerDescriptor,
  ticketId,
  onRemoveItem,
  onQuantityChange,
  onAddTender,
  onAdjustTender,
  onRemoveTender,
  onChangeCustomer,
  onAddCustomer,
  onPriceChange,
  tenderOptions,
  defaultTenderAmount
}: {
  items: CartLine[];
  summary: SaleSummary;
  tenders: TenderBreakdown[];
  customerName: string;
  customerDescriptor?: string;
  ticketId: string;
  onRemoveItem: (lineId: string) => void;
  onQuantityChange: (lineId: string, quantity: number) => void;
  onAddTender: (payload: { method: TenderBreakdown["method"]; amount: number; reference?: string }) => void;
  onAdjustTender: (tenderId: string) => void;
  onRemoveTender: (tenderId: string) => void;
  onChangeCustomer: () => void;
  onAddCustomer: () => void;
  onPriceChange: (lineId: string, price: number) => void;
  tenderOptions: { value: TenderBreakdown["method"]; label: string }[];
  defaultTenderAmount: number;
}) {
  const [isAddingTender, setIsAddingTender] = useState(false);
  const firstOption = useMemo(
    () => tenderOptions[0]?.value ?? ("cash" as TenderBreakdown["method"]),
    [tenderOptions]
  );
  const [selectedMethod, setSelectedMethod] = useState<TenderBreakdown["method"]>(firstOption);
  const [amountInput, setAmountInput] = useState("");
  const [referenceInput, setReferenceInput] = useState("");
  const [editingPrices, setEditingPrices] = useState<Record<string, string>>({});
  const priceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const validIds = new Set(items.map((item) => item.id));
    setEditingPrices((previous) => {
      let changed = false;
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(previous)) {
        if (validIds.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [items]);

  const formattedDefaultAmount = useMemo(() => {
    if (defaultTenderAmount <= 0) {
      return "0.00";
    }
    return defaultTenderAmount.toFixed(2);
  }, [defaultTenderAmount]);

  const handleSubmitTender = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedAmount = amountInput.trim();
    const amountValue = trimmedAmount ? Number(trimmedAmount.replace(/[^0-9.-]/g, "")) : defaultTenderAmount;
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return;
    }

    onAddTender({
      method: selectedMethod,
      amount: amountValue,
      reference: referenceInput.trim() ? referenceInput.trim() : undefined
    });

    setAmountInput("");
    setReferenceInput("");
    setIsAddingTender(false);
  };

  const handleStartAddingTender = () => {
    setIsAddingTender(true);
    setSelectedMethod(tenderOptions[0]?.value ?? ("cash" as TenderBreakdown["method"]));
    setAmountInput(defaultTenderAmount > 0 ? defaultTenderAmount.toFixed(2) : "");
    setReferenceInput("");
  };

  const focusPriceAtIndex = (index: number) => {
    if (index < 0 || index >= items.length) {
      return;
    }
    const target = items[index];
    const input = priceInputRefs.current[target.id];
    if (input) {
      input.focus();
      input.select();
    }
  };

  const commitPrice = (lineId: string) => {
    const line = items.find((item) => item.id === lineId);
    if (!line) {
      setEditingPrices((previous) => {
        if (!(lineId in previous)) {
          return previous;
        }
        const next = { ...previous };
        delete next[lineId];
        return next;
      });
      return;
    }

    const rawValue = editingPrices[lineId];
    if (rawValue !== undefined) {
      const parsed = parsePriceInput(rawValue);
      if (parsed !== null && parsed > 0 && parsed !== line.price) {
        onPriceChange(lineId, parsed);
      }
      setEditingPrices((previous) => {
        if (!(lineId in previous)) {
          return previous;
        }
        const next = { ...previous };
        delete next[lineId];
        return next;
      });
    }
  };

  const handlePriceInputChange = (lineId: string, value: string) => {
    const sanitized = value.replace(/[^0-9,.-]/g, "");
    setEditingPrices((previous) => ({
      ...previous,
      [lineId]: sanitized
    }));
  };

  const handlePriceKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    lineId: string,
    index: number
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitPrice(lineId);
      if (index + 1 < items.length) {
        focusPriceAtIndex(index + 1);
      } else {
        const current = priceInputRefs.current[lineId];
        current?.blur();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      commitPrice(lineId);
      focusPriceAtIndex(index + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      commitPrice(lineId);
      focusPriceAtIndex(index - 1);
    }
  };

  return (
    <PosCard
      title="New order"
      className="h-full"
      action={
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
            Ticket {ticketId}
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800/80 dark:from-slate-950/70 dark:to-slate-950/50 dark:text-slate-200">
          <div className="flex items-center gap-3">
            <UserCircle2 className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            <div className="leading-tight">
              <p className="font-medium text-slate-900 dark:text-white">{customerName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{customerDescriptor ?? "Guest"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:text-slate-200 dark:hover:border-slate-700"
              onClick={onChangeCustomer}
            >
              Change
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:text-slate-200 dark:hover:border-slate-700"
              onClick={onAddCustomer}
            >
              Add
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => {
            const rate = item.taxRate ?? DEFAULT_TAX_RATE;
            const lineSubtotal = item.qty * item.price;
            const discount = Math.min(item.discount ?? 0, lineSubtotal);
            const lineTotal = Math.max(lineSubtotal - discount, 0);
            const baseAmount = lineTotal / (1 + rate);
            const taxAmount = lineTotal - baseAmount;
            const priceInputValue = editingPrices[item.id] ?? item.price.toFixed(2);
            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800/80 dark:from-slate-950/70 dark:to-slate-950/50 dark:text-slate-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-white">{item.name}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                        {item.sku}
                      </span>
                      {item.status ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                          {item.status}
                        </span>
                      ) : null}
                    </div>
                    {item.variant ? <p className="text-xs text-slate-500 dark:text-slate-400">{item.variant}</p> : null}
                    {item.note ? <p className="text-xs text-slate-500 dark:text-slate-400">{item.note}</p> : null}
                  </div>
                  <div className="flex flex-col items-end gap-3 text-right">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(lineTotal)}</span>
                    <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                      <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm transition dark:border-slate-800/80 dark:bg-slate-900 dark:text-slate-200">
                        <span>Precio</span>
                        <input
                          ref={(element) => {
                            if (element) {
                              priceInputRefs.current[item.id] = element;
                            } else {
                              delete priceInputRefs.current[item.id];
                            }
                          }}
                          aria-label={`Price for ${item.name}`}
                          className="w-20 bg-transparent text-right text-sm font-semibold text-slate-700 focus:outline-none dark:text-slate-100"
                          inputMode="decimal"
                          value={priceInputValue}
                          onChange={(event) => handlePriceInputChange(item.id, event.target.value)}
                          onBlur={() => commitPrice(item.id)}
                          onFocus={(event) => event.currentTarget.select()}
                          onKeyDown={(event) => handlePriceKeyDown(event, item.id, index)}
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 shadow-sm transition dark:border-slate-800/80 dark:bg-slate-900 dark:text-slate-300">
                        <button
                          aria-label={`Decrease quantity for ${item.name}`}
                          className="rounded border border-transparent p-0.5 hover:border-slate-300 hover:text-slate-900 dark:hover:border-slate-700"
                          onClick={() => onQuantityChange(item.id, Math.max(1, item.qty - 1))}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          aria-label={`Quantity for ${item.name}`}
                          className="w-9 bg-transparent text-center text-[11px] font-semibold text-slate-700 focus:outline-none dark:text-slate-200"
                          inputMode="numeric"
                          min={1}
                          value={item.qty}
                          onChange={(event) => {
                            const next = Number(event.target.value.replace(/[^0-9]/g, ""));
                            if (!Number.isNaN(next) && next > 0) {
                              onQuantityChange(item.id, next);
                            }
                          }}
                        />
                        <button
                          aria-label={`Increase quantity for ${item.name}`}
                          className="rounded border border-transparent p-0.5 hover:border-slate-300 hover:text-slate-900 dark:hover:border-slate-700"
                          onClick={() => onQuantityChange(item.id, item.qty + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex flex-wrap items-center gap-3">
                    {discount > 0 ? (
                      <span className="text-rose-500 dark:text-rose-400">Disc {formatCurrency(discount)}</span>
                    ) : null}
                    {taxAmount > 0 ? (
                      <span className="text-sky-600 dark:text-sky-300">ITBIS {formatCurrency(taxAmount)}</span>
                    ) : null}
                    <span className="text-slate-500 dark:text-slate-400">Sub {formatCurrency(baseAmount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-lg border border-slate-300 px-2 py-1 transition hover:border-rose-400 hover:text-rose-500 dark:border-slate-800/80 dark:hover:border-rose-500/60 dark:hover:text-rose-300"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button className="rounded-lg border border-slate-300 px-2 py-1 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:hover:border-slate-700 dark:hover:text-white">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-3 rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 text-sm text-slate-700 shadow-sm dark:border-slate-800/80 dark:from-slate-950/60 dark:to-slate-950/80 dark:text-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Subtotal (incl. ITBIS)</span>
            <span>{formatCurrency(summary.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-rose-500 dark:text-rose-400">
            <span>Discounts</span>
            <span>-{formatCurrency(summary.discounts)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-sky-600 dark:text-sky-300">
            <span>ITBIS included</span>
            <span>{formatCurrency(summary.tax)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 text-base font-semibold text-slate-900 dark:text-white">
            <span>Grand total</span>
            <span>{formatCurrency(summary.total)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Balance due</span>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-300">{formatCurrency(summary.balanceDue)}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
            <span>Payment method</span>
            {isAddingTender ? null : (
              <button
                className="text-sky-600 transition hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200"
                onClick={handleStartAddingTender}
              >
                Add method
              </button>
            )}
          </div>
          {isAddingTender ? (
            <form
              className="space-y-2 rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-3 text-sm text-slate-700 shadow-sm dark:border-slate-800/80 dark:from-slate-950/70 dark:to-slate-950/50 dark:text-slate-200"
              onSubmit={handleSubmitTender}
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Method</label>
                <select
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-200"
                  value={selectedMethod}
                  onChange={(event) => setSelectedMethod(event.target.value as TenderBreakdown["method"])}
                >
                  {tenderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Amount</label>
                <input
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-200"
                  placeholder={formattedDefaultAmount}
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                />
              </div>
              {(selectedMethod === "card" || selectedMethod === "transfer") && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Reference</label>
                  <input
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-200"
                    value={referenceInput}
                    onChange={(event) => setReferenceInput(event.target.value)}
                    placeholder="AUTH-000000"
                  />
                </div>
              )}
              <div className="flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-1 font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:text-slate-300 dark:hover:border-slate-700"
                  onClick={() => setIsAddingTender(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg border border-sky-500/70 bg-sky-500/15 px-3 py-1 font-semibold text-sky-700 transition hover:border-sky-500 hover:text-sky-600 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100 dark:hover:border-sky-400/80 dark:hover:text-white"
                >
                  Save method
                </button>
              </div>
            </form>
          ) : null}
          <div className="space-y-2">
            {tenders.map((tender) => (
              <div
                key={tender.id}
                className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 px-3 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800/80 dark:from-slate-950/70 dark:to-slate-950/50 dark:text-slate-200"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-slate-500 dark:text-slate-500" />
                  <div className="leading-tight">
                    <p className="font-medium text-slate-900 dark:text-white">{tender.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {tender.status === "captured"
                        ? "Captured"
                        : tender.status === "pending"
                          ? "Awaiting confirmation"
                          : "Offline authorization"}
                      {tender.reference ? ` · ${tender.reference}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(tender.amount)}</span>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <button
                      className="rounded-lg border border-slate-300 px-2 py-1 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-800/80 dark:hover:border-sky-500/60 dark:hover:text-sky-200"
                      onClick={() => onAdjustTender(tender.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-lg border border-slate-300 px-2 py-1 transition hover:border-rose-400 hover:text-rose-500 dark:border-slate-800/80 dark:hover:border-rose-500/60 dark:hover:text-rose-300"
                      onClick={() => onRemoveTender(tender.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-950/80 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-white">
            Hold
          </button>
          <button className="flex-1 rounded-lg border border-rose-400/60 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 transition hover:border-rose-500/70 hover:text-rose-500 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:border-rose-400/70 dark:hover:text-rose-200">
            Void
          </button>
          <button className="flex-1 rounded-lg border border-sky-500/70 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-500 hover:text-sky-600 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100 dark:hover:border-sky-400/80 dark:hover:text-white">
            Payment
          </button>
        </div>
      </div>
    </PosCard>
  );
}
