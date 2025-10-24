"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AppWindow,
  Camera,
  CreditCard,
  Headphones,
  Laptop,
  Landmark,
  PauseCircle,
  ShieldX,
  Shirt,
  Smartphone,
  Watch,
  X
} from "lucide-react";

import { ProductGallery } from "@/components/pos/product-gallery";
import { OrderPanel } from "@/components/pos/order-panel";
import type { CartLine, SaleSummary, TenderBreakdown, Product, ProductCategory } from "@/components/pos/types";

const TENDER_METHODS = ["cash", "card", "transfer", "store_credit", "gift"] as const;
type TenderMethod = (typeof TENDER_METHODS)[number];
type NonCashTenderMethod = Exclude<TenderMethod, "cash">;

const TENDER_LABELS: Record<TenderMethod, string> = {
  cash: "Cash drawer",
  card: "Card (Azul)",
  transfer: "Bank transfer",
  store_credit: "Store credit",
  gift: "Gift card"
};

const TENDER_DEFAULT_STATUS: Record<TenderMethod, TenderBreakdown["status"]> = {
  cash: "captured",
  card: "pending",
  transfer: "pending",
  store_credit: "captured",
  gift: "pending"
};

const DEFAULT_TAX_RATE = 0.18;

const productCategories: ProductCategory[] = [
  { id: "all", label: "All categories", icon: AppWindow },
  { id: "phones", label: "Mobiles", icon: Smartphone },
  { id: "watches", label: "Watches", icon: Watch },
  { id: "audio", label: "Headphones", icon: Headphones },
  { id: "laptops", label: "Laptops", icon: Laptop },
  { id: "cameras", label: "Cameras", icon: Camera },
  { id: "fashion", label: "Accessories", icon: Shirt }
];

const catalogProducts: Product[] = [
  {
    id: "prod-1",
    name: "Red Note Laser",
    sku: "MB-2100",
    categoryId: "phones",
    price: 18500,
    stock: 6,
    highlight: "Top seller",
    previewLabel: "RN",
    variant: "128GB · Dual SIM · Azul"
  },
  {
    id: "prod-2",
    name: "Times Track Silver",
    sku: "WT-4413",
    categoryId: "watches",
    price: 14500,
    stock: 3,
    previewLabel: "TT",
    variant: "Sapphire glass · Leather band"
  },
  {
    id: "prod-3",
    name: "Retro Wave Headphones",
    sku: "HD-3019",
    categoryId: "audio",
    price: 9200,
    stock: 9,
    highlight: "Bundle price",
    previewLabel: "RW",
    variant: "Noise cancelling · Bluetooth"
  },
  {
    id: "prod-4",
    name: "Ultrabook Air 14",
    sku: "LP-8801",
    categoryId: "laptops",
    price: 58900,
    stock: 2,
    previewLabel: "UA",
    variant: "Core i7 · 16GB · 512GB SSD"
  },
  {
    id: "prod-5",
    name: "Mirrorless Cam Pro",
    sku: "CM-7330",
    categoryId: "cameras",
    price: 46800,
    stock: 4,
    previewLabel: "MC",
    variant: "24MP · Dual lens kit"
  },
  {
    id: "prod-6",
    name: "Neon Pulse Sneakers",
    sku: "AC-9925",
    categoryId: "fashion",
    price: 7200,
    stock: 12,
    previewLabel: "NP",
    variant: "Size run 37-43"
  }
];

const initialCartLines: CartLine[] = [
  {
    id: "prod-1",
    name: "Red Note Laser",
    sku: "MB-2100",
    status: "featured",
    variant: "128GB · Dual SIM · Azul",
    qty: 1,
    price: 18500,
    listPrice: 19000,
    taxRate: DEFAULT_TAX_RATE
  },
  {
    id: "prod-2",
    name: "Times Track Silver",
    sku: "WT-4413",
    variant: "Sapphire glass · Leather band",
    qty: 1,
    price: 14500,
    listPrice: 15200,
    taxRate: DEFAULT_TAX_RATE
  },
  {
    id: "prod-3",
    name: "Retro Wave Headphones",
    sku: "HD-3019",
    status: "bundle",
    qty: 1,
    price: 9200,
    listPrice: 9900,
    taxRate: DEFAULT_TAX_RATE,
    note: "Bundle with mic stand for RD$9,900"
  }
];

const initialTenderBreakdown: TenderBreakdown[] = [
  {
    id: "tender-1",
    method: "card",
    label: TENDER_LABELS.card,
    amount: 15000,
    reference: "AUTH-783202",
    status: "pending"
  }
];

