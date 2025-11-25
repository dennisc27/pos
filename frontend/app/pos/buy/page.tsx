"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  ImagePlus,
  Loader2,
  NotebookPen,
  Percent,
  PlusCircle,
  Printer,
  Search,
  Trash2,
  UserCircle2,
  X
} from "lucide-react";

import { PosCard } from "@/components/pos/pos-card";
import { formatCurrency } from "@/components/pos/utils";
import { useActiveBranch } from "@/components/providers/active-branch-provider";
import { AddCustomerDialog } from "@/components/customer/add-customer-dialog";

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
  offerAmount: number;
  photos: IntakePhoto[];
};

type SellerProfile = {
  name: string;
  document: string;
  phone: string;
  notes: string;
};

type SellerSearchResult = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  lastActivityAt: string | null;
};

const createId = () => Math.random().toString(36).slice(2, 10);

const WALK_IN_SELLER: SellerProfile = {
  name: "Walk-in seller",
  document: "",
  phone: "",
  notes: "",
};

const initialItems: IntakeItem[] = [];

const initialSeller: SellerProfile = {
  name: "",
  document: "",
  phone: "",
  notes: "",
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
  const { branch: activeBranch, loading: branchLoading, error: branchError } = useActiveBranch();
  const [seller, setSeller] = useState<SellerProfile>(WALK_IN_SELLER);
  const [linkedSellerId, setLinkedSellerId] = useState<number | null>(null);
  const [items, setItems] = useState<IntakeItem[]>([]);
  const [payoutMethod, setPayoutMethod] = useState<"cash" | "transfer">("cash");
  const [isPrinting, setIsPrinting] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [managerNotes, setManagerNotes] = useState("");
  const [sellerDialogMode, setSellerDialogMode] = useState<"change" | "add" | null>(null);
  const [sellerLookup, setSellerLookup] = useState("");
  const [sellerSearchResults, setSellerSearchResults] = useState<SellerSearchResult[]>([]);
  const [sellerSearchError, setSellerSearchError] = useState<string | null>(null);
  const [isSearchingSellers, setIsSearchingSellers] = useState(false);
  const [sellerForm, setSellerForm] = useState<SellerProfile>(WALK_IN_SELLER);
  const [sellerFormError, setSellerFormError] = useState<string | null>(null);
  const [isSuccessDialogOpen, setSuccessDialogOpen] = useState(false);
  const [purchaseData, setPurchaseData] = useState<{
    id: number;
    totalCostCents: number;
    totalQuantity: number;
    supplierName: string;
    payoutMethod: string;
    items: Array<{ code: string; description: string; resaleValueCents: number; offerCents: number }>;
  } | null>(null);

  useEffect(() => {
    if (!isPrinting) return;
    const timeout = setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 120);
    return () => clearTimeout(timeout);
  }, [isPrinting]);

  useEffect(() => {
    if (!sellerDialogMode) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSellerDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sellerDialogMode]);

  useEffect(() => {
    if (!sellerDialogMode) {
      return;
    }

    const query = sellerLookup.trim();
    if (query.length < 2) {
      setSellerSearchResults([]);
      setSellerSearchError(null);
      setIsSearchingSellers(false);
      return;
    }

    const controller = new AbortController();
    setIsSearchingSellers(true);
    setSellerSearchError(null);

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, limit: "8" });
        const response = await fetch(`${API_BASE_URL}/api/customers?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Search failed with status ${response.status}`);
        }

        const payload: {
          customers?: Array<{
            id: number;
            firstName: string | null;
            lastName: string | null;
            email: string | null;
            phone: string | null;
            lastActivityAt?: string | null;
          }>;
        } = await response.json();

        if (controller.signal.aborted) {
          return;
        }

        const results: SellerSearchResult[] = (payload.customers ?? []).map((customer) => {
          const first = customer.firstName?.trim() ?? "";
          const last = customer.lastName?.trim() ?? "";
          const name = `${first} ${last}`.trim() || "Unnamed customer";

          return {
            id: Number(customer.id),
            name,
            email: customer.email ?? null,
            phone: customer.phone ?? null,
            lastActivityAt: customer.lastActivityAt ?? null,
          };
        });

        setSellerSearchResults(results);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Seller search failed", error);
        setSellerSearchError("Unable to search CRM sellers.");
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingSellers(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [sellerDialogMode, sellerLookup]);

  const intakeSummary = useMemo(() => {
    const offerTotal = items.reduce((sum, item) => {
      return sum + Math.max(0, Number(item.offerAmount) || 0);
    }, 0);

    return {
      offerTotal
    };
  }, [items]);

  const sellerDescriptor = useMemo(() => {
    if (linkedSellerId) {
      return "Linked CRM seller";
    }
    return "Manual entry";
  }, [linkedSellerId]);

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
        offerAmount: 0,
        photos: []
      }
    ]);
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== itemId)));
  };

  const resetPage = () => {
    setSeller(WALK_IN_SELLER);
    setLinkedSellerId(null);
    setItems([]);
    setPayoutMethod("cash");
    setManagerNotes("");
    setStatus(null);
    setPurchaseData(null);
  };

  const handleSellerChange = (field: keyof SellerProfile, value: string) => {
    setSeller((prev) => ({ ...prev, [field]: value }));
  };

  const closeSellerDialog = () => {
    setSellerDialogMode(null);
    setSellerLookup("");
    setSellerSearchResults([]);
    setSellerSearchError(null);
    setIsSearchingSellers(false);
    setSellerFormError(null);
  };

  const openSellerDialog = (mode: "change" | "add") => {
    setSellerDialogMode(mode);
    setSellerLookup(mode === "change" ? seller.name : "");
    setSellerSearchResults([]);
    setSellerSearchError(null);
    setIsSearchingSellers(false);
    setSellerForm(mode === "change" ? seller : WALK_IN_SELLER);
    setSellerFormError(null);
  };

  const handleSellerFormChange = (field: keyof SellerProfile, value: string) => {
    setSellerForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitSellerProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = sellerForm.name.trim();
    if (!trimmedName) {
      setSellerFormError("Seller name is required.");
      return;
    }

    const nextSeller: SellerProfile = {
      name: trimmedName,
      document: sellerForm.document.trim(),
      phone: sellerForm.phone.trim(),
      notes: sellerForm.notes.trim(),
    };

    setSeller(nextSeller);
    setSellerForm(nextSeller);
    setLinkedSellerId(null);
    setSellerFormError(null);
    closeSellerDialog();
  };

  const handleSelectSeller = (result: SellerSearchResult) => {
    const nextSeller: SellerProfile = {
      name: result.name,
      document: "",
      phone: "",
      notes: "",
    };

    setSeller(nextSeller);
    setSellerForm(nextSeller);
    setLinkedSellerId(result.id);
    closeSellerDialog();
  };

  const handleUseWalkInSeller = () => {
    setSeller(WALK_IN_SELLER);
    setSellerForm(WALK_IN_SELLER);
    setLinkedSellerId(null);
    closeSellerDialog();
  };

  const handleIntakeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (items.length === 0) {
      setStatus({ tone: "error", message: "Add at least one item to intake." });
      return;
    }

    const invalidItem = items.find((item) => !item.description.trim() || item.offerAmount <= 0);
    if (invalidItem) {
      setStatus({ tone: "error", message: "Each item needs a description and payout offer." });
      return;
    }

    if (!activeBranch) {
      setStatus({
        tone: "error",
        message: branchError ?? "Configura una sucursal activa en ajustes antes de registrar compras.",
      });
      return;
    }

    setLoading(true);
    try {
      // Get active shift for the branch to associate purchases
      let activeShiftId: number | null = null;
      try {
        const shiftResponse = await fetch(`${API_BASE_URL}/api/shifts/active?branchId=${activeBranch.id}`);
        if (shiftResponse.ok) {
          const shiftData = await shiftResponse.json();
          activeShiftId = shiftData.shift?.id ?? null;
        }
      } catch {
        // If shift lookup fails, continue without shiftId
      }

      const payload: {
        branchId: number;
        userId: number;
        payoutMethod: string;
        seller: typeof seller;
        items: Array<{
          description: string;
          resaleValue: number;
          accessories: string | null;
          notes: string | null;
          serial: string | null;
          condition: string;
          photos: string[];
        }>;
        managerNotes: string | null;
        shiftId?: number;
      } = {
        branchId: activeBranch.id,
        userId: 7,   // Cajera Principal
        payoutMethod,
        seller: seller,
        items: items.map((item) => ({
          description: item.description,
          resaleValue: item.offerAmount, // Backend expects resaleValue, we use offerAmount as the resale value
          accessories: item.accessories,
          notes: item.notes,
          serial: item.serial,
          condition: item.condition,
          photos: item.photos.map((photo) => photo.preview).filter(Boolean),
        })),
        managerNotes,
      };

      // Add shiftId if available
      if (activeShiftId !== null) {
        payload.shiftId = activeShiftId;
      }

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
      setPurchaseData({
        id: data.purchase.id,
        totalCostCents: data.purchase.totalCostCents,
        totalQuantity: data.purchase.totalQuantity,
        supplierName: data.purchase.supplierName,
        payoutMethod: data.purchase.payoutMethod,
        items: data.items ?? [],
      });
      setSuccessDialogOpen(true);
      setIsPrinting(true);
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Unable to submit intake." });
    } finally {
      setLoading(false);
    }
  };

  const isSellerDialogOpen = sellerDialogMode !== null;

  return (
    <>
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

      {branchLoading ? (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Sincronizando sucursal activa…
        </div>
      ) : !activeBranch ? (
        <div className="mb-6 rounded-xl border border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200">
          Configura una sucursal predeterminada en Ajustes → Sistema para registrar compras.
        </div>
      ) : branchError ? (
        <div className="mb-6 rounded-xl border border-rose-400/60 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200">
          {branchError}
        </div>
      ) : null}

      <form onSubmit={handleIntakeSubmit} className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          <PosCard
            title="Seller profile"
            subtitle="Identify the person we are buying from per AML guidelines"
            action={
              linkedSellerId ? (
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> CRM linked
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <FileText className="h-3.5 w-3.5" /> Manual profile
                </div>
              )
            }
          >
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:from-slate-950/70 dark:to-slate-950/40 dark:text-slate-200 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <UserCircle2 className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{seller.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{sellerDescriptor}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-700"
                    onClick={() => openSellerDialog("change")}
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-700"
                    onClick={() => openSellerDialog("add")}
                  >
                    Add
                  </button>
                </div>
              </div>
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
                const offer = Math.max(0, Number(item.offerAmount) || 0);
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
                                <Image
                                  src={photo.preview}
                                  alt={photo.name}
                                  fill
                                  sizes="(min-width: 640px) 33vw, 50vw"
                                  className="object-cover"
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
                          Offer to seller
                          <div className="mt-1 flex items-center gap-2">
                            <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                              {formatCurrency(offer)}
                            </span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={100}
                              value={item.offerAmount > 0 ? item.offerAmount : ""}
                              onChange={(event) => {
                                const nextValue = Number(event.target.value);
                                updateItem(item.id, {
                                  offerAmount: Number.isFinite(nextValue) ? nextValue : 0,
                                });
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-800/60"
                              placeholder="0.00"
                            />
                          </div>
                        </label>
                        <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                          Enter the agreed payout amount for this item. Posting will log the cash movement for the
                          active shift.
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
                  <BadgeDollarSign className="h-4 w-4" /> Total payout offer
                </span>
                <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(intakeSummary.offerTotal)}
                </span>
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
                disabled={loading || branchLoading || !activeBranch}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2"
              >
                <BadgeDollarSign className="h-4 w-4" /> {loading ? "Posting intake..." : "Submit purchase & print receipt"}
              </button>
            </div>
          </PosCard>
        </div>
      </form>
    </main>
    {isSellerDialogOpen ? (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
        onClick={closeSellerDialog}
      >
        <div
          className="w-full max-w-lg space-y-5 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {sellerDialogMode === "change" ? "Change seller" : "Add seller"}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Search CRM or enter a new profile to link to this purchase.
              </p>
            </div>
            <button
              type="button"
              onClick={closeSellerDialog}
              className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
              aria-label="Close seller dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Lookup CRM
            <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={sellerLookup}
                onChange={(event) => setSellerLookup(event.target.value)}
                className="flex-1 bg-transparent focus:outline-none"
                placeholder="Name, phone, or email"
              />
            </div>
          </label>
          {sellerSearchError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200">
              {sellerSearchError}
            </p>
          ) : null}
          {isSearchingSellers ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching CRM…
            </div>
          ) : null}
          {sellerSearchResults.length > 0 ? (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {sellerSearchResults.map((result) => {
                const contactLine = [result.email, result.phone].filter(Boolean).join(" • ") || "No contact details";
                return (
                  <li key={result.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{result.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{contactLine}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectSeller(result)}
                      className="rounded-full border border-sky-300 px-3 py-1 text-xs font-semibold text-sky-600 transition hover:border-sky-400 hover:text-sky-700 dark:border-sky-500/60 dark:text-sky-200"
                    >
                      Use
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : sellerLookup.trim().length >= 2 && !isSearchingSellers && !sellerSearchError ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
              No CRM sellers found. Try a different search.
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleUseWalkInSeller}
            className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300"
          >
            Use walk-in seller
          </button>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={closeSellerDialog}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:text-slate-300 dark:hover:border-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    ) : null}

    {/* Add Customer Dialog - Add mode (full form) - Sellers are customers */}
    <AddCustomerDialog
      isOpen={isSellerDialogOpen && sellerDialogMode === "add"}
      onClose={closeSellerDialog}
      onSuccess={(customer) => {
        const nextSeller: SellerProfile = {
          name: `${customer.firstName} ${customer.lastName}`.trim(),
          document: "",
          phone: "",
          notes: "",
        };
        setSeller(nextSeller);
        setLinkedSellerId(customer.id);
        closeSellerDialog();
      }}
      onError={(error) => setSellerSearchError(error)}
    />

    {isSuccessDialogOpen && purchaseData ? (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
        onClick={() => {
          setSuccessDialogOpen(false);
          resetPage();
        }}
      >
        <div
          className="w-full max-w-2xl space-y-5 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Purchase Successful</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Purchase #{purchaseData.id} recorded and receipt printed
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSuccessDialogOpen(false);
                resetPage();
              }}
              className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
              aria-label="Close success dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Seller</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{purchaseData.supplierName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Payout Method</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                  {purchaseData.payoutMethod === "cash" ? "Cash drawer" : "Bank transfer"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Items Purchased</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{purchaseData.totalQuantity}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Payout</p>
                <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(purchaseData.totalCostCents / 100)}
                </p>
              </div>
            </div>

            {purchaseData.items.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Items Summary</p>
                <div className="space-y-2">
                  {purchaseData.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/60"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white">{item.description}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Code: {item.code}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(item.offerCents / 100)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Resale: {formatCurrency(item.resaleValueCents / 100)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setSuccessDialogOpen(false);
                resetPage();
              }}
              className="rounded-lg border border-sky-500/70 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:border-sky-500 hover:text-sky-600 dark:border-sky-500/60 dark:bg-sky-500/20 dark:text-sky-100 dark:hover:border-sky-400/80 dark:hover:text-white"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
