"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  PackagePlus,
  Plus,
  Search,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { AddCustomerDialog } from "@/components/customer/add-customer-dialog";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type InterestModel = {
  id: number;
  name: string;
  description: string | null;
  rateType: "flat" | "simple" | "compound";
  periodDays: number;
  interestRateBps: number;
  graceDays: number;
  minPrincipalCents: number | null;
  maxPrincipalCents: number | null;
  lateFeeBps: number;
  defaultTermCount: number;
};

type LoanScheduleRow = {
  dueOn: string;
  interestCents: number;
  feeCents: number;
};

type CollateralItem = {
  qty: string;
  description: string;
  kilate: string;
  weight: string;
  estimatedValue: string;
  photoPath: string;
};


type ApiError = Error & { status?: number };

type CustomerSummary = {
  id: number;
  fullName: string;
  phone: string | null;
  email: string | null;
  branchId: number | null;
};


const pesoFormatter = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
});

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    const error = new Error(data?.error ?? "Request failed") as ApiError;
    error.status = response.status;
    throw error;
  }

  return data;
}

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    const error = new Error(data?.error ?? "Request failed") as ApiError;
    error.status = response.status;
    throw error;
  }

  return data;
}

const parseCurrencyToCents = (raw: string) => {
  const normalized = raw.replace(/\s+/g, "").replace(/,/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function addDays(base: string, days: number) {
  const dt = new Date(base);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function generateSchedule(
  principalCents: number,
  model: InterestModel,
  termCount: number,
  startDate: string
): LoanScheduleRow[] {
  if (!Number.isFinite(principalCents) || principalCents <= 0 || termCount <= 0) {
    return [];
  }

  const schedule: LoanScheduleRow[] = [];
  const rate = model.interestRateBps / 10000;

  for (let index = 1; index <= termCount; index += 1) {
    const dueOn = addDays(startDate, model.periodDays * index);
    const interestCents = Math.round(principalCents * rate);
    schedule.push({ dueOn, interestCents, feeCents: 0 });
  }

  return schedule;
}

export default function LoansNewPage() {
  const [interestModels, setInterestModels] = useState<InterestModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const { branch: activeBranch, loading: branchLoading, error: branchError } = useActiveBranch();
  const [branchId, setBranchId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
  const [isEditCustomerDialogOpen, setIsEditCustomerDialogOpen] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<{
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null>(null);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  const [customerDetailError, setCustomerDetailError] = useState<string | null>(null);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerSummary[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null);
  const [isCustomerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);


  const [collateralItems, setCollateralItems] = useState<CollateralItem[]>([
    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
  ]);

  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [principalAmount, setPrincipalAmount] = useState("");

  useEffect(() => {
    if (activeBranch && activeBranch.id) {
      const numericId = Number(activeBranch.id);
      if (Number.isInteger(numericId) && numericId > 0) {
        setBranchId(String(numericId));
      } else {
        setBranchId("");
        setTicketError("La sucursal activa no tiene un ID válido.");
      }
    } else {
      setBranchId("");
    }
  }, [activeBranch]);

  useEffect(() => {
    setSelectedCustomer(null);
    setCustomerQuery("");
    setCustomerResults([]);
    setCustomerSearchOpen(false);
    setCustomerSearchError(null);
    setCustomerSearchLoading(false);
    setTicketError(null); // Clear ticket error when branch changes
  }, [branchId]);

  const [manualSchedule, setManualSchedule] = useState<LoanScheduleRow[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<null | {
    loanId: number;
    ticketNumber: string;
    printableUrl?: string;
  }>(null);

  const fallbackTicketNumber = useCallback(
    () => `PAWN-${Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0")}`,
    []
  );

  const loadTicketNumber = useCallback(async () => {
    setTicketLoading(true);
    setTicketError(null);

    try {
      const numericBranch = Number(branchId);
      if (!Number.isInteger(numericBranch) || numericBranch <= 0) {
        // Invalid branch ID, use fallback
        setTicketNumber(fallbackTicketNumber());
        setTicketLoading(false);
        return;
      }

      const params = new URLSearchParams();
      params.set("branchId", String(numericBranch));

      const data = await getJson<{ ticketNumber: string }>(
        `/api/loans/next-ticket?${params.toString()}`
      );

      const generated = data.ticketNumber?.trim();
      setTicketNumber(generated && generated.length > 0 ? generated : fallbackTicketNumber());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo generar el ticket automáticamente.";
      setTicketError(message);
      setTicketNumber((previous) => previous || fallbackTicketNumber());
    } finally {
      setTicketLoading(false);
    }
  }, [branchId, fallbackTicketNumber]);

  useEffect(() => {
    const numericBranch = Number(branchId);
    if (!branchId || !Number.isInteger(numericBranch) || numericBranch <= 0) {
      setTicketNumber((previous) => previous || fallbackTicketNumber());
      setTicketError(null);
      return;
    }

    void loadTicketNumber();
  }, [branchId, fallbackTicketNumber, loadTicketNumber]);

  const closeCustomerSearchDialog = useCallback(() => {
    setCustomerSearchOpen(false);
    setCustomerSearchLoading(false);
    setCustomerSearchError(null);
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoadingModels(true);
    setModelsError(null);

    getJson<{ interestModels: InterestModel[] }>("/api/interest-models")
      .then((payload) => {
        if (!isMounted) return;
        setInterestModels(payload.interestModels ?? []);
      })
      .catch((error: ApiError) => {
        if (!isMounted) return;
        setModelsError(error.message ?? "No se pudieron cargar los modelos de interés");
      })
      .finally(() => {
        if (isMounted) {
          setLoadingModels(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isCustomerSearchOpen) {
      return;
    }

    const query = customerQuery.trim();

    if (query.length < 2) {
      setCustomerResults([]);
      setCustomerSearchError(null);
      setCustomerSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    setCustomerSearchLoading(true);
    setCustomerSearchError(null);

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, limit: "10" });
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
          }>;
        } = await response.json();

        if (controller.signal.aborted) {
          return;
        }

        const customers = (payload.customers ?? []).map((customer) => {
          const first = customer.firstName?.trim() ?? "";
          const last = customer.lastName?.trim() ?? "";
          const fullName = `${first} ${last}`.trim() || `Cliente #${customer.id}`;

          return {
            id: Number(customer.id),
            fullName,
            phone: customer.phone ?? null,
            email: customer.email ?? null,
            branchId: null,
          } as CustomerSummary;
        });

        setCustomerResults(customers);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Customer search failed", error);
        if (error instanceof Error) {
          setCustomerSearchError(error.message);
        } else {
          setCustomerSearchError("No se pudieron cargar los clientes");
        }
      } finally {
        if (!controller.signal.aborted) {
          setCustomerSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isCustomerSearchOpen, customerQuery]);

  useEffect(() => {
    const model = interestModels.find((item) => item.id === Number(selectedModelId));
    const principalCents = parseCurrencyToCents(principalAmount);

    if (!model || principalCents === null || principalCents <= 0) {
      setManualSchedule([]);
      return;
    }

    // Use defaultTermCount from the model instead of user input
    const termCount = model.defaultTermCount || 1;
    setManualSchedule(generateSchedule(principalCents, model, termCount, todayIso()));
  }, [interestModels, selectedModelId, principalAmount]);

  const currentModel = useMemo(
    () => interestModels.find((item) => item.id === Number(selectedModelId)) ?? null,
    [interestModels, selectedModelId]
  );

  const canSubmit = useMemo(() => {
    const branchNumeric = Number(branchId);
    const principalCents = parseCurrencyToCents(principalAmount);
    
    return (
      Number.isInteger(branchNumeric) &&
      branchNumeric > 0 &&
      selectedCustomer != null &&
      ticketNumber.trim().length > 0 &&
      collateralItems.some((item) => item.description.trim().length > 0) &&
      currentModel != null &&
      principalCents != null &&
      principalCents > 0 &&
      manualSchedule.length > 0
    );
  }, [branchId, selectedCustomer, ticketNumber, collateralItems, currentModel, principalAmount, manualSchedule.length]);


  const handleSelectCustomer = (customer: CustomerSummary) => {
    setSelectedCustomer(customer);
    setCustomerQuery(customer.fullName);
    setCustomerResults([]);
    closeCustomerSearchDialog();
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery("");
    setCustomerResults([]);
  };

  const loadCustomerDetail = async (customerId: number) => {
    setCustomerDetailLoading(true);
    setCustomerDetailError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}`);
      if (!response.ok) {
        throw new Error(`Failed to load customer (${response.status})`);
      }
      const payload = await response.json();
      setCustomerDetail({
        firstName: payload.customer.firstName || "",
        lastName: payload.customer.lastName || "",
        email: payload.customer.email || null,
        phone: payload.customer.phone || null,
        address: payload.customer.address || null,
      });
      setIsEditCustomerDialogOpen(true);
    } catch (error) {
      setCustomerDetailError(error instanceof Error ? error.message : "Unable to load customer");
    } finally {
      setCustomerDetailLoading(false);
    }
  };

  const handleEditCustomer = () => {
    if (selectedCustomer) {
      void loadCustomerDetail(selectedCustomer.id);
    }
  };

  const handleSaveCustomer = async () => {
    if (!selectedCustomer || !customerDetail) return;

    setCustomerSaving(true);
    setCustomerDetailError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${selectedCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: customerDetail.firstName.trim(),
          lastName: customerDetail.lastName.trim(),
          email: customerDetail.email?.trim() || null,
          phone: customerDetail.phone?.trim() || null,
          address: customerDetail.address?.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update customer");
      }

      const payload = await response.json();
      // Update selected customer with new data
      setSelectedCustomer({
        id: selectedCustomer.id,
        fullName: `${payload.customer.firstName} ${payload.customer.lastName}`.trim(),
        phone: payload.customer.phone,
        email: payload.customer.email,
        branchId: selectedCustomer.branchId,
      });
      setIsEditCustomerDialogOpen(false);
    } catch (error) {
      setCustomerDetailError(error instanceof Error ? error.message : "Unable to update customer");
    } finally {
      setCustomerSaving(false);
    }
  };

  const updateCollateralItem = (index: number, patch: Partial<CollateralItem>) => {
    setCollateralItems((previous) => previous.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const addCollateralRow = () => {
    setCollateralItems((previous) => {
      if (previous.length >= 4) return previous;
      return [...previous, { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" }];
    });
  };

  const removeCollateralRow = (index: number) => {
    setCollateralItems((previous) => {
      const filtered = previous.filter((_, idx) => idx !== index);
      // If we have less than 4 items after removal, add an empty one at the end
      if (filtered.length < 4) {
        return [...filtered, { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" }];
      }
      return filtered;
    });
  };

  const handleScheduleChange = (index: number, patch: Partial<LoanScheduleRow>) => {
    setManualSchedule((previous) =>
      previous.map((row, idx) => (idx === index ? { ...row, ...patch } : row))
    );
  };

  const submitLoan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const model = currentModel;
    const principalCents = parseCurrencyToCents(principalAmount);

    if (!model || !principalCents || principalCents <= 0 || manualSchedule.length === 0) {
      setSubmissionError("Completa los términos del préstamo antes de enviar.");
      return;
    }

    if (!selectedCustomer) {
      setSubmissionError("Selecciona un cliente antes de enviar.");
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);

    try {
      const numericBranchId = Number(branchId);
      const numericCustomerId = selectedCustomer?.id ? Number(selectedCustomer.id) : null;
      const numericInterestModelId = model.id ? Number(model.id) : null;

      if (!Number.isInteger(numericBranchId) || numericBranchId <= 0) {
        setSubmissionError("La sucursal no es válida. Debe ser un número entero positivo.");
        setSubmitting(false);
        return;
      }

      if (!numericCustomerId || !Number.isInteger(numericCustomerId) || numericCustomerId <= 0) {
        setSubmissionError("El cliente seleccionado no es válido. Debe ser un número entero positivo.");
        setSubmitting(false);
        return;
      }

      if (!numericInterestModelId || !Number.isInteger(numericInterestModelId) || numericInterestModelId <= 0) {
        setSubmissionError("El modelo de interés seleccionado no es válido. Debe ser un número entero positivo.");
        setSubmitting(false);
        return;
      }

      if (!principalCents || !Number.isFinite(principalCents) || principalCents <= 0) {
        setSubmissionError("El monto del préstamo debe ser mayor a cero.");
        setSubmitting(false);
        return;
      }

      // Get active shift for the branch to associate loan payout
      let activeShiftId: number | null = null;
      if (activeBranch) {
        try {
          const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
          const shiftResponse = await fetch(`${API_BASE_URL}/api/shifts/active?branchId=${activeBranch.id}`);
          if (shiftResponse.ok) {
            const shiftData = await shiftResponse.json();
            activeShiftId = shiftData.shift?.id ?? null;
          }
        } catch {
          // If shift lookup fails, continue without shiftId
        }
      }

      const payloadData: {
        branchId: number;
        customerId: number;
        ticketNumber: string;
        interestModelId: number;
        principalCents: number;
        schedule: Array<{ dueOn: string; interestCents: number; feeCents: number }>;
        collateral: Array<{
          description: string;
          estimatedValueCents: number;
          photoPath: string | null;
        }>;
        idImagePaths: never[];
        shiftId?: number;
      } = {
        branchId: numericBranchId,
        customerId: numericCustomerId,
        ticketNumber: ticketNumber.trim(),
        interestModelId: numericInterestModelId,
        principalCents: Math.round(principalCents),
        schedule: manualSchedule.map((row) => ({
          dueOn: row.dueOn,
          interestCents: row.interestCents,
          feeCents: row.feeCents,
        })),
        collateral: collateralItems
          .filter((item) => item.description.trim().length > 0)
          .map((item) => ({
            description: item.description.trim(),
            estimatedValueCents: parseCurrencyToCents(item.estimatedValue) ?? 0,
            photoPath: item.photoPath.trim() || null,
          })),
        idImagePaths: [],
      };

      // Add shiftId if available
      if (activeShiftId !== null) {
        payloadData.shiftId = activeShiftId;
      }

      const payload = await postJson<{
        loan: { id: number; ticketNumber: string };
      }>("/api/loans", payloadData);

      setSubmittedTicket({ loanId: payload.loan.id, ticketNumber: payload.loan.ticketNumber });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el préstamo";
      setSubmissionError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-500">Préstamos</span>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Nuevo préstamo / empeño</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Completa todos los campos para registrar un préstamo con captura de identificación, detalle de
          colateral y generación del ticket imprimible.
        </p>
      </header>

      <form className="space-y-8" onSubmit={submitLoan}>
        {/* Customer Section */}
        <section className="rounded-xl border border-slate-200 bg-white/80 p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
          <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
            <User className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Datos del cliente</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Buscar cliente</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <input
                  value={customerQuery}
                  onChange={(event) => {
                    const newValue = event.target.value;
                    setCustomerQuery(newValue);
                    if (selectedCustomer && newValue.trim() !== selectedCustomer.fullName) {
                      setSelectedCustomer(null);
                    }
                    // Auto-open dialog when user types 2+ characters
                    if (newValue.trim().length >= 2 && !isCustomerSearchOpen) {
                      setCustomerSearchOpen(true);
                      setCustomerSearchError(null);
                    }
                  }}
                  onFocus={() => {
                    // Open dialog when field is focused and has content
                    if (customerQuery.trim().length >= 2 && !isCustomerSearchOpen) {
                      setCustomerSearchOpen(true);
                      setCustomerSearchError(null);
                    }
                  }}
                  type="search"
                  placeholder="Nombre, correo o teléfono"
                  className="w-full flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomerSearchOpen(true);
                    setCustomerSearchError(null);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/20"
                >
                  <Search className="h-4 w-4" /> Buscar
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddCustomerDialogOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ingresa al menos dos caracteres y selecciona al cliente desde la lista.
              </p>

              {selectedCustomer ? (
                <div className="flex flex-col gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{selectedCustomer.fullName}</p>
                      <p className="text-xs opacity-80">
                        {selectedCustomer.phone ?? selectedCustomer.email ?? "Sin datos de contacto"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleEditCustomer}
                        disabled={customerDetailLoading}
                        className="text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-200 disabled:opacity-50"
                      >
                        {customerDetailLoading ? "Cargando..." : "Editar"}
                      </button>
                      <button
                        type="button"
                        onClick={clearSelectedCustomer}
                        className="text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-200"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="sm:col-span-2 space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Ticket</label>
              <input
                value={ticketNumber}
                readOnly
                type="text"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm shadow-sm cursor-not-allowed dark:border-slate-600 dark:bg-slate-800/60"
                placeholder="Ej. PAWN-000001"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  {ticketLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" /> Generando ticket según sucursal...
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="h-3.5 w-3.5 text-indigo-500" /> Ticket sugerido automáticamente para la sucursal activa.
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {ticketError ? (
                    <button
                      type="button"
                      onClick={() => void loadTicketNumber()}
                      className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 font-semibold text-amber-700 transition hover:border-amber-400 hover:text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200"
                    >
                      Reintentar
                    </button>
                  ) : null}
                </div>
              </div>
              {ticketError ? (
                <p className="text-xs text-rose-600 dark:text-rose-300">{ticketError}</p>
              ) : null}
            </div>

          </div>
        </section>

        {/* Collateral Section */}
        <section className="rounded-xl border border-slate-200 bg-white/80 p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
          <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
            <PackagePlus className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Colateral</h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Registra cada artículo entregado como garantía. Puedes adjuntar fotos del artículo.
            </p>
            <div className="space-y-4">
              {collateralItems.map((item, index) => (
                <div
                  key={index}
                  className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-12"
                >
                  <div className="sm:col-span-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Qty</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      value={item.qty}
                      onChange={(event) => {
                        const value = event.target.value.replace(/\D/g, "").slice(0, 3);
                        updateCollateralItem(index, { qty: value });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-center focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                      placeholder="1"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Descripción</label>
                    <input
                      value={item.description}
                      maxLength={30}
                      onChange={(event) => updateCollateralItem(index, { description: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                      placeholder="Ej. Cadena de oro 14k"
                    />
                    <p className="mt-1 text-xs text-slate-400">{item.description.length}/30</p>
                  </div>
                  <div className="sm:col-span-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Kilate</label>
                    <input
                      value={item.kilate}
                      onChange={(event) => updateCollateralItem(index, { kilate: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-center focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                      placeholder="14k"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Peso</label>
                    <input
                      value={item.weight}
                      onChange={(event) => updateCollateralItem(index, { weight: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-center focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                      placeholder="g"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Valor estimado</label>
                    <input
                      value={item.estimatedValue}
                      onChange={(event) => updateCollateralItem(index, { estimatedValue: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                      placeholder="RD$"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Foto</label>
                    <label className="mt-1 flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-sm transition hover:bg-slate-50 focus-within:border-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800">
                      <Camera className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            // For now, we'll store the file name. In a real implementation,
                            // you might want to upload the file and store the path
                            updateCollateralItem(index, { photoPath: file.name });
                          }
                        }}
                      />
                    </label>
                    {item.photoPath && (
                      <p className="mt-1 truncate text-xs text-slate-500">{item.photoPath}</p>
                    )}
                  </div>
                  <div className="sm:col-span-1 flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => removeCollateralRow(index)}
                      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addCollateralRow}
              disabled={collateralItems.length >= 4}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-indigo-400 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <PackagePlus className="h-4 w-4" /> Añadir artículo
            </button>
          </div>
        </section>

        {/* Terms Section */}
        <section className="rounded-xl border border-slate-200 bg-white/80 p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
          <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Términos</h2>
          </div>
          <div className="space-y-6">
            {loadingModels ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Cargando modelos de interés...
              </div>
            ) : modelsError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {modelsError}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {interestModels.map((model) => (
                  <label
                    key={model.id}
                    className={classNames(
                      "flex cursor-pointer flex-col gap-2 rounded-lg border p-4 shadow-sm transition",
                      Number(selectedModelId) === model.id
                        ? "border-indigo-500 ring-2 ring-indigo-200"
                        : "border-slate-200 hover:border-indigo-400"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{model.name}</p>
                        <p className="text-xs text-slate-500">{model.description ?? "Sin descripción"}</p>
                      </div>
                      <input
                        type="radio"
                        name="interestModel"
                        value={model.id}
                        checked={Number(selectedModelId) === model.id}
                        onChange={(event) => setSelectedModelId(event.target.value)}
                        className="h-4 w-4"
                      />
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      <p>Tasa por periodo: {(model.interestRateBps / 100).toFixed(2)}%</p>
                      <p>Periodo: {model.periodDays} días</p>
                      {model.minPrincipalCents ? (
                        <p>Mínimo: {pesoFormatter.format(model.minPrincipalCents / 100)}</p>
                      ) : null}
                      {model.maxPrincipalCents ? (
                        <p>Máximo: {pesoFormatter.format(model.maxPrincipalCents / 100)}</p>
                      ) : null}
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Monto prestado</label>
                <input
                  value={principalAmount}
                  onChange={(event) => setPrincipalAmount(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                  placeholder="RD$"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Fecha inicial</label>
                <input
                  value={todayIso()}
                  type="date"
                  disabled
                  readOnly
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm cursor-not-allowed dark:border-slate-600 dark:bg-slate-800/60"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsScheduleDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/20"
            >
              <FileText className="h-4 w-4" />
              Ver términos
            </button>
          </div>
        </section>

        {/* Success Message */}
        {submittedTicket && (
          <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-8 shadow-lg dark:border-emerald-500/40 dark:bg-emerald-500/10">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="mr-2 inline h-4 w-4" /> Préstamo registrado exitosamente. Ticket #{submittedTicket.ticketNumber}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Resumen del préstamo</h2>
                <dl className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <dt>Ticket</dt>
                    <dd>{ticketNumber}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Sucursal</dt>
                    <dd>{branchId}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Cliente</dt>
                    <dd>
                      {selectedCustomer
                        ? `${selectedCustomer.fullName} (#${selectedCustomer.id})`
                        : "N/A"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Monto prestado</dt>
                    <dd>{pesoFormatter.format((parseCurrencyToCents(principalAmount) ?? 0) / 100)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Modelo</dt>
                    <dd>{currentModel?.name ?? "N/A"}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Colateral</h2>
                <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {collateralItems
                    .filter((item) => item.description.trim().length > 0)
                    .map((item, index) => (
                      <li key={index} className="flex justify-between">
                        <span>{item.description}</span>
                        <span>{item.estimatedValue || "-"}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">Calendario</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {manualSchedule.map((row, index) => (
                  <li key={index} className="flex justify-between">
                    <span>Cuota #{index + 1}</span>
                    <span>
                      {row.dueOn} · Interés {pesoFormatter.format(row.interestCents / 100)} · Cargo {pesoFormatter.format(
                        row.feeCents / 100
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {submissionError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
                {submissionError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <FileText className="h-4 w-4" /> Imprimir ticket
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerQuery("");
                  setTicketNumber("");
                  setTicketError(null);
                  setTicketLoading(false);
                  void loadTicketNumber();
                  setCustomerResults([]);
                  setCustomerSearchError(null);
                  setCollateralItems([
                    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
                    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
                    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
                    { qty: "", description: "", kilate: "", weight: "", estimatedValue: "", photoPath: "" },
                  ]);
                  setSelectedModelId("");
                  setPrincipalAmount("");
                  setManualSchedule([]);
                  setSubmittedTicket(null);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-600"
              >
                Nuevo préstamo
              </button>
            </div>
          </section>
        )}

        {/* Submit Section */}
        {!submittedTicket && (
          <section className="rounded-xl border border-slate-200 bg-white/80 p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
            <div className="space-y-6">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p>
                  Revisa toda la información antes de emitir el ticket. Se registrarán los colaterales, calendario de
                  interés y rutas de ID en la base de datos.
                </p>
              </div>

              {submissionError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
                  {submissionError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !canSubmit}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Emitir ticket
              </button>
            </div>
          </section>
        )}
      </form>
      </div>
      {isCustomerSearchOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={closeCustomerSearchDialog}
        >
          <div
            className="w-full max-w-3xl space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Buscar cliente</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Filtra clientes por nombre, correo o teléfono para vincularlos al nuevo préstamo.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCustomerSearchDialog}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Cerrar búsqueda de clientes"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
              Nombre, correo o teléfono
              <input
                value={customerQuery}
                onChange={(event) => {
                  const newValue = event.target.value;
                  setCustomerQuery(newValue);
                  if (selectedCustomer && newValue.trim() !== selectedCustomer.fullName) {
                    setSelectedCustomer(null);
                  }
                }}
                autoFocus
                type="search"
                placeholder="Ej. Ana Pérez o 809"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>

            {customerSearchError ? (
              <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                {customerSearchError}
              </div>
            ) : null}

            <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-inner dark:border-slate-800 dark:bg-slate-950/40">
              {customerSearchLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Buscando clientes...
                </div>
              ) : customerResults.length === 0 && !customerSearchError ? (
                <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  No se encontraron coincidencias para la búsqueda actual.
                </div>
              ) : customerResults.length > 0 ? (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {customerResults.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectCustomer(customer)}
                        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-indigo-50 dark:hover:bg-slate-800"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{customer.fullName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {customer.phone ?? customer.email ?? "Sin contacto"}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">ID #{customer.id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Add Customer Dialog */}
      <AddCustomerDialog
        isOpen={isAddCustomerDialogOpen}
        onClose={() => setIsAddCustomerDialogOpen(false)}
        onSuccess={(customer) => {
          const fullName = `${customer.firstName} ${customer.lastName}`.trim();
          const customerSummary: CustomerSummary = {
            id: customer.id,
            fullName,
            email: customer.email,
            phone: customer.phone,
            branchId: null,
          };
          setSelectedCustomer(customerSummary);
          setCustomerQuery(fullName);
          setCustomerResults([]);
          setIsAddCustomerDialogOpen(false);
        }}
        onError={(error) => setCustomerSearchError(error)}
      />

      {/* Edit Customer Dialog */}
      {isEditCustomerDialogOpen && customerDetail ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={() => setIsEditCustomerDialogOpen(false)}
        >
          <div
            className="w-full max-w-2xl space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Editar cliente</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Modifica los datos del cliente según sea necesario.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditCustomerDialogOpen(false)}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Cerrar edición de cliente"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {customerDetailError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                {customerDetailError}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Nombre
                  <input
                    value={customerDetail.firstName}
                    onChange={(event) =>
                      setCustomerDetail({ ...customerDetail, firstName: event.target.value })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Nombre"
                  />
                </label>
              </div>
              <div className="sm:col-span-1">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Apellido
                  <input
                    value={customerDetail.lastName}
                    onChange={(event) =>
                      setCustomerDetail({ ...customerDetail, lastName: event.target.value })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Apellido"
                  />
                </label>
              </div>
              <div className="sm:col-span-1">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Teléfono
                  <input
                    type="tel"
                    value={customerDetail.phone || ""}
                    onChange={(event) =>
                      setCustomerDetail({ ...customerDetail, phone: event.target.value || null })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Teléfono"
                  />
                </label>
              </div>
              <div className="sm:col-span-1">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Correo electrónico
                  <input
                    type="email"
                    value={customerDetail.email || ""}
                    onChange={(event) =>
                      setCustomerDetail({ ...customerDetail, email: event.target.value || null })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Correo electrónico"
                  />
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Dirección
                  <textarea
                    value={customerDetail.address || ""}
                    onChange={(event) =>
                      setCustomerDetail({ ...customerDetail, address: event.target.value || null })
                    }
                    rows={3}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Dirección"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditCustomerDialogOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveCustomer()}
                disabled={customerSaving || !customerDetail.firstName.trim() || !customerDetail.lastName.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {customerSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Schedule Terms Dialog */}
      {isScheduleDialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={() => setIsScheduleDialogOpen(false)}
        >
          <div
            className="w-full max-w-4xl space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Términos del préstamo</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Calendario de pagos y términos del préstamo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleDialogOpen(false)}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Cerrar diálogo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] table-fixed border-collapse overflow-hidden rounded-lg border border-slate-200 text-sm shadow-sm dark:border-slate-700">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Vence</th>
                    <th className="px-4 py-2 text-left">Interés</th>
                    <th className="px-4 py-2 text-left">Cargo</th>
                  </tr>
                </thead>
                <tbody>
                  {manualSchedule.map((row, index) => (
                    <tr key={index} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{index + 1}</td>
                      <td className="px-4 py-2">
                        <input
                          value={row.dueOn}
                          onChange={(event) => handleScheduleChange(index, { dueOn: event.target.value })}
                          type="date"
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={(row.interestCents / 100).toFixed(2)}
                          onChange={(event) =>
                            handleScheduleChange(index, {
                              interestCents: Math.max(0, Math.round(Number(event.target.value) * 100 || 0)),
                            })
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={(row.feeCents / 100).toFixed(2)}
                          onChange={(event) =>
                            handleScheduleChange(index, {
                              feeCents: Math.max(0, Math.round(Number(event.target.value) * 100 || 0)),
                            })
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                        />
                      </td>
                    </tr>
                  ))}
                  {manualSchedule.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-xs text-slate-500" colSpan={4}>
                        Selecciona un modelo y completa el monto para ver el calendario sugerido.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