function buildSummary(items: CartLine[], tenders: TenderBreakdown[]): SaleSummary {
  const subtotal = items.reduce(
    (sum, item) => sum + (item.listPrice ?? item.price) * item.qty,
    0
  );
  const discounts = items.reduce((sum, item) => {
    const listUnit = item.listPrice ?? item.price;
    const unitDiscount = Math.max(0, listUnit - item.price);
    return sum + unitDiscount * item.qty;
  }, 0);
  const tax = items.reduce((sum, item) => {
    const lineTotal = Math.max(item.price, 0) * item.qty;
    const rate = item.taxRate ?? DEFAULT_TAX_RATE;
    const base = lineTotal / (1 + rate);
    return sum + (lineTotal - base);
  }, 0);
  const total = Math.max(subtotal - discounts, 0);
  const nonCashTendered = tenders.reduce((sum, tender) => sum + tender.amount, 0);
  const cappedNonCash = Math.min(nonCashTendered, total);
  const cashDue = Math.max(total - cappedNonCash, 0);

  return {
    subtotal,
    discounts,
    tax,
    total,
    balanceDue: cashDue,
    cashDue,
    nonCashTendered: cappedNonCash
  };
}

function parseAmount(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/\s+/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (!normalized) {
    return null;
  }

  const value = normalized.includes(",") && !normalized.includes(".")
    ? normalized.replace(",", ".")
    : normalized.replace(/,/g, "");

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export default function PosPage() {
  const [activeCategoryId, setActiveCategoryId] = useState<string>(productCategories[0].id);
  const [searchTerm, setSearchTerm] = useState("");
  const [cartLines, setCartLines] = useState<CartLine[]>(initialCartLines);
  const [tenderBreakdown, setTenderBreakdown] = useState<TenderBreakdown[]>(initialTenderBreakdown);
  const [customerName, setCustomerName] = useState("Walk-in customer");
  const [customerDialogMode, setCustomerDialogMode] = useState<"change" | "add" | null>(null);
  const [customerInput, setCustomerInput] = useState("");

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return catalogProducts.filter((product) => {
      const matchesCategory = activeCategoryId === "all" || product.categoryId === activeCategoryId;
      if (!matchesCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = `${product.name} ${product.sku} ${product.variant ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [activeCategoryId, searchTerm]);

  const saleSummary = useMemo(() => buildSummary(cartLines, tenderBreakdown), [cartLines, tenderBreakdown]);

  const handleToggleProduct = useCallback((product: Product) => {
    setCartLines((previous) => {
      const existing = previous.find((line) => line.id === product.id);
      if (existing) {
        return previous.filter((line) => line.id !== product.id);
      }

      return [
        {
          id: product.id,
          name: product.name,
          sku: product.sku,
          qty: 1,
          price: product.price,
          listPrice: product.price,
          taxRate: DEFAULT_TAX_RATE,
          variant: product.variant,
          status: product.highlight ? "featured" : undefined
        },
        ...previous
      ];
    });
  }, []);

  const handleRemoveLine = useCallback((lineId: string) => {
    setCartLines((previous) => previous.filter((line) => line.id !== lineId));
  }, []);

  const handleQuantityChange = useCallback((lineId: string, quantity: number) => {
    setCartLines((previous) =>
      previous.map((line) => (line.id === lineId ? { ...line, qty: Math.max(1, quantity) } : line))
    );
  }, []);

  const handlePriceChange = useCallback((lineId: string, price: number) => {
    if (!Number.isFinite(price) || price <= 0) {
      return;
    }
    setCartLines((previous) =>
      previous.map((line) => (line.id === lineId ? { ...line, price } : line))
    );
  }, []);

  const handleAddTender = useCallback(
    ({ method, amount, reference }: { method: TenderBreakdown["method"]; amount: number; reference?: string }) => {
      setTenderBreakdown((previous) => [
        ...previous,
        {
          id: `tender-${Date.now()}`,
          method,
          label: TENDER_LABELS[method],
          amount,
          reference,
          status: TENDER_DEFAULT_STATUS[method]
        }
      ]);
    },
    []
  );

  const handleAdjustTender = useCallback((tenderId: string) => {
    if (typeof window === "undefined") {
      return;
    }

    setTenderBreakdown((previous) => {
      const tender = previous.find((item) => item.id === tenderId);
      if (!tender) {
        return previous;
      }

      const amountInput = window.prompt(
        `Adjust amount for ${tender.label}`,
        tender.amount.toFixed(2)
      );

      if (amountInput === null) {
        return previous;
      }

      const nextAmount = parseAmount(amountInput);
      if (nextAmount === null) {
        return previous;
      }

      let reference = tender.reference;
      if (tender.method === "card" || tender.method === "transfer") {
        const referenceInput = window.prompt(
          "Update authorization/reference (optional)",
          tender.reference ?? ""
        );

        if (referenceInput !== null) {
          const trimmed = referenceInput.trim();
          reference = trimmed ? trimmed : undefined;
        }
      }

      return previous.map((item) =>
        item.id === tenderId
          ? {
              ...item,
              amount: nextAmount,
              reference
            }
          : item
      );
    });
  }, []);

  const handleRemoveTender = useCallback((tenderId: string) => {
    setTenderBreakdown((previous) => previous.filter((item) => item.id !== tenderId));
  }, []);

  const closeCustomerDialog = useCallback(() => {
    setCustomerDialogMode(null);
    setCustomerInput("");
  }, []);

  useEffect(() => {
    if (!customerDialogMode) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCustomerDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [customerDialogMode, closeCustomerDialog]);

  const openCustomerDialog = useCallback(
    (mode: "change" | "add") => {
      setCustomerDialogMode(mode);
      setCustomerInput(mode === "change" ? customerName : "");
    },
    [customerName]
  );

  const handleSubmitCustomer = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = customerInput.trim();
      if (!trimmed) {
        return;
      }

      setCustomerName(trimmed);
      closeCustomerDialog();
    },
    [closeCustomerDialog, customerInput]
  );

  const handleChangeCustomer = useCallback(() => {
    openCustomerDialog("change");
  }, [openCustomerDialog]);

  const handleAddCustomer = useCallback(() => {
    openCustomerDialog("add");
  }, [openCustomerDialog]);

  const tenderOptions = useMemo(
    () =>
      TENDER_METHODS.filter((method): method is NonCashTenderMethod => method !== "cash").map(
        (method) => ({
          value: method,
          label: TENDER_LABELS[method]
        })
      ),
    []
  );

  const selectedProductIds = useMemo(() => cartLines.map((line) => line.id), [cartLines]);

  const isCustomerDialogOpen = customerDialogMode !== null;

  return (
    <>
      <div className="flex flex-col gap-6 pb-32">
        <div className="grid gap-6 xl:grid-cols-[2fr_1.15fr]">
          <ProductGallery
            categories={productCategories}
            products={filteredProducts}
            activeCategoryId={activeCategoryId}
            searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onCategorySelect={setActiveCategoryId}
          selectedProductIds={selectedProductIds}
          onToggleProduct={handleToggleProduct}
        />
        <OrderPanel
          items={cartLines}
          summary={saleSummary}
          tenders={tenderBreakdown}
          customerName={customerName}
          customerDescriptor={customerName === "Walk-in customer" ? "Default walk-in profile" : "CRM customer"}
          ticketId="R-20451"
          onRemoveItem={handleRemoveLine}
          onQuantityChange={handleQuantityChange}
          onPriceChange={handlePriceChange}
          onAddTender={handleAddTender}
          onAdjustTender={handleAdjustTender}
          onRemoveTender={handleRemoveTender}
          onChangeCustomer={handleChangeCustomer}
          onAddCustomer={handleAddCustomer}
          tenderOptions={tenderOptions}
          defaultTenderAmount={saleSummary.cashDue}
          cashTenderAmount={saleSummary.cashDue}
        />
        </div>
      </div>
      <div className="sticky bottom-0 z-30 -mx-6 -mb-8 mt-6 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/90">
        <div className="flex justify-center">
          <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <button className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-white">
              <PauseCircle className="h-4 w-4" />
              Hold
            </button>
            <button className="flex items-center justify-center gap-2 rounded-xl border border-rose-400/60 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 transition hover:border-rose-500/70 hover:text-rose-500 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:border-rose-400/70 dark:hover:text-rose-200">
              <ShieldX className="h-4 w-4" />
              Void
            </button>
            <button className="flex items-center justify-center gap-2 rounded-xl border border-sky-500/70 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-500 hover:text-sky-600 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100 dark:hover:border-sky-400/80 dark:hover:text-white">
              <CreditCard className="h-4 w-4" />
              Payment
            </button>
            <button className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:text-white">
              <Landmark className="h-4 w-4" />
              Bank transaction
            </button>
          </div>
        </div>
      </div>
      {isCustomerDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-slate-950/60 backdrop-blur"
          onClick={closeCustomerDialog}
        >
          <form
            className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleSubmitCustomer}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {customerDialogMode === "change" ? "Change customer" : "Add customer"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Search or enter the customer that should be linked to this sale.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCustomerDialog}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Close customer dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Customer name
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-200"
                placeholder="Search CRM or type a name"
                value={customerInput}
                onChange={(event) => setCustomerInput(event.target.value)}
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeCustomerDialog}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:text-slate-300 dark:hover:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg border border-sky-500/70 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-500 hover:text-sky-600 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100 dark:hover:border-sky-400/80 dark:hover:text-white"
              >
                {customerDialogMode === "change" ? "Update" : "Add customer"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
