"use client";

import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useState } from "react";

import { ClipboardList, Loader2, PackagePlus, Plus, Printer, Search, Trash2, X } from "lucide-react";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

import { formatCurrency } from "@/components/pos/utils";
import { formatDateForDisplay } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const MAX_LABELS = 200;

const today = () => new Date().toISOString().slice(0, 10);

const formatDisplayDate = (value: string | null | undefined) =>
  value ? formatDateForDisplay(value) : "-";

function parseAmountToCents(value: string): number | null {
  if (!value || !value.trim()) {
    return null;
  }
  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function centsToCurrency(cents: number | null | undefined) {
  return formatCurrency(Number(cents ?? 0) / 100);
}

function makeLineKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `line-${Math.random().toString(36).slice(2, 10)}`;
}

type LayoutOption = {
  id: string;
  name: string;
};

type CodeResult = {
  productCodeVersionId: number;
  code: string;
  name: string;
  branchId: number;
  branchName: string | null;
  sku: string | null;
  priceCents: number | null;
  costCents: number | null;
};

type PurchaseLineInput = {
  key: string;
  productCodeVersionId: number | null; // null for new products
  code: string;
  name: string;
  branchId: number;
  branchName: string | null;
  sku: string | null;
  quantity: string;
  unitCost: string;
  labelQuantity: string;
  isNew?: boolean; // Flag to indicate this is a new product
  newProductData?: {
    // Data for creating new product
    code: string;
    name: string;
    sku: string | null;
    description: string | null;
    priceCents: number;
    costCents: number;
  };
};

type StatusMessage = { tone: "success" | "error"; message: string } | null;

type PurchaseResponse = {
  purchase: {
    id: number;
    referenceNo: string | null;
    supplierName: string | null;
    totalCostCents: number;
    totalQuantity: number;
    labelLayout: string | null;
    labelCount: number;
  };
  lines: Array<{
    productCodeVersionId: number;
    code: string | null;
    name: string | null;
    quantity: number;
    unitCostCents: number;
    lineTotalCents: number;
    labelQuantity: number;
  }>;
  totals: {
    totalQuantity: number;
    totalCostCents: number;
  };
  labels: {
    totalLabels: number;
    layout: LayoutOption & { columns?: number; rows?: number };
  };
};

