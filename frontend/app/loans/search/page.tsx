"use client";

import { FormEvent, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  Eye,
  Edit,
  DollarSign,
  CheckCircle2,
  XCircle,
  ArrowLeft,
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

type LoanSearchResult = {
  id: number;
  branchId: number;
  customerId: number;
  ticketNumber: string;
  principalCents: number;
  interestModelId: number;
  interestModelName: string | null;
  interestRate: number | null;
  dueDate: string | null;
  status: "active" | "renewed" | "redeemed" | "forfeited";
  comments: string | null;
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
  collateralDescriptions: string[];
};

type SearchFormData = {
  firstName: string;
  lastName: string;
  cedulaNo: string;
  principalCents: string;
  description: string;
};

function getStatusBadge(status: LoanSearchResult["status"]) {
  switch (status) {
    case "redeemed":
      return { label: "Redimido", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" };
    case "forfeited":
      return { label: "Abandonado", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" };
    case "renewed":
      return { label: "Renovado", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" };
    default:
      return { label: "Activo", className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" };
  }
}

export default function LoansSearchPage() {
  const { branch: activeBranch } = useActiveBranch();
  const [formData, setFormData] = useState<SearchFormData>({
    firstName: "",
    lastName: "",
    cedulaNo: "",
    principalCents: "",
    description: "",
  });
  const [results, setResults] = useState<LoanSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanSearchResult | null>(null);
  const [editComments, setEditComments] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editCustomerId, setEditCustomerId] = useState<number | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editPrincipalCents, setEditPrincipalCents] = useState("");
  const [editCollateral, setEditCollateral] = useState<Array<{ id?: number; description: string; estimatedValueCents: string }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
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
      if (formData.principalCents.trim()) {
        const principalValue = parseFloat(formData.principalCents.trim());
        if (!isNaN(principalValue) && principalValue > 0) {
          params.set("principalCents", String(Math.round(principalValue * 100)));
        }
      }
      if (formData.description.trim()) {
        params.set("description", formData.description.trim());
      }
      if (activeBranch) {
        params.set("branchId", String(activeBranch.id));
      }
      params.set("limit", "100");

      const response = await fetch(`${API_BASE_URL}/api/loans/search?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error ?? "Error al buscar préstamos");
      }

      const data = await response.json();
      setResults(data.loans ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido al buscar préstamos");
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

  const formatCustomerName = (customer: LoanSearchResult["customer"]) => {
    const parts = [customer.firstName, customer.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "—";
  };

  const handleCloseEditDialog = () => {
    setEditingLoan(null);
    setEditComments("");
    setEditDueDate("");
    setEditCustomerId(null);
    setEditCustomerName("");
    setEditPrincipalCents("");
    setEditCollateral([]);
    setEditError(null);
    setShowCustomerSearch(false);
    setCustomerSearchQuery("");
    setCustomerSearchResults([]);
  };

  const handleEditClick = useCallback(async (loan: LoanSearchResult) => {
    if (loan.status === "redeemed" || loan.status === "forfeited") {
      setError("No se pueden editar préstamos cerrados");
      setTimeout(() => setError(null), 5000);
      return;
    }

    try {
      // Fetch full loan detail to get collateral
      const response = await fetch(`${API_BASE_URL}/api/loans/${loan.id}`);
      if (!response.ok) {
        throw new Error("No se pudo cargar el detalle del préstamo");
      }
      const detail = await response.json();

      setEditingLoan(loan);
      setEditComments(loan.comments || "");
      setEditCustomerId(loan.customerId);
      setEditCustomerName(formatCustomerName(loan.customer));
      setEditPrincipalCents(String(loan.principalCents / 100));
      
      // Format due date for input (YYYY-MM-DD)
      if (loan.dueDate) {
        const date = new Date(loan.dueDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        setEditDueDate(`${year}-${month}-${day}`);
      } else {
        setEditDueDate("");
      }

      // Initialize collateral
      if (detail.collateral && Array.isArray(detail.collateral)) {
        setEditCollateral(
          detail.collateral.map((item: { id: number; description: string; estimatedValueCents: number | null }) => ({
            id: item.id,
            description: item.description || "",
            estimatedValueCents: item.estimatedValueCents ? String(item.estimatedValueCents / 100) : "",
          }))
        );
      } else {
        setEditCollateral([]);
      }

      setEditError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el detalle");
      setTimeout(() => setError(null), 5000);
    }
  }, []);

  // Customer search effect
  useEffect(() => {
    if (!showCustomerSearch || !editingLoan) {
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
  }, [showCustomerSearch, customerSearchQuery, editingLoan, activeBranch]);

  const handleSelectCustomer = useCallback((customer: { id: number; name: string }) => {
    setEditCustomerId(customer.id);
    setEditCustomerName(customer.name);
    setShowCustomerSearch(false);
    setCustomerSearchQuery("");
    setCustomerSearchResults([]);
  }, []);

  const handleCollateralChange = useCallback((index: number, field: "description" | "estimatedValueCents", value: string) => {
    setEditCollateral((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  }, []);

  const handleAddCollateral = useCallback(() => {
    setEditCollateral((prev) => [...prev, { description: "", estimatedValueCents: "" }]);
  }, []);

  const handleRemoveCollateral = useCallback((index: number) => {
    setEditCollateral((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingLoan) return;

    if (!editDueDate.trim()) {
      setEditError("La fecha de vencimiento es requerida");
      return;
    }

    if (!editPrincipalCents.trim() || parseFloat(editPrincipalCents) <= 0) {
      setEditError("El valor del préstamo debe ser mayor a 0");
      return;
    }

    if (editCollateral.length === 0 || editCollateral.some((item) => !item.description.trim())) {
      setEditError("Debe haber al menos un artículo de colateral con descripción");
      return;
    }

    setIsSaving(true);
    setEditError(null);

    try {
      const payload: {
        comments?: string | null;
        dueDate?: string;
        customerId?: number;
        principalCents?: number;
        collateral?: Array<{ description: string; estimatedValueCents: number | null; photoPath?: string | null }>;
      } = {};

      if (editComments !== editingLoan.comments) {
        payload.comments = editComments.trim() || null;
      }

      if (editDueDate !== editingLoan.dueDate) {
        payload.dueDate = editDueDate.trim();
      }

      if (editCustomerId !== null && editCustomerId !== editingLoan.customerId) {
        payload.customerId = editCustomerId;
      }

      const principalValue = parseFloat(editPrincipalCents);
      if (!isNaN(principalValue) && principalValue > 0) {
        const principalCentsValue = Math.round(principalValue * 100);
        if (principalCentsValue !== editingLoan.principalCents) {
          payload.principalCents = principalCentsValue;
        }
      }

      // Always send collateral (it replaces all existing)
      payload.collateral = editCollateral.map((item) => ({
        description: item.description.trim(),
        estimatedValueCents: item.estimatedValueCents.trim()
          ? Math.round(parseFloat(item.estimatedValueCents) * 100)
          : null,
        photoPath: null,
      }));

      const response = await fetch(`${API_BASE_URL}/api/loans/${editingLoan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error ?? "Error al guardar los cambios");
      }

      // Refresh search results by re-running the search
      const params = new URLSearchParams();
      if (formData.firstName.trim()) params.set("firstName", formData.firstName.trim());
      if (formData.lastName.trim()) params.set("lastName", formData.lastName.trim());
      if (formData.cedulaNo.trim()) params.set("cedulaNo", formData.cedulaNo.trim());
      if (formData.principalCents.trim()) {
        const principalValue = parseFloat(formData.principalCents.trim());
        if (!isNaN(principalValue) && principalValue > 0) {
          params.set("principalCents", String(Math.round(principalValue * 100)));
        }
      }
      if (formData.description.trim()) params.set("description", formData.description.trim());
      if (activeBranch) params.set("branchId", String(activeBranch.id));
      params.set("limit", "100");

      const refreshResponse = await fetch(`${API_BASE_URL}/api/loans/search?${params.toString()}`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setResults(refreshData.loans ?? []);
      }

      handleCloseEditDialog();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Error desconocido al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Escape key to close edit dialog
  useEffect(() => {
    if (!editingLoan) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        handleCloseEditDialog();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [editingLoan, isSaving]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <header className="mb-10 flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <Link
            href="/loans"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
        </div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Buscar Préstamos</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Busca préstamos por nombre, apellido, cédula, valor del préstamo o descripción del colateral.
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
              Valor del Préstamo (RD$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.principalCents}
              onChange={(e) => handleInputChange("principalCents", e.target.value)}
              placeholder="Ej: 5000.00"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Descripción del Colateral
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Descripción del artículo"
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
                principalCents: "",
                description: "",
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
              No se encontraron préstamos que coincidan con los criterios de búsqueda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Ticket
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Cédula
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      Colateral
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
                  {results.map((loan) => {
                    const statusBadge = getStatusBadge(loan.status);
                    const isClosed = loan.status === "redeemed" || loan.status === "forfeited";
                    
                    return (
                      <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {loan.ticketNumber}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {formatCustomerName(loan.customer)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {loan.customer.cedulaNo || "—"}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {formatCurrency(loan.principalCents)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {loan.collateralDescriptions.length > 0
                            ? loan.collateralDescriptions.slice(0, 2).join(", ") +
                              (loan.collateralDescriptions.length > 2 ? "..." : "")
                            : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {formatDate(loan.dueDate)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/loans/${loan.id}`}
                              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                              title="Ver"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            {!isClosed && (
                              <>
                                <Link
                                  href={`/loans/${loan.id}?action=pay`}
                                  className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300"
                                  title="Pagar"
                                >
                                  <DollarSign className="h-4 w-4" />
                                </Link>
                                <Link
                                  href={`/loans/${loan.id}?action=redeem`}
                                  className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-300"
                                  title="Redimir"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Link>
                                <Link
                                  href={`/loans/${loan.id}/forfeit`}
                                  className="rounded-lg p-2 text-amber-600 transition hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/30 dark:hover:text-amber-300"
                                  title="Abandonar"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Link>
                              </>
                            )}
                            <button
                              onClick={() => handleEditClick(loan)}
                              disabled={isClosed}
                              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                              title={isClosed ? "No se pueden editar préstamos cerrados" : "Editar"}
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
      {editingLoan && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={handleCloseEditDialog}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Editar Préstamo {editingLoan.ticketNumber}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Actualice el cliente, valor, colateral y fecha de vencimiento.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseEditDialog}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form id="edit-loan-form" onSubmit={handleSaveEdit} className="space-y-4">
              {editError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200">
                  {editError}
                </div>
              )}

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

              {/* Principal Amount */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Valor del Préstamo (RD$) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editPrincipalCents}
                  onChange={(e) => setEditPrincipalCents(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-400"
                  required
                />
              </div>

              {/* Collateral Items */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Colateral <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddCollateral}
                    className="text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400"
                  >
                    + Agregar
                  </button>
                </div>
                <div className="space-y-2">
                  {editCollateral.map((item, index) => (
                    <div key={index} className="flex gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleCollateralChange(index, "description", e.target.value)}
                          placeholder="Descripción (puede incluir cantidad, kilate, peso, etc.)"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                          required
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Valor estimado:</span>
                          <span className="text-xs text-slate-500">RD$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.estimatedValueCents}
                            onChange={(e) => handleCollateralChange(index, "estimatedValueCents", e.target.value)}
                            placeholder="0.00"
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCollateral(index)}
                        className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30"
                        title="Eliminar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {editCollateral.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-600">
                      No hay artículos de colateral. Haga clic en "Agregar" para agregar uno.
                    </div>
                  )}
                </div>
              </div>

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

              {/* Comments */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Comentarios
                </label>
                <textarea
                  value={editComments}
                  onChange={(e) => setEditComments(e.target.value)}
                  rows={3}
                  placeholder="Comentarios sobre el préstamo..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </form>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
              <button
                type="button"
                onClick={handleCloseEditDialog}
                disabled={isSaving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="edit-loan-form"
                disabled={isSaving || !editDueDate.trim() || !editPrincipalCents.trim() || editCollateral.length === 0 || editCollateral.some((item) => !item.description.trim())}
                className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

