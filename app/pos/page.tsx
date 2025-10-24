"use client";

import { useCallback, useMemo, useState } from "react";
import { AppWindow, Camera, Headphones, Laptop, Shirt, Smartphone, Watch } from "lucide-react";

import { ProductGallery } from "@/components/pos/product-gallery";
import { OrderPanel } from "@/components/pos/order-panel";
import { RegisterFeed } from "@/components/pos/register-feed";
import { OfflineQueue } from "@/components/pos/offline-queue";
import type {
  CartLine,
  RegisterEvent,
  SaleSummary,
  TenderBreakdown,
  QueuedSale,
  Product,
  ProductCategory
} from "@/components/pos/types";

const TENDER_METHODS = ["cash", "card", "transfer", "store_credit", "gift"] as const;
type TenderMethod = (typeof TENDER_METHODS)[number];

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

const registerEvents: RegisterEvent[] = [
  {
    id: "evt-1",
    time: "10:42",
    type: "sale",
    description: "RD$56,850 ticket R-20450 closed via cash + card",
    amount: 56850,
    clerk: "Maria P."
  },
  {
    id: "evt-2",
    time: "10:15",
    type: "drop",
    description: "Cash drop to safe recorded for afternoon deposit",
    amount: 15000,
    clerk: "Supervisor"
  },
  {
    id: "evt-3",
    time: "09:55",
    type: "paid_out",
    description: "Paid-out RD$4,500 for repair vendor invoice #RF-118",
    amount: 4500,
    clerk: "Maria P."
  },
  {
    id: "evt-4",
    time: "09:20",
    type: "paid_in",
    description: "Opening float counted and confirmed",
    amount: 15000,
    clerk: "Supervisor"
  }
];

const offlineQueue: QueuedSale[] = [
  {
    id: "queue-1",
    receipt: "R-20432",
    customer: "Walk-in customer",
    amount: 4350,
    reason: "Network timeout while posting to Supabase",
    status: "retrying"
  },
  {
    id: "queue-2",
    receipt: "R-20428",
    customer: "Pedro S.",
    amount: 7200,
    reason: "Awaiting card settlement confirmation",
    status: "waiting"
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
    discount: 500,
    taxRate: 0.18
  },
  {
    id: "prod-2",
    name: "Times Track Silver",
    sku: "WT-4413",
    variant: "Sapphire glass · Leather band",
    qty: 1,
    price: 14500,
    taxRate: 0.18
  },
  {
    id: "prod-3",
    name: "Retro Wave Headphones",
    sku: "HD-3019",
    status: "bundle",
    qty: 1,
    price: 9200,
    discount: 700,
    taxRate: 0.18,
    note: "Bundle with mic stand for RD$9,900"
  }
];

const initialTenderBreakdown: TenderBreakdown[] = [
  {
    id: "tender-1",
    method: "cash",
    label: TENDER_LABELS.cash,
    amount: 5000,
    status: "captured"
  },
  {
    id: "tender-2",
    method: "card",
    label: TENDER_LABELS.card,
    amount: 46850,
    reference: "AUTH-783202",
    status: "pending"
  }
];

function buildSummary(items: CartLine[], tenders: TenderBreakdown[]): SaleSummary {
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discounts = items.reduce((sum, item) => sum + (item.discount ?? 0), 0);
  const tax = items.reduce((sum, item) => {
    const lineSubtotal = item.qty * item.price;
    const discount = item.discount ?? 0;
    const rate = item.taxRate ?? 0;
    return sum + (lineSubtotal - discount) * rate;
  }, 0);
  const total = subtotal - discounts + tax;
  const tendered = tenders.reduce((sum, tender) => sum + tender.amount, 0);
  const balanceDue = Math.max(total - tendered, 0);

  return {
    subtotal,
    discounts,
    tax,
    total,
    balanceDue
  };
}

function isTenderMethod(value: string): value is TenderMethod {
  return (TENDER_METHODS as readonly string[]).includes(value);
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

  const handleAddProduct = useCallback((product: Product) => {
    setCartLines((previous) => {
      const existing = previous.find((line) => line.id === product.id);
      if (existing) {
        return previous.map((line) =>
          line.id === product.id
            ? {
                ...line,
                qty: line.qty + 1
              }
            : line
        );
      }

      return [
        ...previous,
        {
          id: product.id,
          name: product.name,
          sku: product.sku,
          qty: 1,
          price: product.price,
          taxRate: 0.18,
          variant: product.variant,
          status: product.highlight ? "featured" : undefined
        }
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

  const handleAddTender = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const methodInput = window.prompt(
      "Enter payment method (cash, card, transfer, store_credit, gift)",
      "cash"
    );

    if (!methodInput) {
      return;
    }

    const normalized = methodInput.trim().toLowerCase();
    if (!isTenderMethod(normalized)) {
      return;
    }

    const amountInput = window.prompt(
      "Enter amount to capture",
      saleSummary.balanceDue > 0 ? saleSummary.balanceDue.toFixed(2) : "0"
    );

    if (!amountInput) {
      return;
    }

    const amount = parseAmount(amountInput);
    if (amount === null) {
      return;
    }

    let reference: string | undefined;
    if (normalized === "card" || normalized === "transfer") {
      const referenceInput = window.prompt("Enter authorization/reference (optional)", "");
      if (referenceInput) {
        const trimmed = referenceInput.trim();
        if (trimmed) {
          reference = trimmed;
        }
      }
    }

    setTenderBreakdown((previous) => [
      ...previous,
      {
        id: `tender-${Date.now()}`,
        method: normalized,
        label: TENDER_LABELS[normalized],
        amount,
        reference,
        status: TENDER_DEFAULT_STATUS[normalized]
      }
    ]);
  }, [saleSummary.balanceDue]);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[2fr_1.15fr]">
        <ProductGallery
          categories={productCategories}
          products={filteredProducts}
          activeCategoryId={activeCategoryId}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onCategorySelect={setActiveCategoryId}
          onAddProduct={handleAddProduct}
        />
        <OrderPanel
          items={cartLines}
          summary={saleSummary}
          tenders={tenderBreakdown}
          customerName="Wesley Adrian"
          ticketId="R-20451"
          onRemoveItem={handleRemoveLine}
          onQuantityChange={handleQuantityChange}
          onAddTender={handleAddTender}
          onAdjustTender={handleAdjustTender}
          onRemoveTender={handleRemoveTender}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <RegisterFeed events={registerEvents} />
        <OfflineQueue queue={offlineQueue} />
      </div>
    </div>
  );
}
