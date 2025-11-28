"use client";

import { FormEvent, useState, useEffect, useCallback, useRef, KeyboardEvent } from "react";
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
  CreditCard,
  Calendar,
  Package,
  RefreshCw,
  Printer,
} from "lucide-react";
import { useRouter } from "next/navigation";
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

type LoanDetail = {
  loan: {
    id: number;
    ticketNumber: string;
    principalCents: number;
    status: string;
    dueDate: string | null;
    customer: {
      id: number;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      email: string | null;
    };
  };
  collateral: Array<{
    id: number;
    description: string;
    estimatedValueCents: number | null;
  }>;
  schedule: Array<{
    dueOn: string;
    interestCents: number;
    feeCents: number;
  }>;
  payments: Array<{
    kind: string;
    amountCents: number;
    createdAt: string;
  }>;
  balance: {
    principalCents: number;
    interestCents: number;
    feeCents: number;
    totalCents: number;
  };
};

export default function LoansSearchPage() {
  const router = useRouter();
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
  
  // Action dialog states
  const [actionDialog, setActionDialog] = useState<"abono" | "quincenas" | "retirar" | "visualizar" | "renovar" | "reimprimir" | "editar" | "consultar" | null>(null);
  const [ticketNumberInput, setTicketNumberInput] = useState("");
  const [loanDetail, setLoanDetail] = useState<LoanDetail | null>(null);
  const [loadingLoan, setLoadingLoan] = useState(false);
  const [loanError, setLoanError] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const paymentInputRef = useRef<HTMLInputElement>(null);
  const okButtonRef = useRef<HTMLButtonElement>(null);
  const ticketInputRef = useRef<HTMLInputElement>(null);
  
  // Refs for action buttons
  const abonoButtonRef = useRef<HTMLButtonElement>(null);
  const quincenasButtonRef = useRef<HTMLButtonElement>(null);
  const retirarButtonRef = useRef<HTMLButtonElement>(null);
  const visualizarButtonRef = useRef<HTMLButtonElement>(null);
  const renovarButtonRef = useRef<HTMLButtonElement>(null);
  const reimprimirButtonRef = useRef<HTMLButtonElement>(null);
  const editarButtonRef = useRef<HTMLButtonElement>(null);
  const consultarButtonRef = useRef<HTMLButtonElement>(null);
  const [focusedButtonIndex, setFocusedButtonIndex] = useState(0);
  
  // Payment navigation state
  const [currentPaymentPage, setCurrentPaymentPage] = useState(0);
  const paymentsPerPage = 10;
  
  // Refs for search form fields
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const lastNameInputRef = useRef<HTMLInputElement>(null);
  const cedulaNoInputRef = useRef<HTMLInputElement>(null);
  const principalCentsInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const clearButtonRef = useRef<HTMLButtonElement>(null);

  const handleInputChange = (field: keyof SearchFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Load loan by ticket number
  const loadLoanByTicket = useCallback(async (ticketNumber: string, forEdit = false) => {
    if (!ticketNumber.trim()) {
      setLoanError("Ingrese un número de ticket");
      return;
    }

    setLoadingLoan(true);
    setLoanError(null);
    setLoanDetail(null);

    try {
      // First, search for the loan by ticket number
      const searchParams = new URLSearchParams();
      searchParams.set("ticketNumber", ticketNumber.trim());
      if (activeBranch) {
        searchParams.set("branchId", String(activeBranch.id));
      }
      searchParams.set("limit", "1");

      const searchResponse = await fetch(`${API_BASE_URL}/api/loans/search?${searchParams.toString()}`);
      
      if (!searchResponse.ok) {
        throw new Error("Error al buscar el préstamo");
      }

      const searchData = await searchResponse.json();
      const loans = searchData.loans ?? [];
      
      if (loans.length === 0) {
        setLoanError("No se encontró un préstamo con ese número de ticket");
        return;
      }

      const loan = loans[0];
      
      // If editing, open edit dialog directly
      if (forEdit) {
        // Close action dialog first
        closeActionDialog();
        // Then open edit dialog after a short delay
        setTimeout(() => {
          void handleEditClick(loan);
        }, 100);
        return;
      }
      
      // Get full loan detail
      const detailResponse = await fetch(`${API_BASE_URL}/api/loans/${loan.id}`);
      
      if (!detailResponse.ok) {
        throw new Error("Error al cargar el detalle del préstamo");
      }

      const detailData = await detailResponse.json();
      setLoanDetail(detailData);
    } catch (err) {
      setLoanError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoadingLoan(false);
    }
  }, [activeBranch]);

  // Handle ticket number input Enter key
  const handleTicketNumberKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && ticketNumberInput.trim()) {
      event.preventDefault();
      const forEdit = actionDialog === "editar";
      void loadLoanByTicket(ticketNumberInput, forEdit);
    }
  };

  // Handle payment submission
  const handlePaymentSubmit = async (kind: "interest" | "advance" | "redeem") => {
    if (!loanDetail || !paymentAmount.trim()) {
      setLoanError("Ingrese el monto a pagar");
      return;
    }

    const amountCents = Math.round(parseFloat(paymentAmount) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setLoanError("El monto debe ser mayor a 0");
      return;
    }

    setIsProcessing(true);
    setLoanError(null);

    try {
      let endpoint = "";
      let payload: Record<string, unknown> = {};

      if (kind === "redeem") {
        endpoint = `/api/loans/${loanDetail.loan.id}/redeem`;
        payload = { amountCents, method: "cash" };
      } else {
        endpoint = `/api/loans/${loanDetail.loan.id}/pay`;
        payload = { kind, amountCents, method: "cash" };
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error ?? "Error al procesar el pago");
      }

      // Reload loan detail
      await loadLoanByTicket(ticketNumberInput);
      setPaymentAmount("");
    } catch (err) {
      setLoanError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle reprint
  const handleReprint = () => {
    if (!loanDetail) return;
    window.print();
  };

  // Handle renew - navigate to loans/new with pre-filled data
  const handleRenew = () => {
    if (!loanDetail) return;
    
    // Build URL with loan data as query params
    const params = new URLSearchParams();
    params.set("renewLoanId", String(loanDetail.loan.id));
    router.push(`/loans/new?${params.toString()}`);
  };

  // Close action dialog
  const closeActionDialog = () => {
    setActionDialog(null);
    setTicketNumberInput("");
    setLoanDetail(null);
    setLoanError(null);
    setPaymentAmount("");
    setCurrentPaymentPage(0);
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

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        handleCloseEditDialog();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [editingLoan, isSaving]);

  // Focus appropriate field when action dialog opens
  useEffect(() => {
    if (!actionDialog) return;

    // Small delay to ensure dialog is rendered
    const timer = setTimeout(() => {
      if (!loanDetail) {
        // Focus ticket input if loan not loaded
        ticketInputRef.current?.focus();
      } else {
        // Focus payment input for payment actions, OK button for visualizar
        if (actionDialog === "abono" || actionDialog === "quincenas" || actionDialog === "retirar") {
          paymentInputRef.current?.focus();
        } else if (actionDialog === "visualizar") {
          okButtonRef.current?.focus();
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [actionDialog, loanDetail]);

  // Handle Escape key to close action dialog
  useEffect(() => {
    if (!actionDialog) return;

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !isProcessing && !loadingLoan) {
        closeActionDialog();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [actionDialog, isProcessing, loadingLoan]);

  // Focus abono button on page load
  useEffect(() => {
    const timer = setTimeout(() => {
      abonoButtonRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle arrow key navigation between action buttons and form fields
  useEffect(() => {
    if (actionDialog) return; // Don't handle arrow keys when dialog is open

    const handleArrowKeys = (event: globalThis.KeyboardEvent) => {
      const activeElement = document.activeElement;
      
      // Define all focusable elements in order (for left/right navigation)
      const focusableElements = [
        // Action buttons
        abonoButtonRef,
        quincenasButtonRef,
        retirarButtonRef,
        visualizarButtonRef,
        renovarButtonRef,
        reimprimirButtonRef,
        // Form fields
        firstNameInputRef,
        lastNameInputRef,
        cedulaNoInputRef,
        principalCentsInputRef,
        descriptionInputRef,
        // Form buttons
        searchButtonRef,
        clearButtonRef,
      ];

      // Define grid layout for up/down navigation
      // Row 0: Action buttons (6 columns)
      // Row 1: Form row 1 (3 columns: Nombre, Apellido, Cédula)
      // Row 2: Form row 2 (3 columns: Valor, Descripción spans 2 cols)
      // Row 3: Form buttons (2 columns: Buscar, Limpiar)
      const gridLayout: Array<Array<React.RefObject<HTMLElement> | null>> = [
        [abonoButtonRef, quincenasButtonRef, retirarButtonRef, visualizarButtonRef, renovarButtonRef, reimprimirButtonRef, editarButtonRef, consultarButtonRef],
        [firstNameInputRef, lastNameInputRef, cedulaNoInputRef],
        [principalCentsInputRef, descriptionInputRef, null],
        [searchButtonRef, clearButtonRef, null],
      ];

      // Find current focused element position
      let currentRow = -1;
      let currentCol = -1;
      
      for (let row = 0; row < gridLayout.length; row++) {
        for (let col = 0; col < gridLayout[row].length; col++) {
          const ref = gridLayout[row][col];
          if (ref && ref.current === activeElement) {
            currentRow = row;
            currentCol = col;
            break;
          }
        }
        if (currentRow !== -1) break;
      }

      // If not found in grid, try linear search for left/right navigation
      if (currentRow === -1) {
        let currentIndex = -1;
        for (let i = 0; i < focusableElements.length; i++) {
          if (focusableElements[i].current === activeElement) {
            currentIndex = i;
            break;
          }
        }

        // If not in our focusable list, don't handle
        if (currentIndex === -1) {
          if (
            activeElement instanceof HTMLInputElement ||
            activeElement instanceof HTMLTextAreaElement ||
            activeElement instanceof HTMLSelectElement
          ) {
            return; // Let browser handle it
          }
        }

        // Handle left/right for elements not in grid (fallback)
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          
          let newIndex = currentIndex;
          if (event.key === "ArrowLeft") {
            newIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
          } else {
            newIndex = (currentIndex + 1) % focusableElements.length;
          }

          if (newIndex < 8) {
            setFocusedButtonIndex(newIndex);
          } else if (currentIndex < 8) {
            setFocusedButtonIndex(-1);
          }

          focusableElements[newIndex].current?.focus();
        } else if (event.key === "Enter" && currentIndex >= 0 && currentIndex < 8) {
          event.preventDefault();
          focusableElements[currentIndex].current?.click();
        }
        return;
      }

      // Handle navigation
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        
        const currentRowElements = gridLayout[currentRow];
        let newCol = currentCol;
        
        if (event.key === "ArrowLeft") {
          // Move left, skip nulls
          newCol = currentCol - 1;
          while (newCol >= 0 && !currentRowElements[newCol]) {
            newCol--;
          }
          if (newCol < 0) {
            // Wrap to end of row
            newCol = currentRowElements.length - 1;
            while (newCol >= 0 && !currentRowElements[newCol]) {
              newCol--;
            }
          }
        } else {
          // Move right, skip nulls
          newCol = currentCol + 1;
          while (newCol < currentRowElements.length && !currentRowElements[newCol]) {
            newCol++;
          }
          if (newCol >= currentRowElements.length) {
            // Wrap to start of row
            newCol = 0;
            while (newCol < currentRowElements.length && !currentRowElements[newCol]) {
              newCol++;
            }
          }
        }

          const newRef = currentRowElements[newCol];
          if (newRef) {
            if (currentRow === 0 && newCol < 8) {
              setFocusedButtonIndex(newCol);
            } else if (currentRow === 0) {
              setFocusedButtonIndex(-1);
            }
            newRef.current?.focus();
          }
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        
        let newRow = currentRow;
        if (event.key === "ArrowUp") {
          newRow = currentRow - 1;
          if (newRow < 0) {
            newRow = gridLayout.length - 1; // Wrap to bottom
          }
        } else {
          newRow = currentRow + 1;
          if (newRow >= gridLayout.length) {
            newRow = 0; // Wrap to top
          }
        }

        const targetRow = gridLayout[newRow];
        // Find the closest column in the target row
        let targetCol = currentCol;
        
        // If target row has fewer columns, use the last available column
        if (targetCol >= targetRow.length || !targetRow[targetCol]) {
          targetCol = targetRow.length - 1;
          while (targetCol >= 0 && !targetRow[targetCol]) {
            targetCol--;
          }
        }
        
        // If still no valid column, find first available
        if (targetCol < 0 || !targetRow[targetCol]) {
          targetCol = 0;
          while (targetCol < targetRow.length && !targetRow[targetCol]) {
            targetCol++;
          }
        }

        const newRef = targetRow[targetCol];
        if (newRef) {
          if (newRow === 0 && targetCol < 8) {
            setFocusedButtonIndex(targetCol);
          } else if (newRow === 0) {
            setFocusedButtonIndex(-1);
          } else if (currentRow === 0) {
            setFocusedButtonIndex(-1);
          }
          newRef.current?.focus();
        }
      } else if (event.key === "Enter" && currentRow === 0) {
        // Enter key on action buttons
        event.preventDefault();
        const buttonRef = gridLayout[currentRow][currentCol];
        if (buttonRef) {
          buttonRef.current?.click();
        }
      }
    };

    window.addEventListener("keydown", handleArrowKeys);
    return () => {
      window.removeEventListener("keydown", handleArrowKeys);
    };
  }, [focusedButtonIndex, actionDialog]);

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

      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          ref={abonoButtonRef}
          type="button"
          onClick={() => {
            setActionDialog("abono");
            setTicketNumberInput("");
            setLoanDetail(null);
            setLoanError(null);
            setPaymentAmount("");
          }}
          onFocus={() => setFocusedButtonIndex(0)}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-200 ${
            focusedButtonIndex === 0
              ? "border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-500 ring-offset-2 scale-105 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-400"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Abono
        </button>
        <button
          ref={quincenasButtonRef}
          type="button"
          onClick={() => {
            setActionDialog("quincenas");
            setTicketNumberInput("");
            setLoanDetail(null);
            setLoanError(null);
            setPaymentAmount("");
          }}
          onFocus={() => setFocusedButtonIndex(1)}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-200 ${
            focusedButtonIndex === 1
              ? "border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-500 ring-offset-2 scale-105 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-400"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <Calendar className="h-4 w-4" />
          Quincenas
        </button>
        <button
          ref={retirarButtonRef}
          type="button"
          onClick={() => {
            setActionDialog("retirar");
            setTicketNumberInput("");
            setLoanDetail(null);
            setLoanError(null);
            setPaymentAmount("");
          }}
          onFocus={() => setFocusedButtonIndex(2)}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-200 ${
            focusedButtonIndex === 2
              ? "border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-500 ring-offset-2 scale-105 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-400"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <Package className="h-4 w-4" />
          Retirar
        </button>
        <button
          ref={visualizarButtonRef}
          type="button"
          onClick={() => {
            setActionDialog("visualizar");
            setTicketNumberInput("");
            setLoanDetail(null);
            setLoanError(null);
          }}
          onFocus={() => setFocusedButtonIndex(3)}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-200 ${
            focusedButtonIndex === 3
              ? "border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-500 ring-offset-2 scale-105 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-400"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <Eye className="h-4 w-4" />
          Visualizar
        </button>
        <button
          ref={renovarButtonRef}
          type="button"
          onClick={() => {
            setActionDialog("renovar");
            setTicketNumberInput("");
            setLoanDetail(null);
            setLoanError(null);
          }}
          onFocus={() => setFocusedButtonIndex(4)}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-200 ${
            focusedButtonIndex === 4
              ? "border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-500 ring-offset-2 scale-105 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-400"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <RefreshCw className="h-4 w-4" />
          Renovar
        </button>
        <button
          ref={reimprimirButtonRef}
          type="button"
          onClick={() => {
            setActionDialog("reimprimir");
            setTicketNumberInput("");
            setLoanDetail(null);
            setLoanError(null);
          }}
          onFocus={() => setFocusedButtonIndex(5)}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-200 ${
            focusedButtonIndex === 5
              ? "border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-500 ring-offset-2 scale-105 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-400"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <Printer className="h-4 w-4" />
          Reimprimir
        </button>
        <button
          ref={editarButtonRef}
          type="button"
          onClick={() => {
            setActionDialog("editar");
            setTicketNumberInput("");
            setLoanDetail(null);
            setLoanError(null);
          }}
          onFocus={() => setFocusedButtonIndex(6)}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-200 ${
            focusedButtonIndex === 6
              ? "border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-500 ring-offset-2 scale-105 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-400"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <Edit className="h-4 w-4" />
          Editar
        </button>
        <button
          ref={consultarButtonRef}
          type="button"
          onClick={() => {
            setActionDialog("consultar");
            setTicketNumberInput("");
            setLoanDetail(null);
            setLoanError(null);
            setCurrentPaymentPage(0);
          }}
          onFocus={() => setFocusedButtonIndex(7)}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-200 ${
            focusedButtonIndex === 7
              ? "border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-500 ring-offset-2 scale-105 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-400"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          }`}
        >
          <Eye className="h-4 w-4" />
          Consultar
        </button>
      </div>

      <form onSubmit={handleSearch} className="mb-8 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nombre
            </label>
            <input
              ref={firstNameInputRef}
              type="text"
              value={formData.firstName}
              onChange={(e) => handleInputChange("firstName", e.target.value)}
              placeholder="Nombre del cliente"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all duration-200 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Apellido
            </label>
            <input
              ref={lastNameInputRef}
              type="text"
              value={formData.lastName}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
              placeholder="Apellido del cliente"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all duration-200 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Cédula
            </label>
            <input
              ref={cedulaNoInputRef}
              type="text"
              value={formData.cedulaNo}
              onChange={(e) => handleInputChange("cedulaNo", e.target.value)}
              placeholder="Número de cédula"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all duration-200 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Valor del Préstamo (RD$)
            </label>
            <input
              ref={principalCentsInputRef}
              type="number"
              step="0.01"
              min="0"
              value={formData.principalCents}
              onChange={(e) => handleInputChange("principalCents", e.target.value)}
              placeholder="Ej: 5000.00"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all duration-200 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Descripción del Colateral
            </label>
            <input
              ref={descriptionInputRef}
              type="text"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Descripción del artículo"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all duration-200 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            ref={searchButtonRef}
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
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
            ref={clearButtonRef}
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
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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

      {/* Action Dialog */}
      {actionDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={closeActionDialog}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {actionDialog === "abono" && "Abono"}
                  {actionDialog === "quincenas" && "Pago de Quincenas"}
                  {actionDialog === "retirar" && "Retirar Préstamo"}
                  {actionDialog === "visualizar" && "Visualizar Préstamo"}
                  {actionDialog === "renovar" && "Renovar Préstamo"}
                  {actionDialog === "reimprimir" && "Reimprimir Ticket"}
                  {actionDialog === "editar" && "Editar Préstamo"}
                  {actionDialog === "consultar" && "Consultar Pagos"}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {!loanDetail ? "Ingrese el número de ticket del préstamo" : "Información del préstamo"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeActionDialog}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!loanDetail ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Número de Ticket
                  </label>
                  <input
                    ref={ticketInputRef}
                    type="text"
                    value={ticketNumberInput}
                    onChange={(e) => setTicketNumberInput(e.target.value)}
                    onKeyDown={handleTicketNumberKeyDown}
                    placeholder="Ej: PAWN-000001"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    autoFocus
                  />
                </div>
                {loanError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200">
                    {loanError}
                  </div>
                )}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeActionDialog}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const forEdit = actionDialog === "editar";
                      void loadLoanByTicket(ticketNumberInput, forEdit);
                    }}
                    disabled={loadingLoan || !ticketNumberInput.trim()}
                    className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingLoan ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      "Buscar"
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Loan Information */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Ticket</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{loanDetail.loan.ticketNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cliente</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">
                        {loanDetail.loan.customer.firstName} {loanDetail.loan.customer.lastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Principal</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(loanDetail.loan.principalCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Balance Total</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(loanDetail.balance.totalCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Estado</p>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(loanDetail.loan.status as LoanSearchResult["status"]).className}`}>
                        {getStatusBadge(loanDetail.loan.status as LoanSearchResult["status"]).label}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Vencimiento</p>
                      <p className="text-sm text-slate-900 dark:text-slate-100">{formatDate(loanDetail.loan.dueDate)}</p>
                    </div>
                  </div>
                  {loanDetail.collateral.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Colateral</p>
                      <ul className="space-y-1">
                        {loanDetail.collateral.map((item) => (
                          <li key={item.id} className="text-sm text-slate-700 dark:text-slate-300">
                            • {item.description}
                            {item.estimatedValueCents && (
                              <span className="ml-2 text-slate-500">
                                ({formatCurrency(item.estimatedValueCents)})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {loanError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200">
                    {loanError}
                  </div>
                )}

                {/* Consultar - Payments List */}
                {actionDialog === "consultar" && loanDetail && (
                  <div className="space-y-4">
                    {loanDetail.payments && loanDetail.payments.length > 0 ? (
                      <>
                        <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                          <table className="w-full">
                            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                                  Fecha
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                                  Tipo
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                                  Cantidad (Quincenas)
                                </th>
                                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                                  Monto
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                              {[...loanDetail.payments]
                                .sort((a, b) => {
                                  const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                                  const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                                  return dateB - dateA; // Most recent first
                                })
                                .slice(currentPaymentPage * paymentsPerPage, (currentPaymentPage + 1) * paymentsPerPage)
                                .map((payment, index) => {
                                  const paymentDate = payment.createdAt ? new Date(payment.createdAt) : null;
                                  const paymentTypeLabels: Record<string, string> = {
                                    interest: "Abono",
                                    advance: "Quincenas",
                                    redeem: "Redención",
                                    renew: "Renovación",
                                  };
                                  const paymentType = paymentTypeLabels[payment.kind] || payment.kind;
                                  const isQuincenas = payment.kind === "advance";
                                  
                                  return (
                                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                        {paymentDate ? formatDate(paymentDate.toISOString()) : "—"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                        {paymentType}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                        {isQuincenas ? "1" : "—"}
                                      </td>
                                      <td className="px-4 py-3 text-right text-sm font-medium text-slate-900 dark:text-slate-100">
                                        {formatCurrency(payment.amountCents)}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                        {loanDetail.payments.length > paymentsPerPage && (
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              Mostrando {currentPaymentPage * paymentsPerPage + 1} - {Math.min((currentPaymentPage + 1) * paymentsPerPage, loanDetail.payments.length)} de {loanDetail.payments.length} pagos
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setCurrentPaymentPage(Math.max(0, currentPaymentPage - 1))}
                                disabled={currentPaymentPage === 0}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              >
                                Anterior
                              </button>
                              <span className="text-sm text-slate-600 dark:text-slate-400">
                                Página {currentPaymentPage + 1} de {Math.ceil(loanDetail.payments.length / paymentsPerPage)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setCurrentPaymentPage(Math.min(Math.ceil(loanDetail.payments.length / paymentsPerPage) - 1, currentPaymentPage + 1))}
                                disabled={currentPaymentPage >= Math.ceil(loanDetail.payments.length / paymentsPerPage) - 1}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              >
                                Siguiente
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                        No se han registrado pagos para este préstamo.
                      </div>
                    )}
                  </div>
                )}

                {/* Action-specific content */}
                {(actionDialog === "abono" || actionDialog === "quincenas" || actionDialog === "retirar") && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      {actionDialog === "retirar" ? "Monto a Pagar (Redimir)" : actionDialog === "quincenas" ? "Monto de Pago" : "Monto del Abono"}
                    </label>
                    <input
                      ref={paymentInputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && paymentAmount.trim()) {
                          e.preventDefault();
                          if (actionDialog === "retirar") {
                            void handlePaymentSubmit("redeem");
                          } else if (actionDialog === "quincenas") {
                            void handlePaymentSubmit("advance");
                          } else {
                            void handlePaymentSubmit("interest");
                          }
                        }
                      }}
                      placeholder="RD$"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      autoFocus
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={closeActionDialog}
                    disabled={isProcessing}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500"
                  >
                    Cancelar
                  </button>
                  {actionDialog === "visualizar" && (
                    <button
                      ref={okButtonRef}
                      type="button"
                      onClick={closeActionDialog}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          closeActionDialog();
                        }
                      }}
                      className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      autoFocus
                    >
                      OK
                    </button>
                  )}
                  {actionDialog === "reimprimir" && (
                    <button
                      type="button"
                      onClick={handleReprint}
                      className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <Printer className="h-4 w-4" />
                      Imprimir
                    </button>
                  )}
                  {actionDialog === "renovar" && (
                    <button
                      type="button"
                      onClick={handleRenew}
                      className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Renovar
                    </button>
                  )}
                  {actionDialog === "consultar" && loanDetail && (
                    <>
                      {loanDetail.payments && loanDetail.payments.length > paymentsPerPage && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCurrentPaymentPage(Math.max(0, currentPaymentPage - 1))}
                            disabled={currentPaymentPage === 0}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            Anterior
                          </button>
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            Página {currentPaymentPage + 1} de {Math.ceil(loanDetail.payments.length / paymentsPerPage)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentPaymentPage(Math.min(Math.ceil(loanDetail.payments.length / paymentsPerPage) - 1, currentPaymentPage + 1))}
                            disabled={currentPaymentPage >= Math.ceil(loanDetail.payments.length / paymentsPerPage) - 1}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            Siguiente
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={closeActionDialog}
                        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        Cerrar
                      </button>
                    </>
                  )}
                  {(actionDialog === "abono" || actionDialog === "quincenas" || actionDialog === "retirar") && (
                    <button
                      type="button"
                      onClick={() => {
                        if (actionDialog === "retirar") {
                          void handlePaymentSubmit("redeem");
                        } else if (actionDialog === "quincenas") {
                          void handlePaymentSubmit("advance");
                        } else {
                          void handlePaymentSubmit("interest");
                        }
                      }}
                      disabled={isProcessing || !paymentAmount.trim()}
                      className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        "Procesar"
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

  