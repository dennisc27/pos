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
import { formatCurrency } from "@/components/pos/utils";

const cartLines: CartLine[] = [
  {
    id: "1",
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
    id: "2",
    name: "Times Track Silver",
    sku: "WT-4413",
    variant: "Sapphire glass · Leather band",
    qty: 1,
    price: 14500,
    taxRate: 0.18
  },
  {
    id: "3",
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

const tenderBreakdown: TenderBreakdown[] = [
  {
    method: "cash",
    label: "Cash drawer",
    amount: 5000,
    status: "captured"
  },
  {
    method: "card",
    label: "Card (Azul)",
    amount: 46850,
    reference: "AUTH-783202",
    status: "pending"
  }
];

const saleSummary = buildSummary(cartLines, tenderBreakdown);

const productCategories: ProductCategory[] = [
  { id: "all", label: "All categories", icon: AppWindow },
  { id: "phones", label: "Mobiles", icon: Smartphone },
  { id: "watches", label: "Watches", icon: Watch },
  { id: "audio", label: "Headphones", icon: Headphones },
  { id: "laptops", label: "Laptops", icon: Laptop },
  { id: "cameras", label: "Cameras", icon: Camera },
  { id: "fashion", label: "Accessories", icon: Shirt }
];

const products: Product[] = [
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

const statusPills = [
  { label: "Shift", value: "Morning A", accent: "text-emerald-400" },
  { label: "Till", value: "Front Counter 01", accent: "text-sky-300" },
  { label: "Expected cash", value: formatCurrency(18250), accent: "text-amber-300" },
  { label: "Queue", value: `${offlineQueue.length} offline`, accent: "text-rose-300" }
];

export default function PosPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statusPills.map((pill) => (
          <div
            key={pill.label}
            className="flex flex-col gap-1 rounded-2xl border border-slate-800/70 bg-slate-950/80 px-4 py-3 text-xs text-slate-400"
          >
            <span className="uppercase tracking-wide text-[10px] text-slate-500">{pill.label}</span>
            <span className={`text-sm font-semibold ${pill.accent}`}>{pill.value}</span>
          </div>
        ))}
      </section>
      <div className="grid gap-6 xl:grid-cols-[2fr_1.15fr]">
        <ProductGallery
          categories={productCategories}
          products={products}
          activeCategoryId={productCategories[0].id}
        />
        <OrderPanel
          items={cartLines}
          summary={saleSummary}
          tenders={tenderBreakdown}
          customerName="Wesley Adrian"
          ticketId="R-20451"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <RegisterFeed events={registerEvents} />
        <OfflineQueue queue={offlineQueue} />
      </div>
    </div>
  );
}
