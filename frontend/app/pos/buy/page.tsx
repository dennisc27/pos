"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  ImagePlus,
  NotebookPen,
  Percent,
  PlusCircle,
  Printer,
  Trash2
} from "lucide-react";

import { PosCard } from "@/components/pos/pos-card";
import { formatCurrency } from "@/components/pos/utils";

const categories = [
  "Mobile phones",
  "Jewelry",
  "Audio",
  "Gaming",
  "Computers",
  "Luxury goods"
];

const conditions = [
  { id: "new", label: "New" },
  { id: "like_new", label: "Like new" },
  { id: "used", label: "Used" },
  { id: "poor", label: "Well worn" }
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type IntakePhoto = {
  id: string;
  name: string;
  preview: string;
};

type IntakeItem = {
  id: string;
  description: string;
  category: string;
  condition: string;
  serial?: string;
  accessories: string;
  notes: string;
  resaleValue: number;
  targetMargin: number;
  photos: IntakePhoto[];
};

type SellerProfile = {
  name: string;
  document: string;
  phone: string;
  notes: string;
};

const createId = () => Math.random().toString(36).slice(2, 10);

const initialItems: IntakeItem[] = [
  {
    id: createId(),
    description: "iPhone 14 Pro 256GB",
    category: "Mobile phones",
    condition: "like_new",
    serial: "G0N53Q2M3P",
    accessories: "Box, USB-C cable, MagSafe case",
    notes: "Minor scuff on frame. Battery health 89%.",
    resaleValue: 43500,
    targetMargin: 32,
    photos: []
  }
];

const initialSeller: SellerProfile = {
  name: "Juan Pérez",
  document: "402-0102032-9",
  phone: "809-555-7832",
  notes: "Prefers cash payouts. Repeat seller from Gazcue."
};

function readFiles(files: FileList | null) {
  if (!files) return Promise.resolve<IntakePhoto[]>([]);
  const conversions = Array.from(files).map((file) => {
    return new Promise<IntakePhoto>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: createId(),
          name: file.name,
          preview: typeof reader.result === "string" ? reader.result : ""
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  });
  return Promise.all(conversions);
}

export default function PosBuyPage() {
  const [seller, setSeller] = useState<SellerProfile>(initialSeller);
  const [items, setItems] = useState<IntakeItem[]>(initialItems);
  const [payoutMethod, setPayoutMethod] = useState<"cash" | "transfer">("cash");
  const [isPrinting, setIsPrinting] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [managerNotes, setManagerNotes] = useState("");

  useEffect(() => {
    if (!isPrinting) return;
    const timeout = setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 120);
    return () => clearTimeout(timeout);
  }, [isPrinting]);

  const intakeSummary = useMemo(() => {
    const offerTotal = items.reduce((sum, item) => {
      const offer = Math.max(0, Math.round(item.resaleValue * (1 - item.targetMargin / 100)));
      return sum + offer;
    }, 0);
    const resaleTotal = items.reduce((sum, item) => sum + Math.max(0, item.resaleValue), 0);
    const expectedMargin = resaleTotal === 0 ? 0 : 1 - offerTotal / resaleTotal;

    return {
      offerTotal,
      resaleTotal,
      expectedMargin,
      projectedProfit: resaleTotal - offerTotal
    };
  }, [items]);

  const updateItem = (id: string, patch: Partial<IntakeItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handlePhotoUpload = async (itemId: string, fileList: FileList | null) => {
    const photos = await readFiles(fileList);
    if (!photos.length) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, photos: [...item.photos, ...photos] } : item
      )
    );
  };

  const removePhoto = (itemId: string, photoId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, photos: item.photos.filter((photo) => photo.id !== photoId) }
          : item
      )
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: createId(),
        description: "",
        category: categories[0] ?? "Other",
        condition: "used",
        serial: "",
        accessories: "",
        notes: "",
        resaleValue: 0,
        targetMargin: 35,
        photos: []
      }
    ]);
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== itemId)));
  };

  const handleSellerChange = (field: keyof SellerProfile, value: string) => {
    setSeller((prev) => ({ ...prev, [field]: value }));
  };

  const handleIntakeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (items.length === 0) {
      setStatus({ tone: "error", message: "Add at least one item to intake." });
      return;
    }

    const invalidItem = items.find((item) => !item.description.trim() || item.resaleValue <= 0);
    if (invalidItem) {
      setStatus({ tone: "error", message: "Each item needs a description and resale value." });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        branchId: 1,
        userId: 1,
        payoutMethod,
        seller: seller,
        items: items.map((item) => ({
          description: item.description,
          resaleValue: item.resaleValue,
          targetMargin: item.targetMargin,
          accessories: item.accessories,
          notes: item.notes,
          serial: item.serial,
          condition: item.condition,
          photos: item.photos.map((photo) => photo.preview).filter(Boolean),
        })),
        managerNotes,
      };

      const response = await fetch(`${API_BASE_URL}/api/pos/buys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to record intake");
      }

      const data = await response.json();
      setStatus({ tone: "success", message: `Purchase #${data?.purchase?.id ?? ""} recorded successfully.` });
      setIsPrinting(true);
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Unable to submit intake." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">POS · Buy from customer</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Intake merchandise and payout seller
        </h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Capture the seller profile, document each item with photos, and tune the payout offer using the
          target margin controls. Once everything checks out, submit to post the purchase, write to the
          drawer log, and print a signed receipt for the seller.
        </p>
      </header>

      <form onSubmit={handleIntakeSubmit} className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <PosCard
            title="Seller profile"
            subtitle="Identify the person we are buying from per AML guidelines"
            action={
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> Verified in CRM
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Full name
                <input
                  value={seller.name}
                  onChange={(event) => handleSellerChange("name", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                  placeholder="María Gómez"
                  required
                />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Document ID
                <input
                  value={seller.document}
                  onChange={(event) => handleSellerChange("document", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                  placeholder="402-0000000-0"
                  required
                />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Phone number
                <input
                  value={seller.phone}
                  onChange={(event) => handleSellerChange("phone", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                  placeholder="809-555-0101"
                />
              </label>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Notes
                <input
                  value={seller.notes}
                  onChange={(event) => handleSellerChange("notes", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                  placeholder="Any red flags or return visits"
                />
              </label>
            </div>
          </PosCard>

          <PosCard
            title="Items & appraisal"
            subtitle="Document condition, accessories, and upload supporting photos"
            action={
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600"
              >
                <PlusCircle className="h-3.5 w-3.5" /> Add item
              </button>
            }
          >
            <div className="space-y-6">
              {items.map((item, index) => {
                const offer = Math.max(0, Math.round(item.resaleValue * (1 - item.targetMargin / 100)));
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm transition hover:border-sky-200 dark:border-slate-800 dark:bg-slate-900/70"
                  >
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <NotebookPen className="h-3.5 w-3.5" /> Item {index + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-[11px] font-medium text-rose-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Description
                        <input
                          value={item.description}
                          onChange={(event) => updateItem(item.id, { description: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                          placeholder="e.g. Samsung S23 Ultra 512GB"
                          required
                        />
                      </label>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Category
                          <select
                            value={item.category}
                            onChange={(event) => updateItem(item.id, { category: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                          >
                            {categories.map((category) => (
                              <option key={category}>{category}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Condition
                          <select
                            value={item.condition}
                            onChange={(event) => updateItem(item.id, { condition: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                          >
                            {conditions.map((condition) => (
                              <option key={condition.id} value={condition.id}>
                                {condition.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Serial / IMEI
                        <input
                          value={item.serial ?? ""}
                          onChange={(event) => updateItem(item.id, { serial: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                          placeholder="Optional serial number"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Accessories included
                        <input
                          value={item.accessories}
                          onChange={(event) => updateItem(item.id, { accessories: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                          placeholder="Charger, box, manuals..."
                        />
                      </label>
                      <label className="lg:col-span-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                        Internal notes
                        <textarea
                          value={item.notes}
                          onChange={(event) => updateItem(item.id, { notes: event.target.value })}
                          className="mt-1 h-20 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                          placeholder="Damage, missing accessories, story provided by customer..."
                        />
                      </label>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr,1fr]">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center gap-1">
                            <Camera className="h-3.5 w-3.5" /> Photos
                          </span>
                          <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-500/60 dark:hover:text-sky-300">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="sr-only"
                              onChange={(event) => {
                                const fileInput = event.target;
                                void handlePhotoUpload(item.id, fileInput.files);
                                fileInput.value = "";
                              }}
                            />
                            <ImagePlus className="h-3.5 w-3.5" /> Upload
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {item.photos.length ? (
                            item.photos.map((photo) => (
                              <figure
                                key={photo.id}
                                className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                              >
                                <img
                                  src={photo.preview}
                                  alt={photo.name}
                                  className="h-full w-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removePhoto(item.id, photo.id)}
                                  className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-slate-900/70 py-1 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100"
                                >
                                  <Trash2 className="h-3 w-3" /> Remove
                                </button>
                              </figure>
                            ))
                          ) : (
                            <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                              <Camera className="h-5 w-5" />
                              Drop photos to document the condition
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-3 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:from-slate-950/70 dark:to-slate-950/40 dark:text-slate-300">
                        <header className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide">
                          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <CircleDollarSign className="h-3.5 w-3.5" /> Offer panel
                          </span>
                          <span>#{index + 1}</span>
                        </header>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                          Expected resale price
                          <div className="mt-1 flex items-center gap-2">
                            <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                              {formatCurrency(item.resaleValue)}
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={80000}
                              step={500}
                              value={item.resaleValue}
                              onChange={(event) => updateItem(item.id, { resaleValue: Number(event.target.value) })}
                              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-200 dark:bg-slate-700"
                            />
                          </div>
                        </label>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                          Target margin
                          <div className="mt-1 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                              <Percent className="h-3 w-3" /> {item.targetMargin}%
                            </span>
                            <input
                              type="range"
                              min={10}
                              max={50}
                              step={1}
                              value={item.targetMargin}
                              onChange={(event) => updateItem(item.id, { targetMargin: Number(event.target.value) })}
                              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-200 dark:bg-slate-700"
                            />
                          </div>
                        </label>
                        <p className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                          Offer to seller: {formatCurrency(offer)}
                        </p>
                        <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                          Posting will create a purchase order, credit the inventory ledger, and push the cash
                          movement to the current shift drawer.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </PosCard>
        </div>

        <div className="space-y-6">
          <PosCard
            title="Offer summary"
            subtitle="Validate payout before obtaining manager approval"
            action={
              <button
                type="button"
                onClick={() => setIsPrinting(true)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <Printer className="h-3.5 w-3.5" /> Preview receipt
              </button>
            }
          >
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <FileText className="h-4 w-4" /> Items appraised
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{items.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <NotebookPen className="h-4 w-4" /> Total resale value
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(intakeSummary.resaleTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <BadgeDollarSign className="h-4 w-4" /> Total payout offer
                </span>
                <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(intakeSummary.offerTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Projected profit</span>
                <span>{formatCurrency(intakeSummary.projectedProfit)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Expected margin</span>
                <span>{(intakeSummary.expectedMargin * 100).toFixed(1)}%</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <p className="font-semibold text-slate-600 dark:text-slate-200">Cash drawer impact</p>
                <p className="mt-1 leading-5">
                  The payout posts as a cash movement on the active shift. If the drawer lacks funds,
                  request a paid-in before completing the purchase.
                </p>
              </div>
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payout method
                </legend>
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm transition hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500/70">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payout"
                      checked={payoutMethod === "cash"}
                      onChange={() => setPayoutMethod("cash")}
                      className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-100">Cash drawer</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Issues a payout and prompts to kick the drawer
                      </p>
                    </div>
                  </div>
                  <CircleDollarSign className="h-4 w-4 text-emerald-500" />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm transition hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500/70">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payout"
                      checked={payoutMethod === "transfer"}
                      onChange={() => setPayoutMethod("transfer")}
                      className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-100">Bank transfer</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Logs the ACH reference and skips the drawer count
                      </p>
                    </div>
                  </div>
                  <CircleDollarSign className="h-4 w-4 text-sky-500" />
                </label>
              </fieldset>
            </div>
          </PosCard>

          <PosCard
            title="Post purchase"
            subtitle="Confirm payout and generate the seller receipt"
            action={
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Signed receipt required for every buy
              </div>
            }
          >
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Manager approval notes
                <textarea
                  value={managerNotes}
                  onChange={(event) => setManagerNotes(event.target.value)}
                  className="mt-1 h-20 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                  placeholder="Reasoning behind the offer, checklist status, etc."
                />
              </label>
              <p className="flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3 text-xs leading-5 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                <Percent className="mt-0.5 h-4 w-4" /> Offers above RD$50,000 require the floor manager PIN before posting.
              </p>
              {status && (
                <p
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    status.tone === "success"
                      ? "border-emerald-300 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : "border-rose-300 bg-rose-50/70 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
                  }`}
                >
                  {status.message}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2"
              >
                <BadgeDollarSign className="h-4 w-4" /> {loading ? "Posting intake..." : "Submit purchase & print receipt"}
              </button>
            </div>
          </PosCard>
        </div>
      </form>
    </main>
  );
}
