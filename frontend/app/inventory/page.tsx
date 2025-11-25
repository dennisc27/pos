"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Edit3,
  Loader2,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Printer,
  RefreshCcw,
  Search,
  Tag,
  XCircle,
} from "lucide-react";

import { formatCurrencyFromCents } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const numberFormatter = new Intl.NumberFormat("es-DO");
const dateTimeFormatter = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
  timeStyle: "short",
});

const availabilityOptions = [
  { value: "all", label: "Disponibilidad" },
  { value: "in_stock", label: "Con stock" },
  { value: "low_stock", label: "Stock bajo" },
  { value: "reserved", label: "Reservado" },
  { value: "out_of_stock", label: "Sin stock" },
] as const;

const statusOptions = [
  { value: "all", label: "Estado" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
] as const;

const sortFieldOptions = [
  { value: "name", label: "Nombre" },
  { value: "code", label: "Código" },
  { value: "updatedAt", label: "Actualización" },
  { value: "qtyOnHand", label: "Existencia" },
  { value: "priceCents", label: "Precio" },
] as const;

const sortDirectionOptions = [
  { value: "asc", label: "Asc" },
  { value: "desc", label: "Desc" },
] as const;

const pageSizeOptions = [25, 50, 100, 150, 200];

type InventoryItem = {
  productCodeId: number;
  productCodeVersionId: number;
  code: string;
  name: string;
  sku: string | null;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
  branchId: number;
  branchName: string | null;
  priceCents: number | null;
  costCents: number | null;
  qtyOnHand: number;
  qtyReserved: number;
  availableQty: number;
  isActive: boolean;
  updatedAt: string | null;
};

type InventorySummary = {
  totalVariants: number;
  totalSkus: number;
  totalQtyOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  totalRetailValueCents: number;
};

type InventoryResponse = {
  items: InventoryItem[];
  summary: InventorySummary;
  pagination: {
    page: number;
    pageSize: number;
    hasMore: boolean;
    nextPage: number | null;
  };
  metadata: {
    branches: { id: number; name: string }[];
    categories: { id: number; name: string }[];
  };
  filtersApplied: {
    search: string;
    branchIds: number[];
    categoryIds: number[];
    productCodeIds: number[];
    productCodeVersionIds: number[];
    status: string;
    availability: string;
    lowStockThreshold: number;
    page: number;
    pageSize: number;
    sortField: string;
    sortDirection: string;
  };
  warnings?: {
    missingBranchIds?: number[];
  };
};

type LabelItem = {
  productCodeVersionId: number;
  productCodeId: number;
  code: string;
  name: string;
  sku: string | null;
  branchId: number;
  branchName: string | null;
  priceCents: number | null;
  qrPayload: string;
  note: string | null;
};

type LabelBatch = {
  generatedAt: string;
  totalLabels: number;
  labels: LabelItem[];
  warnings?: {
    missingVersionIds?: number[];
  };
};

type InventoryFilters = {
  search: string;
  branchId: number | "all";
  categoryId: number | "all";
  status: "all" | "active" | "inactive";
  availability: "all" | "in_stock" | "out_of_stock" | "reserved" | "low_stock";
  sortField: (typeof sortFieldOptions)[number]["value"];
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
  lowStockThreshold: number;
};

const defaultFilters: InventoryFilters = {
  search: "",
  branchId: "all",
  categoryId: "all",
  status: "all",
  availability: "all",
  sortField: "name",
  sortDirection: "asc",
  page: 1,
  pageSize: 50,
  lowStockThreshold: 3,
};

type FlashMessage = { tone: "success" | "error"; message: string } | null;

type EditFormState = {
  name: string;
  sku: string;
  description: string;
  price: string;
  cost: string;
  qtyOnHand: string;
  qtyReserved: string;
  isActive: boolean;
  categoryId: string;
};

function buildFiltersPayload(filters: InventoryFilters) {
  const payload: Record<string, unknown> = {
    search: filters.search.trim(),
    page: filters.page,
    pageSize: filters.pageSize,
    sortField: filters.sortField,
    sortDirection: filters.sortDirection,
    lowStockThreshold: filters.lowStockThreshold,
  };

  if (filters.status !== "all") {
    payload.status = filters.status;
  }

  if (filters.availability !== "all") {
    payload.availability = filters.availability;
  }

  if (filters.branchId !== "all") {
    payload.branchIds = [filters.branchId];
  }

  if (filters.categoryId !== "all") {
    payload.categoryIds = [filters.categoryId];
  }

  return payload;
}

function computeSummary(items: InventoryItem[]): InventorySummary {
  const skuSet = new Set(items.map((item) => item.productCodeId));
  const totalQtyOnHand = items.reduce((sum, item) => sum + item.qtyOnHand, 0);
  const totalReserved = items.reduce((sum, item) => sum + item.qtyReserved, 0);
  const totalAvailable = items.reduce((sum, item) => sum + item.availableQty, 0);
  const totalRetailValueCents = items.reduce((sum, item) => {
    const price = Number.isFinite(item.priceCents) && item.priceCents !== null ? item.priceCents : 0;
    return sum + price * item.qtyOnHand;
  }, 0);

  return {
    totalVariants: items.length,
    totalSkus: skuSet.size,
    totalQtyOnHand,
    totalReserved,
    totalAvailable,
    totalRetailValueCents,
  };
}

function normalizeNumberInput(raw: string) {
  if (!raw.trim()) {
    return undefined;
  }

  const normalized = raw.replace(/\s+/g, "").replace(/,/g, ".");
  const value = Number(normalized);

  if (!Number.isFinite(value)) {
    return undefined;
  }

  return value;
}
function InventoryPage() {
  const [filters, setFilters] = useState<InventoryFilters>(defaultFilters);
  const [searchInput, setSearchInput] = useState(defaultFilters.search);
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<FlashMessage>(null);
  const [labelConfig, setLabelConfig] = useState<Record<number, number>>({});
  const [labelNote, setLabelNote] = useState("");
  const [includePriceOnLabels, setIncludePriceOnLabels] = useState(true);
  const [labelPreview, setLabelPreview] = useState<LabelBatch | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchInventory = useCallback(
    async (filtersToLoad: InventoryFilters, options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const payload = buildFiltersPayload(filtersToLoad);
        const params = new URLSearchParams({ filters: JSON.stringify(payload) });
        const response = await fetch(`${API_BASE_URL}/api/inventory?${params.toString()}`);
        const responseBody = (await response.json().catch(() => ({}))) as Partial<InventoryResponse> & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(responseBody?.error ?? "No se pudo cargar el inventario");
        }

        const typedBody = responseBody as InventoryResponse;
        setData(typedBody);

        const responsePage = Number(typedBody?.filtersApplied?.page ?? filtersToLoad.page);
        if (!Number.isNaN(responsePage) && responsePage !== filtersToLoad.page) {
          setFilters((previous) => {
            if (previous.page === responsePage) {
              return previous;
            }

            return { ...previous, page: responsePage };
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo cargar el inventario";
        setError(message);
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    fetchInventory(filters);
  }, [filters, fetchInventory]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setFilters((previous) => {
        if (previous.search === searchInput && previous.page === 1) {
          return previous;
        }

        return { ...previous, search: searchInput, page: 1 };
      });
    }, 350);

    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (!data) {
      return;
    }

    setLabelConfig((previous) => {
      const validIds = new Set(data.items.map((item) => item.productCodeVersionId));
      const next: Record<number, number> = {};

      for (const [key, value] of Object.entries(previous)) {
        const versionId = Number(key);
        if (validIds.has(versionId)) {
          next[versionId] = value;
        }
      }

      return next;
    });
  }, [data]);

  useEffect(() => {
    if (!editingItem) {
      setEditForm(null);
      return;
    }

    setEditForm({
      name: editingItem.name ?? "",
      sku: editingItem.sku ?? "",
      description: editingItem.description ?? "",
      price: editingItem.priceCents != null ? (editingItem.priceCents / 100).toFixed(2) : "",
      cost: editingItem.costCents != null ? (editingItem.costCents / 100).toFixed(2) : "",
      qtyOnHand: editingItem.qtyOnHand.toString(),
      qtyReserved: editingItem.qtyReserved.toString(),
      isActive: editingItem.isActive,
      categoryId: editingItem.categoryId != null ? String(editingItem.categoryId) : "",
    });
  }, [editingItem]);

  const branchOptions = useMemo(() => {
    const options = [...(data?.metadata.branches ?? [])];
    if (filters.branchId !== "all") {
      const exists = options.some((option) => option.id === filters.branchId);
      if (!exists) {
        const fallbackName =
          data?.items.find((item) => item.branchId === filters.branchId)?.branchName ??
          `Sucursal ${filters.branchId}`;
        options.push({ id: filters.branchId, name: fallbackName });
      }
    }

    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [data, filters.branchId]);

  const categoryOptions = useMemo(() => {
    const options = [...(data?.metadata.categories ?? [])];
    if (filters.categoryId !== "all") {
      const exists = options.some((option) => option.id === filters.categoryId);
      if (!exists) {
        const fallbackName =
          data?.items.find((item) => item.categoryId === filters.categoryId)?.categoryName ??
          `Categoría ${filters.categoryId}`;
        options.push({ id: filters.categoryId, name: fallbackName });
      }
    }

    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [data, filters.categoryId]);

  const selectedLabelCount = useMemo(
    () =>
      Object.values(labelConfig).reduce((sum, quantity) => {
        return sum + (quantity > 0 ? quantity : 0);
      }, 0),
    [labelConfig]
  );

  const items = data?.items ?? [];
  const summary = data?.summary ?? computeSummary(items);
  const currentPage = data?.pagination?.page ?? filters.page;
  const hasMore = data?.pagination?.hasMore ?? false;

  const handleToggleLabel = (versionId: number) => {
    setLabelConfig((previous) => {
      const next = { ...previous };
      if (next[versionId]) {
        delete next[versionId];
      } else {
        next[versionId] = 1;
      }
      return next;
    });
  };

  const handleLabelQuantityChange = (versionId: number, value: string) => {
    const numericValue = Number(value);
    setLabelConfig((previous) => {
      const next = { ...previous };
      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        delete next[versionId];
      } else {
        next[versionId] = Math.min(Math.round(numericValue), 50);
      }
      return next;
    });
  };

  const handleGenerateLabels = async () => {
    const itemsPayload = Object.entries(labelConfig)
      .map(([key, quantity]) => ({ productCodeVersionId: Number(key), quantity }))
      .filter((entry) => entry.quantity > 0);

    if (itemsPayload.length === 0) {
      setLabelError("Selecciona al menos un artículo y cantidad");
      return;
    }

    setLabelError(null);
    setFlashMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/labels/qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsPayload,
          includePrice: includePriceOnLabels,
          labelNote: labelNote.trim() || null,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as LabelBatch & { error?: string };

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudieron generar las etiquetas");
      }

      setLabelPreview(body);
      setFlashMessage({
        tone: "success",
        message: `Se generaron ${body.totalLabels ?? 0} etiquetas listas para imprimir`,
      });

      if (body?.warnings?.missingVersionIds?.length) {
        setLabelError(
          `Algunas versiones no fueron encontradas (${body.warnings.missingVersionIds.join(", ")})`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron generar las etiquetas";
      setLabelError(message);
    }
  };

  const handleStartEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFlashMessage(null);
  };

  const handleCancelEdit = () => {
    if (savingEdit) {
      return;
    }
    setEditingItem(null);
  };

  const handleSaveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingItem || !editForm) {
      return;
    }

    if (!editForm.name.trim()) {
      setFlashMessage({ tone: "error", message: "El nombre es obligatorio" });
      return;
    }

    const parsedPrice = normalizeNumberInput(editForm.price);
    const parsedCost = normalizeNumberInput(editForm.cost);
    const parsedQtyOnHand = normalizeNumberInput(editForm.qtyOnHand);
    const parsedQtyReserved = normalizeNumberInput(editForm.qtyReserved);

    if (parsedQtyOnHand === undefined || parsedQtyReserved === undefined) {
      setFlashMessage({ tone: "error", message: "Las cantidades deben ser números válidos" });
      return;
    }

    if (parsedPrice !== undefined && parsedPrice < 0) {
      setFlashMessage({ tone: "error", message: "El precio debe ser mayor o igual a cero" });
      return;
    }

    if (parsedCost !== undefined && parsedCost < 0) {
      setFlashMessage({ tone: "error", message: "El costo debe ser mayor o igual a cero" });
      return;
    }

    setSavingEdit(true);
    setFlashMessage(null);

    try {
      const payload: Record<string, unknown> = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        sku: editForm.sku.trim() || null,
        categoryId: editForm.categoryId ? Number(editForm.categoryId) : null,
        versionUpdates: [
          {
            branchId: editingItem.branchId,
            priceCents: parsedPrice !== undefined ? Math.round(parsedPrice * 100) : undefined,
            costCents: parsedCost !== undefined ? Math.round(parsedCost * 100) : undefined,
            qtyOnHand: Math.round(parsedQtyOnHand),
            qtyReserved: Math.round(parsedQtyReserved),
            isActive: editForm.isActive,
          },
        ],
      };

      const response = await fetch(`${API_BASE_URL}/api/product-codes/${editingItem.productCodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => ({}))) as InventoryResponse & {
        error?: string;
        warnings?: { missingBranchIds?: number[] };
      };

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudo actualizar el producto");
      }

      await fetchInventory(filters, { silent: true });

      const missingBranches = body?.warnings?.missingBranchIds ?? [];
      if (missingBranches.length > 0) {
        setFlashMessage({
          tone: "error",
          message: `No se pudo actualizar la sucursal ${missingBranches.join(", ")}`,
        });
      } else {
        setFlashMessage({ tone: "success", message: "Producto actualizado correctamente" });
      }

      setEditingItem(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el producto";
      setFlashMessage({ tone: "error", message });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setSearchInput(defaultFilters.search);
  };

  const handleRefresh = () => {
    fetchInventory(filters);
  };

  const handleClearLabelSelection = () => {
    setLabelConfig({});
    setLabelPreview(null);
  };

  const handlePrevPage = () => {
    setFilters((previous) => ({ ...previous, page: Math.max(1, previous.page - 1) }));
  };

  const handleNextPage = () => {
    if (!hasMore) {
      return;
    }

    setFilters((previous) => ({ ...previous, page: previous.page + 1 }));
  };
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Inventario</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Consulta existencias por sucursal, edita precios rápidamente y genera etiquetas QR.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <XCircle className="h-4 w-4" />
              Limpiar filtros
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-6">
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>SKUs únicos</span>
              <Boxes className="h-4 w-4" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{numberFormatter.format(summary.totalSkus)}</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>Existencia</span>
              <PackageCheck className="h-4 w-4" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {numberFormatter.format(summary.totalQtyOnHand)}
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>Reservado</span>
              <PackageMinus className="h-4 w-4" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {numberFormatter.format(summary.totalReserved)}
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>Disponible</span>
              <PackagePlus className="h-4 w-4" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {numberFormatter.format(summary.totalAvailable)}
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>Valor retail</span>
              <Tag className="h-4 w-4" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {formatCurrencyFromCents(summary.totalRetailValueCents)}
            </p>
          </article>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Buscar por nombre, código o SKU"
                  className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              <select
                value={filters.branchId === "all" ? "all" : String(filters.branchId)}
                onChange={(event) => {
                  const value = event.target.value;
                  setFilters((previous) => ({
                    ...previous,
                    branchId: value === "all" ? "all" : Number(value),
                    page: 1,
                  }));
                }}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 md:w-48"
              >
                <option value="all">Todas las sucursales</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>

              <select
                value={filters.categoryId === "all" ? "all" : String(filters.categoryId)}
                onChange={(event) => {
                  const value = event.target.value;
                  setFilters((previous) => ({
                    ...previous,
                    categoryId: value === "all" ? "all" : Number(value),
                    page: 1,
                  }));
                }}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 md:w-48"
              >
                <option value="all">Todas las categorías</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    status: event.target.value as InventoryFilters["status"],
                    page: 1,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 md:w-36"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.availability}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    availability: event.target.value as InventoryFilters["availability"],
                    page: 1,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 md:w-40"
              >
                {availabilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {filters.availability === "low_stock" && (
                <input
                  type="number"
                  min={1}
                  value={filters.lowStockThreshold}
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      lowStockThreshold: Math.max(1, Math.round(Number(event.target.value) || 1)),
                      page: 1,
                    }))
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 md:w-28"
                  placeholder="Umbral"
                />
              )}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <select
                value={filters.sortField}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    sortField: event.target.value as InventoryFilters["sortField"],
                    page: 1,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 md:w-40"
              >
                {sortFieldOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    Orden: {option.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.sortDirection}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    sortDirection: event.target.value as InventoryFilters["sortDirection"],
                    page: 1,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 md:w-28"
              >
                {sortDirectionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.pageSize}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    pageSize: Number(event.target.value),
                    page: 1,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 md:w-28"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}/pág
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {flashMessage && (
          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              flashMessage.tone === "success"
                ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
            }`}
          >
            {flashMessage.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{flashMessage.message}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white/70 dark:bg-slate-900/70">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-600">Actualizando inventario…</span>
              </div>
            )}
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Etiquetas
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Sucursal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Precio
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Costo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Existencia
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Reservado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Disponible
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Actualizado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {items.map((item) => (
                  <tr
                    key={item.productCodeVersionId}
                    className={!item.isActive ? "bg-slate-50 dark:bg-slate-900/60" : undefined}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-700"
                          checked={Boolean(labelConfig[item.productCodeVersionId])}
                          onChange={() => handleToggleLabel(item.productCodeVersionId)}
                        />
                        {labelConfig[item.productCodeVersionId] && (
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={labelConfig[item.productCodeVersionId]}
                            onChange={(event) =>
                              handleLabelQuantityChange(item.productCodeVersionId, event.target.value)
                            }
                            className="w-16 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{item.code}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">{item.name}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">
                        SKU: {item.sku ?? "—"} · {item.categoryName ?? "Sin categoría"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.branchName ?? `Sucursal ${item.branchId}`}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">ID {item.branchId}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {item.priceCents != null ? formatCurrencyFromCents(item.priceCents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                      {item.costCents != null ? formatCurrencyFromCents(item.costCents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {numberFormatter.format(item.qtyOnHand)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                      {numberFormatter.format(item.qtyReserved)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {numberFormatter.format(item.availableQty)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.isActive
                            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {item.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {item.updatedAt ? dateTimeFormatter.format(new Date(item.updatedAt)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="h-4 w-4" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && items.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-300">
                No se encontraron productos con los filtros seleccionados.
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300 md:flex-row md:items-center md:justify-between">
            <span>
              Mostrando {items.length} resultados · Página {currentPage}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Anterior
              </button>
              <span className="px-2 text-slate-500 dark:text-slate-300">{currentPage}</span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={!hasMore}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>

        {editingItem && editForm && (
          <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900 dark:bg-blue-950/40">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                  Edición rápida: {editingItem.code}
                </h2>
                <p className="text-sm text-blue-700 dark:text-blue-200">
                  {editingItem.branchName ?? `Sucursal ${editingItem.branchId}`} · SKU {editingItem.sku ?? "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={savingEdit}
                className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-100 dark:hover:bg-slate-800"
              >
                <XCircle className="h-4 w-4" />
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm text-blue-900 dark:text-blue-100 md:col-span-2">
                Nombre
                <input
                  required
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((previous) =>
                      previous ? { ...previous, name: event.target.value } : previous
                    )
                  }
                  className="rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-100"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-blue-900 dark:text-blue-100">
                SKU
                <input
                  value={editForm.sku}
                  onChange={(event) =>
                    setEditForm((previous) =>
                      previous ? { ...previous, sku: event.target.value } : previous
                    )
                  }
                  className="rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-100"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-blue-900 dark:text-blue-100 md:col-span-2">
                Descripción
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm((previous) =>
                      previous ? { ...previous, description: event.target.value } : previous
                    )
                  }
                  className="rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-100"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-blue-900 dark:text-blue-100">
                Categoría
                <select
                  value={editForm.categoryId}
                  onChange={(event) =>
                    setEditForm((previous) =>
                      previous ? { ...previous, categoryId: event.target.value } : previous
                    )
                  }
                  className="rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-100"
                >
                  <option value="">Sin categoría</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-blue-900">
                Precio (RD$)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editForm.price}
                  onChange={(event) =>
                    setEditForm((previous) =>
                      previous ? { ...previous, price: event.target.value } : previous
                    )
                  }
                  className="rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-100"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-blue-900 dark:text-blue-100">
                Costo (RD$)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editForm.cost}
                  onChange={(event) =>
                    setEditForm((previous) =>
                      previous ? { ...previous, cost: event.target.value } : previous
                    )
                  }
                  className="rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-100"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-blue-900 dark:text-blue-100">
                Existencia
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={editForm.qtyOnHand}
                  onChange={(event) =>
                    setEditForm((previous) =>
                      previous ? { ...previous, qtyOnHand: event.target.value } : previous
                    )
                  }
                  className="rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-100"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-blue-900 dark:text-blue-100">
                Reservado
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={editForm.qtyReserved}
                  onChange={(event) =>
                    setEditForm((previous) =>
                      previous ? { ...previous, qtyReserved: event.target.value } : previous
                    )
                  }
                  className="rounded-md border border-blue-200 px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-100"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-100">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(event) =>
                    setEditForm((previous) =>
                      previous ? { ...previous, isActive: event.target.checked } : previous
                    )
                  }
                  className="h-4 w-4 rounded border-blue-200 dark:border-blue-800"
                />
                Activo en la sucursal
              </label>

              <div className="md:col-span-3 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Guardar cambios
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Etiquetas QR</h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Selecciona artículos en la tabla y genera etiquetas listas para impresión.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={includePriceOnLabels}
                  onChange={(event) => setIncludePriceOnLabels(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-700"
                />
                Incluir precio
              </label>
              <input
                type="text"
                value={labelNote}
                onChange={(event) => setLabelNote(event.target.value)}
                placeholder="Nota opcional"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 md:w-48"
              />
              <div className="text-sm font-medium text-slate-600 dark:text-slate-200">
                Seleccionados: {selectedLabelCount}
              </div>
              <button
                type="button"
                onClick={handleGenerateLabels}
                disabled={selectedLabelCount === 0}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                Generar etiquetas
              </button>
              <button
                type="button"
                onClick={handleClearLabelSelection}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Limpiar selección
              </button>
            </div>
          </div>

          {labelError && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
              <AlertCircle className="h-4 w-4" />
              <span>{labelError}</span>
            </div>
          )}

          {labelPreview && (
            <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <span>Total etiquetas: {labelPreview.totalLabels}</span>
                <span>Generado: {dateTimeFormatter.format(new Date(labelPreview.generatedAt))}</span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {labelPreview.labels.slice(0, 6).map((label) => (
                  <div
                    key={`${label.productCodeVersionId}-${label.qrPayload}`}
                    className="rounded-md bg-white p-3 shadow-sm dark:bg-slate-800"
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {label.code} · {label.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                      {label.branchName ?? `Sucursal ${label.branchId}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">QR: {label.qrPayload}</p>
                    {label.priceCents != null && (
                      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrencyFromCents(label.priceCents)}
                      </p>
                    )}
                    {label.note && <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Nota: {label.note}</p>}
                  </div>
                ))}
              </div>
              {labelPreview.labels.length > 6 && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
                  Se muestran 6 de {labelPreview.labels.length} etiquetas. Usa el JSON para tu flujo de impresión.
                </p>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">
                  Ver JSON completo
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-900/90 p-3 text-xs text-slate-100">
                  {JSON.stringify(labelPreview, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default InventoryPage;
