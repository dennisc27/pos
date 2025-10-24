import { SaleComposer } from "@/components/pos/sale-composer";
import { TenderPanel } from "@/components/pos/tender-panel";
import { RegisterFeed } from "@/components/pos/register-feed";
import { ReceiptPreview } from "@/components/pos/receipt-preview";
import { OfflineQueue } from "@/components/pos/offline-queue";
import type {
  CartLine,
  RegisterEvent,
  SaleSummary,
  TenderBreakdown,
  QueuedSale
} from "@/components/pos/types";
import { formatCurrency } from "@/components/pos/utils";

const cartLines: CartLine[] = [
  {
    id: "1",
    name: "14K Gold Hoop Earrings",
    sku: "JW-1021",
    status: "consignment",
    variant: "Pair · 2.5g · Yellow gold",
    qty: 1,
    price: 8200,
    discount: 300,
    taxRate: 0.18
  },
  {
    id: "2",
    name: "Citizen Eco-Drive Watch",
    sku: "WT-4413",
    variant: "Serial #CIT99871 · Sapphire glass",
    qty: 1,
    price: 14500,
    taxRate: 0.18
  },
  {
    id: "3",
    name: "Ultrasonic Cleaner Solution",
    sku: "SV-5501",
    status: "add-on",
    qty: 2,
    price: 950,
    discount: 100,
    taxRate: 0.18,
    note: "Promo: Buy 2 for RD$1,800"
  }
];

const registerEvents: RegisterEvent[] = [
  {
    id: "evt-1",
    time: "10:42",
    type: "sale",
    description: "RD$28,500 sale (ticket R-20450) completed by card + cash split",
    amount: 28500,
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
    amount: 14250,
    reference: "AUTH-783202",
    status: "pending"
  }
];

const saleSummary = buildSummary(cartLines, tenderBreakdown);

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
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-6">
          <SaleComposer items={cartLines} summary={saleSummary} customerName="Walk-in customer" />
          <RegisterFeed events={registerEvents} />
        </div>
        <div className="flex flex-col gap-6">
          <TenderPanel summary={saleSummary} tenders={tenderBreakdown} />
          <ReceiptPreview items={cartLines} summary={saleSummary} tenders={tenderBreakdown} />
          <OfflineQueue queue={offlineQueue} />
        </div>
      </div>
    </div>
  );
}
