"use client";

import { FormEvent, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  Eye,
  ArrowLeft,
  Edit,
  X,
} from "lucide-react";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const pesoFormatter = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-DO", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

type LayawaySearchResult = {
  id: number;
  branchId: number;
  customerId: number;
  orderId: number;
  orderNumber: string | null;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  dueDate: string | null;
  status: "active" | "completed" | "cancelled" | "pawned";
  createdAt: string | null;
  updatedAt: string | null;
  customer: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    cedulaNo: string | null;
  };
  itemDescriptions: string[];
};

type SearchFormData = {
  firstName: string;
  lastName: string;
  cedulaNo: string;
  orderNumber: string;
  totalCents: string;
};

function getStatusBadge(status: LayawaySearchResult["status"]) {
  switch (status) {
    case "completed":
      return { label: "Completado", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" };
    case "cancelled":
      return { label: "Cancelado", className: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300" };
    case "pawned":
      return { label: "Empeñado", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" };
    default:
      return { label: "Activo", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" };
  }
}

export default function LayawaysSearchPage() {
  const { branch: activeBranch } = useActiveBranch();
  const [formData, setFormData] = useState<SearchFormData>({
    firstName: "",
    lastName: "",
    cedulaNo: "",
    orderNumber: "",
    totalCents: "",
  });
  const [results, setResults] = useState<LayawaySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [editingLayaway, setEditingLayaway] = useState<LayawaySearchResult | null>(null);
  const [editDueDate, setEditDueDate] = useState("");
  const [editCustomerId, setEditCustomerId] = useState<number | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editItems, setEditItems] = useState<Array<{ id: number; priceCents: string; productName?: string | null }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<Array<{ id: number; name: string; email: string | null; phone: string | null }>>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  const handleInputChange = (field: keyof SearchFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      
      if (formData.firstName.trim()) {
        params.set("firstName", formData.firstName.trim());
      }
      if (formData.lastName.trim()) {
        params.set("lastName", formData.lastName.trim());
      }
      if (formData.cedulaNo.trim()) {
        params.set("cedulaNo", formData.cedulaNo.trim());
      }
      if (formData.orderNumber.trim()) {
        params.set("orderNumber", formData.orderNumber.trim());
      }
      if (formData.totalCents.trim()) {
        const totalValue = parseFloat(formData.totalCents.trim());
        if (!isNaN(totalValue) && totalValue > 0) {
          params.set("totalCents", String(Math.round(totalValue * 100)));
        }
      }
      if (activeBranch) {
        params.set("branchId", String(activeBranch.id));
      }
      params.set("limit", "100");

      const response = await fetch(`${API_BASE_URL}/api/layaways/search?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error ?? "Error al buscar layaways");
      }

      const data = await response.json();
      setResults(data.layaways ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al buscar layaways");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return pesoFormatter.format(cents / 100);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      return dateFormatter.format(date);
    } catch {
      return dateString;
    }
  };

  const formatCustomerName = (customer: LayawaySearchResult["customer"]) => {
    const parts = [customer.firstName, customer.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "—";
  };

  const handleEditClick = useCallback(async (layaway: LayawaySearchResult) => {
    if (layaway.status !== "active") {
      setError("Solo se pueden editar layaways activos");
      setTimeout(() => setError(null), 5000);
      return;
    }

    try {
      // Fetch full layaway detail to get items
      const response = await fetch(`${API_BASE_URL}/api/layaways/${layaway.id}`);
      if (!response.ok) {
        throw new Error("No se pudo cargar el detalle del layaway");
      }
      const detail = await response.json();

      setEditingLayaway(layaway);
      setEditCustomerId(layaway.customerId);
      setEditCustomerName(formatCustomerName(layaway.customer));

      // Format due date for input (YYYY-MM-DD)
      if (layaway.dueDate) {
        const date = new Date(layaway.dueDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        setEditDueDate(`${year}-${month}-${day}`);
      } else {
        setEditDueDate("");
      }

      // Initialize items with current prices
      if (detail.items && Array.isArray(detail.items)) {
        setEditItems(
          detail.items.map((item: { id: number; unitPriceCents?: number; productName?: string | null }) => {
            const unitPrice = item.unitPriceCents ?? 0;
            return {
              id: item.id,
              priceCents: String(unitPrice / 100),
              productName: item.productName,
            };
          })
        );
      } else {
        setEditItems([]);
      }

      setSaveError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el detalle");
      setTimeout(() => setError(null), 5000);
    }
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditingLayaway(null);
    setEditDueDate("");
    setEditCustomerId(null);
    setEditCustomerName("");
    setEditItems([]);
    setSaveError(null);
    setShowCustomerSearch(false);
    setCustomerSearchQuery("");
    setCustomerSearchResults([]);
  }, []);

  // Customer search effect
  useEffect(() => {
    if (!showCustomerSearch || !editingLayaway) {
      return;
    }

    const query = customerSearchQuery.trim();
    if (query.length < 2) {
      setCustomerSearchResults([]);
      setIsSearchingCustomers(false);
      return;
    }

    const controller = new AbortController();
    setIsSearchingCustomers(true);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, limit: "10" });
        if (activeBranch) {
          params.set("branchId", String(activeBranch.id));
        }
        const response = await fetch(`${API_BASE_URL}/api/customers?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Error al buscar clientes");
        }

        const payload: {
          customers?: Array<{
            id: number;
            firstName: string | null;
            lastName: string | null;
            email: string | null;
            phone: string | null;
          }>;
        } = await response.json();

        if (controller.signal.aborted) return;

        const results = (payload.customers ?? []).map((customer) => {
          const first = customer.firstName?.trim() ?? "";
          const last = customer.lastName?.trim() ?? "";
          const name = `${first} ${last}`.trim() || "Cliente sin nombre";
          return {
            id: Number(customer.id),
            name,
            email: customer.email ?? null,
            phone: customer.phone ?? null,
          };
        });

        setCustomerSearchResults(results);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Customer search failed", error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingCustomers(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [showCustomerSearch, customerSearchQuery, editingLayaway, activeBranch]);

  const handleSelectCustomer = useCallback((customer: { id: number; name: string }) => {
    setEditCustomerId(customer.id);
    setEditCustomerName(customer.name);
    setShowCustomerSearch(false);
    setCustomerSearchQuery("");
    setCustomerSearchResults([]);
  }, []);

  const handleItemPriceChange = useCallback((itemId: number, price: string) => {
    setEditItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, priceCents: price } : item))
    );
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingLayaway) return;

    if (!editDueDate.trim()) {
      setSaveError("La fecha de vencimiento es requerida");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const payload: {
        dueDate: string;
        customerId?: number;
        items?: Array<{ id: number; priceCents: number }>;
      } = {
        dueDate: editDueDate.trim(),
      };

      // Include customer if changed
      if (editCustomerId !== null && editCustomerId !== editingLayaway.customerId) {
        payload.customerId = editCustomerId;
      }

      // Include items if prices changed
      if (editItems.length > 0) {
        payload.items = editItems.map((item) => ({
          id: item.id,
          priceCents: Math.round(parseFloat(item.priceCents) * 100),
        }));
      }

      const response = await fetch(`${API_BASE_URL}/api/layaways/${editingLayaway.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error ?? "Error al actualizar el layaway");
      }

      // Refresh search results by re-running the search
      const params = new URLSearchParams();
      if (formData.firstName.trim()) params.set("firstName", formData.firstName.trim());
      if (formData.lastName.trim()) params.set("lastName", formData.lastName.trim());
      if (formData.cedulaNo.trim()) params.set("cedulaNo", formData.cedulaNo.trim());
      if (formData.orderNumber.trim()) params.set("orderNumber", formData.orderNumber.trim());
      if (formData.totalCents.trim()) {
        const totalValue = parseFloat(formData.totalCents.trim());
        if (!isNaN(totalValue) && totalValue > 0) {
          params.set("totalCents", String(Math.round(totalValue * 100)));
        }
      }
      if (activeBranch) params.set("branchId", String(activeBranch.id));
      params.set("limit", "100");

      const refreshResponse = await fetch(`${API_BASE_URL}/api/layaways/search?${params.toString()}`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setResults(refreshData.layaways ?? []);
      }

      handleCloseEdit();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error desconocido al guardar");
    } finally {
      setIsSaving(false);
    }
  }, [editingLayaway, editDueDate, editCustomerId, editItems, handleCloseEdit, formData, activeBranch]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-10 flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <Link
            href="/layaways"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Buscar Layaways</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Busca layaways por nombre, apellido, cédula, número de orden o valor total.
        </p>
      </header>

      <form onSubmit={handleSearch} className="mb-8 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nombre
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => handleInputChange("firstName", e.target.value)}
              placeholder="Nombre del cliente"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Apellido
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
              placeholder="Apellido del cliente"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Cédula
            </label>
            <input
              type="text"
              value={formData.cedulaNo}
              onChange={(e) => handleInputChange("cedulaNo", e.target.value)}
              placeholder="Número de cédula"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Número de Orden
            </label>
            <input
              type="text"
              value={formData.orderNumber}
              onChange={(e) => handleInputChange("orderNumber", e.target.value)}
              placeholder="Ej: ORD-12345"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Valor Total (RD$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.totalCents}
              onChange={(e) => handleInputChange("totalCents", e.target.value)}
              placeholder="Ej: 5000.00"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Buscar
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setFormData({
                firstName: "",
                lastName: "",
                cedulaNo: "",
                orderNumber: "",
                totalCents: "",
              });
              setResults([]);
              setHasSearched(false);
              setError(null);
            }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Limpiar
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200">
          {error}
        </div>
      )}

      {hasSearched && !isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Resultados ({results.length})
            </h2>
          </div>

          {results.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              No se encontraron layaways que coincidan con los criterios de búsqueda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Orden
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Cédula
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Pagado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Saldo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Vencimiento
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {results.map((layaway) => {
                    const statusBadge = getStatusBadge(layaway.status);
                    
                    return (
                      <tr key={layaway.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {layaway.orderNumber || `ORD-${layaway.orderId}`}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {formatCustomerName(layaway.customer)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {layaway.customer.cedulaNo || "—"}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {formatCurrency(layaway.totalCents)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {formatCurrency(layaway.paidCents)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {formatCurrency(layaway.balanceCents)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {formatDate(layaway.dueDate)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/layaway/${layaway.id}`}
                              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                              title="Ver"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={() => handleEditClick(layaway)}
                              disabled={layaway.status !== "active"}
                              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                              title={layaway.status === "active" ? "Editar" : "Solo se pueden editar layaways activos"}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      {editingLayaway && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={handleCloseEdit}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Editar Layaway</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Actualice el cliente, precios de artículos y fecha de vencimiento.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseEdit}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
                <div className="font-medium text-slate-900 dark:text-white">
                  Orden: {editingLayaway.orderNumber || `ORD-${editingLayaway.orderId}`}
                </div>
              </div>

              {/* Customer Selection */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Cliente
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-400"
                  >
                    {editCustomerName || "Seleccionar cliente..."}
                  </button>
                  {showCustomerSearch && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                      <input
                        type="text"
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        placeholder="Buscar cliente..."
                        className="w-full rounded-t-lg border-b border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                        autoFocus
                      />
                      <div className="max-h-60 overflow-y-auto">
                        {isSearchingCustomers ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : customerSearchResults.length > 0 ? (
                          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                            {customerSearchResults.map((customer) => (
                              <li key={customer.id}>
                                <button
                                  type="button"
                                  onClick={() => handleSelectCustomer(customer)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                  <div className="font-medium">{customer.name}</div>
                                  {(customer.email || customer.phone) && (
                                    <div className="text-xs text-slate-500">
                                      {customer.email || customer.phone}
                                    </div>
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : customerSearchQuery.length >= 2 ? (
                          <div className="px-3 py-4 text-center text-sm text-slate-500">
                            No se encontraron clientes
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Items with prices */}
              {editItems.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Precios de Artículos
                  </label>
                  <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    {editItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                          {item.productName || `Artículo #${item.id}`}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">RD$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.priceCents}
                            onChange={(e) => handleItemPriceChange(item.id, e.target.value)}
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Due Date */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Fecha de Vencimiento <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-400"
                  required
                />
              </div>

              {saveError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200">
                  {saveError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseEdit}
                disabled={isSaving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving || !editDueDate.trim()}
                className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