type SavedPurchaseResponse = {
  purchase: {
    id: number;
    branchId: number;
    supplierName: string | null;
    supplierInvoice: string | null;
    referenceNo: string | null;
    receivedAt: string | null;
    createdBy: number | null;
    totalCostCents: number;
    totalQuantity: number;
    notes: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  lines: Array<{
    id: number;
    productCodeVersionId: number;
    code: string | null;
    name: string | null;
    sku: string | null;
    quantity: number;
    unitCostCents: number;
    lineTotalCents: number;
    labelQuantity: number;
    note: string | null;
    branchId: number;
    branchName: string | null;
    qtyOnHand: number;
    returnedQuantity: number;
    availableQuantity: number;
  }>;
};

type SupplierDetails = {
  id?: number;
  name: string;
  taxId: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type SupplierSearchResult = {
  id: number;
  name: string;
  taxId: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export default function PurchaseReceivePage() {
  const { branch: activeBranch, loading: branchLoading, error: branchError } = useActiveBranch();
  const [availableLayouts, setAvailableLayouts] = useState<LayoutOption[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [receivedAt, setReceivedAt] = useState<string>(today());
  const [notes, setNotes] = useState("");
  const [layoutId, setLayoutId] = useState<string>("");
  const [includePrice, setIncludePrice] = useState(true);
  const [labelNote, setLabelNote] = useState("");
  const [lines, setLines] = useState<PurchaseLineInput[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<CodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [isNewProductDialogOpen, setIsNewProductDialogOpen] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: "",
    sku: "",
    description: "",
    price: "",
    cost: "",
  });
  const [newProductFormError, setNewProductFormError] = useState<string | null>(null);

  const [status, setStatus] = useState<StatusMessage>(null);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<PurchaseResponse | null>(null);
  const [savedRecord, setSavedRecord] = useState<SavedPurchaseResponse | null>(null);
  const [verifyingSave, setVerifyingSave] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDetails | null>(null);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<{
    name: string;
    taxId: string;
    contact: string;
    phone: string;
    email: string;
    notes: string;
  }>({
    name: "",
    taxId: "",
    contact: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [supplierFormError, setSupplierFormError] = useState<string | null>(null);
  const [supplierSearchResults, setSupplierSearchResults] = useState<SupplierSearchResult[]>([]);
  const [isSearchingSuppliers, setIsSearchingSuppliers] = useState(false);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const openSupplierDialog = (prefillName?: string) => {
    setSupplierForm({
      name: prefillName || supplierName || selectedSupplier?.name || "",
      taxId: selectedSupplier?.taxId ?? "",
      contact: selectedSupplier?.contact ?? "",
      phone: selectedSupplier?.phone ?? "",
      email: selectedSupplier?.email ?? "",
      notes: selectedSupplier?.notes ?? "",
    });
    setSupplierFormError(null);
    setIsSupplierDialogOpen(true);
  };

  const closeSupplierDialog = () => {
    setIsSupplierDialogOpen(false);
    setSupplierFormError(null);
  };

  const handleSupplierFormChange = (field: keyof SupplierDetails, value: string) => {
    setSupplierForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSupplierFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = supplierForm.name.trim();
    if (!trimmedName) {
      setSupplierFormError("Supplier name is required.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          taxId: supplierForm.taxId.trim() || null,
          contact: supplierForm.contact.trim() || null,
          phone: supplierForm.phone.trim() || null,
          email: supplierForm.email.trim() || null,
          notes: supplierForm.notes.trim() || null,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        supplier?: SupplierSearchResult;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudo guardar el proveedor");
      }

      if (body.supplier) {
        const nextSupplier: SupplierDetails = {
          id: body.supplier.id,
          name: body.supplier.name,
          taxId: body.supplier.taxId,
          contact: body.supplier.contact,
          phone: body.supplier.phone,
          email: body.supplier.email,
          notes: body.supplier.notes,
        };

        setSelectedSupplier(nextSupplier);
        setSupplierName(trimmedName);
        setSupplierFormError(null);
        setIsSupplierDialogOpen(false);
        setShowSupplierDropdown(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el proveedor";
      setSupplierFormError(message);
    }
  };

  const searchSuppliers = async (query: string) => {
    if (query.trim().length < 2) {
      setSupplierSearchResults([]);
      setShowSupplierDropdown(false);
      return;
    }

    setIsSearchingSuppliers(true);
    try {
      const params = new URLSearchParams();
      params.set("q", query.trim());
      
      const response = await fetch(`${API_BASE_URL}/api/suppliers/search?${params.toString()}`);
      const body = (await response.json().catch(() => ({}))) as {
        suppliers?: SupplierSearchResult[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudieron cargar los proveedores");
      }

      setSupplierSearchResults(Array.isArray(body.suppliers) ? body.suppliers : []);
      setShowSupplierDropdown(true);
    } catch (error) {
      console.error("Error searching suppliers", error);
      setSupplierSearchResults([]);
      setShowSupplierDropdown(false);
    } finally {
      setIsSearchingSuppliers(false);
    }
  };

  const handleSupplierNameChange = (value: string) => {
    setSupplierName(value);
    setSelectedSupplier(null);
    void searchSuppliers(value);
  };

  const handleSupplierNameKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const trimmed = supplierName.trim();
      
      // If there are search results, select the first one
      if (supplierSearchResults.length > 0) {
        const firstResult = supplierSearchResults[0];
        handleSelectSupplier(firstResult);
      } else if (trimmed.length >= 2) {
        // If no results but has text, open dialog with the name
        openSupplierDialog(trimmed);
        setShowSupplierDropdown(false);
      }
    } else if (event.key === "Escape") {
      setShowSupplierDropdown(false);
    }
  };

  const handleSelectSupplier = (supplier: SupplierSearchResult) => {
    setSupplierName(supplier.name);
    setSelectedSupplier({
      id: supplier.id,
      name: supplier.name,
      taxId: supplier.taxId ?? "",
      contact: supplier.contact ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      notes: supplier.notes ?? "",
    });
    setShowSupplierDropdown(false);
    setSupplierSearchResults([]);
  };

  useEffect(() => {
    setBranchId((prev) => {
      const next = activeBranch ? String(activeBranch.id) : "";
      return prev === next ? prev : next;
    });
  }, [activeBranch]);

  useEffect(() => {
    async function loadMetadata() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/codes?page=1&pageSize=1`);
        const body = (await response.json().catch(() => ({}))) as {
          metadata?: { layouts?: LayoutOption[] };
        };

        if (Array.isArray(body.metadata?.layouts) && body.metadata!.layouts!.length > 0) {
          setAvailableLayouts(body.metadata!.layouts!);
          setLayoutId((prev) => {
            if (prev) {
              return prev;
            }
            return body.metadata!.layouts![0]!.id;
          });
        }
      } catch (error) {
        console.error("Unable to load purchase metadata", error);
      }
    }

    loadMetadata();
  }, []);

  useEffect(() => {
    if (!isSupplierDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSupplierDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSupplierDialogOpen]);

  const totals = useMemo(() => {
    let totalQuantity = 0;
    let totalCostCents = 0;

    for (const line of lines) {
      const qty = Number.parseInt(line.quantity, 10);
      const unitCostCents = parseAmountToCents(line.unitCost);

      if (Number.isInteger(qty) && qty > 0 && unitCostCents != null) {
        totalQuantity += qty;
        totalCostCents += unitCostCents * qty;
      }
    }

    return { totalQuantity, totalCostCents };
  }, [lines]);

  const savedTotals = useMemo(() => {
    if (!savedRecord) {
      return { totalQuantity: 0, totalCostCents: 0 };
    }

    return savedRecord.lines.reduce(
      (acc, line) => {
        acc.totalQuantity += Number(line.quantity ?? 0);
        acc.totalCostCents += Number(line.lineTotalCents ?? 0);
        return acc;
      },
      { totalQuantity: 0, totalCostCents: 0 }
    );
  }, [savedRecord]);

  const runSearch = async () => {
    setStatus(null);
    setPreview(null);
    setSavedRecord(null);

    const query = searchTerm.trim();
    if (query.length < 2) {
      setStatus({ tone: "error", message: "Ingresa al menos 2 caracteres para buscar." });
      return;
    }

    setSearching(true);
    setSearchResults([]);
    try {
      const params = new URLSearchParams();
      params.set("q", query);
      params.set("pageSize", "8");
      params.set("status", "active");

      const response = await fetch(`${API_BASE_URL}/api/codes?${params.toString()}`);
      const body = (await response.json().catch(() => ({}))) as {
        items?: CodeResult[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudieron cargar los productos");
      }

      setSearchResults(Array.isArray(body.items) ? body.items : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fallo la búsqueda";
      setStatus({ tone: "error", message });
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void runSearch();
    }
  };

  const addLineFromCode = (code: CodeResult) => {
    setStatus(null);
    setPreview(null);
    setSavedRecord(null);

    const resolvedBranchId = activeBranch ? activeBranch.id : branchId ? Number(branchId) : null;

    if (resolvedBranchId == null) {
      setBranchId(String(code.branchId));
    } else if (Number(resolvedBranchId) !== Number(code.branchId)) {
      setStatus({
        tone: "error",
        message: "Todas las líneas deben pertenecer a la misma sucursal.",
      });
      return;
    }

    setLines((previous) => {
      const existing = previous.find((line) => line.productCodeVersionId === code.productCodeVersionId);
      const defaultCostCents =
        code.costCents != null
          ? Number(code.costCents)
          : code.priceCents != null
          ? Number(code.priceCents)
          : 0;
      const defaultCost = defaultCostCents > 0 ? (defaultCostCents / 100).toFixed(2) : "";

      if (existing) {
        return previous.map((line) =>
          line.productCodeVersionId === existing.productCodeVersionId
            ? {
                ...line,
                quantity: String(Number.parseInt(line.quantity, 10) + 1 || 1),
              }
            : line
        );
      }

      return [
        ...previous,
        {
          key: makeLineKey(),
          productCodeVersionId: code.productCodeVersionId,
          code: code.code,
          name: code.name,
          branchId: code.branchId,
          branchName: code.branchName,
          sku: code.sku,
          quantity: "1",
          unitCost: defaultCost,
          labelQuantity: "1",
        },
      ];
    });

    setSearchTerm("");
    setSearchResults([]);
  };

  const generateProductCode = (): string => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PROD-${timestamp}-${random}`.slice(0, 64);
  };

  const openNewProductDialog = () => {
    setNewProductForm({
      name: "",
      sku: "",
      description: "",
      price: "",
      cost: "",
    });
    setNewProductFormError(null);
    setIsNewProductDialogOpen(true);
  };

  const closeNewProductDialog = () => {
    setIsNewProductDialogOpen(false);
    setNewProductFormError(null);
  };

  const handleNewProductFormChange = (field: keyof typeof newProductForm, value: string) => {
    setNewProductForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNewProductSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewProductFormError(null);

    // Generate code automatically
    const code = generateProductCode();
    const name = newProductForm.name.trim();
    const sku = newProductForm.sku.trim() || null;
    const description = newProductForm.description.trim() || null;
    const price = parseAmountToCents(newProductForm.price);
    const cost = parseAmountToCents(newProductForm.cost);

    if (!name) {
      setNewProductFormError("El nombre del producto es requerido.");
      return;
    }

    if (price === null || price <= 0) {
      setNewProductFormError("El precio debe ser mayor a cero.");
      return;
    }

    if (cost === null || cost <= 0) {
      setNewProductFormError("El costo debe ser mayor a cero.");
      return;
    }

    if (!activeBranch) {
      setNewProductFormError("Configura una sucursal activa antes de agregar productos.");
      return;
    }

    // Check if code already exists in lines (unlikely but possible)
    const codeExists = lines.some((line) => line.code === code);
    if (codeExists) {
      // Regenerate code if collision (very unlikely)
      const newCode = generateProductCode();
      setNewProductFormError("Código generado duplicado. Intenta nuevamente.");
      return;
    }

    // Add as new product line
    setLines((previous) => [
      ...previous,
      {
        key: makeLineKey(),
        productCodeVersionId: null, // null indicates new product
        code,
        name,
        branchId: activeBranch.id,
        branchName: activeBranch.name,
        sku,
        quantity: "1",
        unitCost: (cost / 100).toFixed(2),
        labelQuantity: "1",
        isNew: true,
        newProductData: {
          code,
          name,
          sku,
          description,
          priceCents: price,
          costCents: cost,
        },
      },
    ]);

    closeNewProductDialog();
  };

  const removeLine = (key: string) => {
    setLines((previous) => previous.filter((line) => line.key !== key));
  };

  const updateLine = (key: string, field: keyof PurchaseLineInput, value: string) => {
    setLines((previous) =>
      previous.map((line) => (line.key === key ? { ...line, [field]: value } : line))
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setPreview(null);
    setSavedRecord(null);

    if (!activeBranch) {
      setStatus({
        tone: "error",
        message: branchError ?? "Configura una sucursal activa en ajustes antes de recibir compras.",
      });
      return;
    }

    if (lines.length === 0) {
      setStatus({ tone: "error", message: "Agrega al menos una línea de producto." });
      return;
    }

    const parsedLines: Array<{
      productCodeVersionId: number | null;
      quantity: number;
      unitCostCents: number;
      labelQuantity: number;
    }> = [];
    const newProducts: Array<{
      code: string;
      name: string;
      sku: string | null;
      description: string | null;
      priceCents: number;
      costCents: number;
    }> = [];
    let totalLabels = 0;

    for (const line of lines) {
      const quantity = Number.parseInt(line.quantity, 10);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        setStatus({
          tone: "error",
          message: `La cantidad de ${line.code} debe ser un entero mayor a cero.`,
        });
        return;
      }

      const unitCostCents = parseAmountToCents(line.unitCost);
      if (unitCostCents == null) {
        setStatus({
          tone: "error",
          message: `El costo unitario de ${line.code} debe ser mayor a 0.`,
        });
        return;
      }

      const labelQuantityRaw = line.labelQuantity.trim();
      const labelQuantity = labelQuantityRaw === ""
        ? quantity
        : Number.parseInt(labelQuantityRaw, 10);

      if (!Number.isInteger(labelQuantity) || labelQuantity < 0) {
        setStatus({
          tone: "error",
          message: `La cantidad de etiquetas de ${line.code} debe ser cero o un entero positivo.`,
        });
        return;
      }

      totalLabels += labelQuantity;

      if (line.isNew && line.newProductData) {
        newProducts.push(line.newProductData);
        parsedLines.push({
          productCodeVersionId: null, // Will be set after product creation
          quantity,
          unitCostCents,
          labelQuantity,
        });
      } else if (line.productCodeVersionId != null) {
        parsedLines.push({
          productCodeVersionId: line.productCodeVersionId,
          quantity,
          unitCostCents,
          labelQuantity,
        });
      } else {
        setStatus({
          tone: "error",
          message: `Error en la línea ${line.code}: falta información del producto.`,
        });
        return;
      }
    }

    if (totalLabels > MAX_LABELS) {
      setStatus({
        tone: "error",
        message: `Solicita máximo ${MAX_LABELS} etiquetas por recepción.`,
      });
      return;
    }

    const payload = {
      branchId: activeBranch.id,
      supplierName: supplierName.trim() || null,
      supplierInvoice: supplierInvoice.trim() || null,
      reference: referenceNo.trim() || null,
      receivedAt: receivedAt || null,
      notes: notes.trim() || null,
      layout: layoutId || null,
      includePrice,
      labelNote: labelNote.trim() || null,
      newProducts: newProducts.length > 0 ? newProducts : undefined,
      lines: parsedLines.map((line) => ({
        productCodeVersionId: line.productCodeVersionId,
        quantity: line.quantity,
        unitCostCents: line.unitCostCents,
        labelQuantity: line.labelQuantity,
      })),
    };

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => ({}))) as PurchaseResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudo registrar la compra");
      }

      setStatus({ tone: "success", message: "Compra registrada correctamente." });
      setPreview(body);
      setVerifyingSave(true);
      const verified = await fetchSavedPurchase(body.purchase.id);
      if (!verified) {
        setStatus({
          tone: "error",
          message: "Compra guardada, pero no se pudo confirmar en la base de datos.",
        });
      } else {
        setStatus({ tone: "success", message: "Compra registrada y verificada en la base de datos." });
      }
      setLines([]);
      setSearchResults([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar la compra";
      setStatus({ tone: "error", message });
    } finally {
      setSubmitting(false);
      setVerifyingSave(false);
    }
  };

  const fetchSavedPurchase = async (purchaseId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchases/${purchaseId}`);
      const body = (await response.json().catch(() => ({}))) as SavedPurchaseResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudo verificar la recepción en la base de datos");
      }

      setSavedRecord(body);
      return true;
    } catch (error) {
      console.error("Error verifying saved purchase", error);
      return false;
    }
  };

  return (
    <>
      <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Recepción de compras</h1>
        <p className="text-sm text-slate-600">
          Registra facturas de proveedores, ajusta existencias y genera etiquetas listas para imprimir.
        </p>
      </header>

      {branchLoading ? (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Sincronizando configuración de sucursal…
        </div>
      ) : !activeBranch ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-200">
          Configura una sucursal predeterminada en Ajustes → Sistema para recibir mercancía.
        </div>
      ) : branchError ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200">
          {branchError}
        </div>
      ) : null}

      {status && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            status.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1 text-sm text-slate-700">
            <span>Sucursal</span>
            {branchLoading ? (
              <span className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando…
              </span>
            ) : branchError ? (
              <span className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {branchError}
              </span>
            ) : activeBranch ? (
              <span className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
                {activeBranch.name}
              </span>
            ) : (
              <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Configura una sucursal activa en ajustes
              </span>
            )}
          </div>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Fecha de recepción
            <input
              type="date"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              value={receivedAt}
              onChange={(event) => setReceivedAt(event.target.value)}
            />
          </label>

          <div className="flex flex-col gap-2 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Proveedor</span>
              <button
                type="button"
                onClick={() => openSupplierDialog()}
                className="text-xs font-semibold text-sky-600 transition hover:text-sky-500"
              >
                Añadir proveedor
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={supplierName}
                onChange={(event) => handleSupplierNameChange(event.target.value)}
                onKeyDown={handleSupplierNameKeyDown}
                onFocus={() => {
                  if (supplierName.trim().length >= 2) {
                    void searchSuppliers(supplierName);
                  }
                }}
                onBlur={() => {
                  // Delay hiding dropdown to allow click on results
                  setTimeout(() => setShowSupplierDropdown(false), 200);
                }}
                placeholder="Nombre del proveedor"
              />
              {showSupplierDropdown && supplierSearchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
                  <ul className="max-h-60 overflow-auto py-1">
                    {supplierSearchResults.map((supplier) => (
                      <li key={supplier.id}>
                        <button
                          type="button"
                          className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                          onClick={() => handleSelectSupplier(supplier)}
                        >
                          <div className="font-medium">{supplier.name}</div>
                          {supplier.taxId && (
                            <div className="text-xs text-slate-500">RNC: {supplier.taxId}</div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {isSearchingSuppliers && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              )}
            </div>
            {selectedSupplier ? (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                <p className="font-semibold text-slate-700 dark:text-slate-100">
                  {selectedSupplier.contact || "Contacto principal"}
                </p>
                <p>
                  {[selectedSupplier.phone, selectedSupplier.email].filter((value) => value).join(" • ") || "Sin datos de contacto"}
                </p>
                {selectedSupplier.taxId ? <p>RNC: {selectedSupplier.taxId}</p> : null}
              </div>
            ) : null}
          </div>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Factura / Documento
            <input
              type="text"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              value={supplierInvoice}
              onChange={(event) => setSupplierInvoice(event.target.value)}
              placeholder="Número de factura"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Referencia interna
            <input
              type="text"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              value={referenceNo}
              onChange={(event) => setReferenceNo(event.target.value)}
              placeholder="Opcional"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Nota interna
            <textarea
              className="h-24 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Comentarios adicionales"
            />
          </label>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Layout de etiqueta
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              value={layoutId}
              onChange={(event) => setLayoutId(event.target.value)}
            >
              {availableLayouts.length === 0 && <option value="">Por defecto</option>}
              {availableLayouts.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={includePrice}
              onChange={(event) => setIncludePrice(event.target.checked)}
            />
            Incluir precio en la etiqueta
          </label>

          <label className="md:col-span-2 flex flex-col gap-1 text-sm text-slate-700">
            Nota para etiqueta (opcional)
            <input
              type="text"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              value={labelNote}
              onChange={(event) => setLabelNote(event.target.value)}
              placeholder="Texto corto impreso en las etiquetas"
              maxLength={140}
            />
          </label>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-slate-500" />
              <input
                type="text"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar por código, nombre o SKU"
              />
              <button
                type="button"
                onClick={() => void runSearch()}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                disabled={searching}
              >
                <ClipboardList className="h-4 w-4" /> {searching ? "Buscando" : "Buscar"}
              </button>
              <button
                type="button"
                onClick={openNewProductDialog}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                <Plus className="h-4 w-4" /> Agregar
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="grid gap-2 md:grid-cols-2">
                {searchResults.map((result) => (
                  <button
                    type="button"
                    key={result.productCodeVersionId}
                    onClick={() => addLineFromCode(result)}
                    className="flex flex-col items-start gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm text-emerald-800 hover:border-emerald-300"
                  >
                    <span className="font-medium">{result.code}</span>
                    <span>{result.name}</span>
                    <span className="text-xs text-emerald-700">
                      {result.branchName ?? `Sucursal ${result.branchId}`} · Exist. c/ costo {centsToCurrency(result.costCents)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2">Código</th>
                  <th className="px-4 py-2">Descripción</th>
                  <th className="px-4 py-2">Cantidad</th>
                  <th className="px-4 py-2">Costo unitario</th>
                  <th className="px-4 py-2">Etiquetas</th>
                  <th className="px-4 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Usa la búsqueda para agregar productos a la recepción.
                    </td>
                  </tr>
                )}
                {lines.map((line) => (
                  <tr key={line.key} className={`hover:bg-slate-50 ${line.isNew ? "bg-blue-50" : ""}`}>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {line.code}
                      {line.isNew && (
                        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                          Nuevo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{line.name}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={1}
                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
                        value={line.quantity}
                        onChange={(event) => updateLine(line.key, "quantity", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
                        value={line.unitCost}
                        onChange={(event) => updateLine(line.key, "unitCost", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
                        value={line.labelQuantity}
                        onChange={(event) => updateLine(line.key, "labelQuantity", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" /> Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Total artículos</span>
              <strong>{totals.totalQuantity}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Total costo</span>
              <strong>{centsToCurrency(totals.totalCostCents)}</strong>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
            disabled={submitting || branchLoading || !activeBranch}
          >
            <PackagePlus className="h-4 w-4" /> Registrar compra
          </button>
        </div>
      </form>

      {preview && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Printer className="h-5 w-5" /> Resumen de recepción #{preview.purchase.id}
          </h2>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="font-medium">Proveedor</p>
              <p>{preview.purchase.supplierName ?? "-"}</p>
            </div>
            <div>
              <p className="font-medium">Referencia</p>
              <p>{preview.purchase.referenceNo ?? "-"}</p>
            </div>
            <div>
              <p className="font-medium">Total costo</p>
              <p>{centsToCurrency(preview.totals.totalCostCents)}</p>
            </div>
            <div>
              <p className="font-medium">Etiquetas generadas</p>
              <p>
                {preview.labels.totalLabels} etiquetas · Layout {preview.purchase.labelLayout ?? preview.labels.layout.id}
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-emerald-200 bg-white">
            <table className="min-w-full divide-y divide-emerald-100 text-sm">
              <thead className="bg-emerald-100 text-left text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <tr>
                  <th className="px-4 py-2">Código</th>
                  <th className="px-4 py-2">Descripción</th>
                  <th className="px-4 py-2">Cantidad</th>
                  <th className="px-4 py-2">Costo unitario</th>
                  <th className="px-4 py-2">Etiquetas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {preview.lines.map((line) => (
                  <tr key={`${line.productCodeVersionId}-${line.quantity}`}>
                    <td className="px-4 py-2 font-medium">{line.code ?? line.productCodeVersionId}</td>
                    <td className="px-4 py-2">{line.name ?? "-"}</td>
                    <td className="px-4 py-2">{line.quantity}</td>
                    <td className="px-4 py-2">{centsToCurrency(line.unitCostCents)}</td>
                    <td className="px-4 py-2">{line.labelQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {verifyingSave ? (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          Validando que la recepción quedó guardada en la base de datos…
        </div>
      ) : null}

      {savedRecord && (
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-900 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Registro guardado en base de datos</h2>
              <p className="text-sm text-slate-600">
                Datos consultados desde la tabla <code>purchases</code> y sus líneas en MySQL.
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Creado: {formatDisplayDate(savedRecord.purchase.createdAt)}</p>
              <p>Actualizado: {formatDisplayDate(savedRecord.purchase.updatedAt)}</p>
            </div>
          </div>

          <dl className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <dt className="text-xs font-medium text-slate-600">Proveedor</dt>
              <dd className="text-sm font-semibold text-slate-900">
                {savedRecord.purchase.supplierName ?? "-"}
              </dd>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <dt className="text-xs font-medium text-slate-600">Referencia</dt>
              <dd className="text-sm font-semibold text-slate-900">
                {savedRecord.purchase.referenceNo ?? "-"}
              </dd>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <dt className="text-xs font-medium text-slate-600">Fecha de recepción</dt>
              <dd className="text-sm font-semibold text-slate-900">
                {formatDisplayDate(savedRecord.purchase.receivedAt)}
              </dd>
            </div>
          </dl>

          <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2">Código</th>
                  <th className="px-4 py-2">Descripción</th>
                  <th className="px-4 py-2">Cantidad</th>
                  <th className="px-4 py-2">Costo unitario</th>
                  <th className="px-4 py-2">Total línea</th>
                  <th className="px-4 py-2">Disponibles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {savedRecord.lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No se encontraron líneas guardadas para esta recepción.
                    </td>
                  </tr>
                ) : (
                  savedRecord.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{line.code ?? line.productCodeVersionId}</td>
                      <td className="px-4 py-2 text-slate-700">{line.name ?? "-"}</td>
                      <td className="px-4 py-2">{line.quantity}</td>
                      <td className="px-4 py-2">{centsToCurrency(line.unitCostCents)}</td>
                      <td className="px-4 py-2">{centsToCurrency(line.lineTotalCents)}</td>
                      <td className="px-4 py-2 text-slate-700">{line.availableQuantity}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Total artículos guardados</span>
              <strong>{savedTotals.totalQuantity}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Total costo guardado</span>
              <strong>{centsToCurrency(savedTotals.totalCostCents)}</strong>
            </div>
          </div>
        </section>
      )}
    </div>
    {isSupplierDialogOpen ? (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
        onClick={closeSupplierDialog}
      >
        <form
          className="w-full max-w-2xl space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          onClick={(event) => event.stopPropagation()}
          onSubmit={handleSupplierFormSubmit}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Registrar proveedor</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Captura el RNC, contacto y notas para reutilizarlo en recepciones futuras.
              </p>
            </div>
            <button
              type="button"
              onClick={closeSupplierDialog}
              className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Nombre comercial
              <input
                value={supplierForm.name}
                onChange={(event) => handleSupplierFormChange("name", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Electro Caribe SRL"
              />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              RNC / Tax ID
              <input
                value={supplierForm.taxId}
                onChange={(event) => handleSupplierFormChange("taxId", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="1-01-12345-6"
              />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Contacto principal
              <input
                value={supplierForm.contact}
                onChange={(event) => handleSupplierFormChange("contact", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="María Gómez"
              />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Teléfono
              <input
                value={supplierForm.phone}
                onChange={(event) => handleSupplierFormChange("phone", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="809-555-0123"
              />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 sm:col-span-2">
              Correo electrónico
              <input
                type="email"
                value={supplierForm.email}
                onChange={(event) => handleSupplierFormChange("email", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="compras@proveedor.com"
              />
            </label>
          </div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Notas
            <textarea
              value={supplierForm.notes}
              onChange={(event) => handleSupplierFormChange("notes", event.target.value)}
              className="mt-1 h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Condiciones de pago, transportista preferido, etc."
            />
          </label>
          {supplierFormError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200">
              {supplierFormError}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeSupplierDialog}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500"
            >
              Guardar proveedor
            </button>
          </div>
        </form>
      </div>
    ) : null}
    {isNewProductDialogOpen ? (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
        onClick={closeNewProductDialog}
      >
        <form
          className="w-full max-w-2xl space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          onClick={(event) => event.stopPropagation()}
          onSubmit={handleNewProductSubmit}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Agregar nuevo producto</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Crea un producto nuevo que se está comprando por primera vez.
              </p>
            </div>
            <button
              type="button"
              onClick={closeNewProductDialog}
              className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              SKU
              <input
                value={newProductForm.sku}
                onChange={(event) => handleNewProductFormChange("sku", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="SKU-001"
              />
            </label>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Código
              <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                Se generará automáticamente
              </div>
            </div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 sm:col-span-2">
              Nombre *
              <input
                value={newProductForm.name}
                onChange={(event) => handleNewProductFormChange("name", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Nombre del producto"
                required
              />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300 sm:col-span-2">
              Descripción
              <textarea
                value={newProductForm.description}
                onChange={(event) => handleNewProductFormChange("description", event.target.value)}
                className="mt-1 h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Descripción del producto"
              />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Precio de venta (RD$) *
              <input
                type="text"
                inputMode="decimal"
                value={newProductForm.price}
                onChange={(event) => handleNewProductFormChange("price", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="0.00"
                required
              />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Costo unitario (RD$) *
              <input
                type="text"
                inputMode="decimal"
                value={newProductForm.cost}
                onChange={(event) => handleNewProductFormChange("cost", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="0.00"
                required
              />
            </label>
          </div>
          {newProductFormError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200">
              {newProductFormError}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeNewProductDialog}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500"
            >
              Agregar producto
            </button>
          </div>
        </form>
      </div>
    ) : null}
    </>
  );
}
