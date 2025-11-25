"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Building2,
  History,
  Loader2,
  PiggyBank,
  ShieldCheck,
  ShoppingCart,
  CreditCard,
  Package,
  RotateCcw,
  Settings,
} from "lucide-react";

import { formatCurrency } from "@/components/cash/utils";
import { useActiveBranch } from "@/components/providers/active-branch-provider";
import { useCurrentUser } from "@/components/providers/current-user-provider";
import { formatDateTimeForDisplay } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type Shift = {
  id: number;
  branchId: number;
  openedBy: number;
  closedBy: number | null;
  openingCashCents: number;
  closingCashCents: number | null;
  expectedCashCents: number | null;
  overShortCents: number | null;
  openedAt: string;
  closedAt: string | null;
};

type CashMovement = {
  id: number;
  shiftId: number;
  kind: string;
  amountCents: number;
  reason: string | null;
  createdAt: string;
};

type CashTransaction = {
  id: string;
  type: "adjustment" | "sale" | "loan" | "layaway" | "refund";
  kind: string;
  amountCents: number;
  reason: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

type MovementSummary = {
  totalsByKind: Record<string, { totalCents: number; count: number }>;
  netMovementCents: number;
};

type ShiftMovementsResponse = {
  shift: Shift;
  movements: CashMovement[];
  summary: MovementSummary;
};

type CashTransactionsResponse = {
  shift: Shift;
  transactions: CashTransaction[];
};

type StatusMessage = { tone: "success" | "error"; message: string } | null;

type MovementKind =
  | "deposit"
  | "cash_to_safe"
  | "drop"
  | "paid_in"
  | "paid_out"
  | "expense"
  | "income";

type ApiError = Error & { status?: number };

const MOVEMENT_DIRECTIONS: Record<MovementKind, 1 | -1> = {
  deposit: 1,
  cash_to_safe: -1,
  drop: -1,
  paid_in: 1,
  paid_out: -1,
  expense: -1,
  income: 1,
};

const MOVEMENT_LABELS: Record<MovementKind, string> = {
  deposit: "Depósito en caja",
  cash_to_safe: "Traslado a bóveda",
  drop: "Drop a bóveda",
  paid_in: "Paid-in",
  paid_out: "Paid-out",
  expense: "Gasto operativo",
  income: "Ingreso extraordinario",
};

const MOVEMENT_HELPERS: Record<MovementKind, string> = {
  deposit: "Refuerza el cajón con efectivo que entra desde caja fuerte o banco.",
  cash_to_safe: "Envía excedente de efectivo a bóveda/seguridad.",
  drop: "Registra drops rápidos de seguridad durante el turno.",
  paid_in: "Ingreso puntual (cliente paga recibo, adelanto, etc.).",
  paid_out: "Salida para pagos menores o devoluciones autorizadas.",
  expense: "Pago en efectivo de gastos operativos del día.",
  income: "Ingresos fuera de ventas (servicios, recargas, etc.).",
};

const MOVEMENT_ORDER: MovementKind[] = [
  "deposit",
  "cash_to_safe",
  "drop",
  "paid_in",
  "paid_out",
  "expense",
  "income",
];

const movementOptions = MOVEMENT_ORDER.map((kind) => ({
  value: kind,
  label: MOVEMENT_LABELS[kind],
  helper: MOVEMENT_HELPERS[kind],
  direction: MOVEMENT_DIRECTIONS[kind],
}));

// Transaction type labels and icons
const TRANSACTION_TYPE_LABELS: Record<CashTransaction["type"], string> = {
  adjustment: "Ajuste",
  sale: "Venta",
  loan: "Préstamo",
  layaway: "Layaway",
  refund: "Devolución",
};

const TRANSACTION_TYPE_ICONS: Record<CashTransaction["type"], typeof ShoppingCart> = {
  adjustment: Settings,
  sale: ShoppingCart,
  loan: CreditCard,
  layaway: Package,
  refund: RotateCcw,
};

const TRANSACTION_KIND_LABELS: Record<string, string> = {
  // Adjustments
  deposit: "Depósito en caja",
  cash_to_safe: "Traslado a bóveda",
  drop: "Drop a bóveda",
  paid_in: "Paid-in",
  paid_out: "Paid-out",
  expense: "Gasto operativo",
  income: "Ingreso extraordinario",
  // Sales
  sale: "Venta en efectivo",
  // Loans
  interest: "Pago de interés",
  advance: "Pago anticipado",
  redeem: "Redención",
  renew: "Renovación",
  extension: "Extensión",
  // Layaway
  payment: "Pago de layaway",
  // Refunds
  refund: "Devolución en efectivo",
};

const getTransactionDirection = (transaction: CashTransaction): 1 | -1 => {
  if (transaction.type === "refund") {
    return -1; // Refunds are always out
  }
  if (transaction.type === "sale" || transaction.type === "loan" || transaction.type === "layaway") {
    return 1; // Sales and payments are always in
  }
  // For adjustments, use the movement direction
  return MOVEMENT_DIRECTIONS[transaction.kind as MovementKind] ?? 1;
};

const getTransactionLabel = (transaction: CashTransaction): string => {
  if (transaction.type === "adjustment") {
    return TRANSACTION_KIND_LABELS[transaction.kind] ?? MOVEMENT_LABELS[transaction.kind as MovementKind] ?? transaction.kind;
  }
  if (transaction.type === "loan") {
    return TRANSACTION_KIND_LABELS[transaction.kind] ?? `Pago de préstamo (${transaction.kind})`;
  }
  return TRANSACTION_KIND_LABELS[transaction.kind] ?? TRANSACTION_TYPE_LABELS[transaction.type];
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
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

const parseAmountToCents = (raw: string) => {
  const normalized = raw.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100);
};

const centsToCurrency = (value: number | null | undefined) =>
  formatCurrency(Number(value ?? 0) / 100);

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return "—";
  }

  return formatDateTimeForDisplay(value);
};

export default function CashMovementsPage() {
  const { branch: activeBranch, loading: branchLoading, error: branchError } = useActiveBranch();
  const { user: currentUser, loading: userLoading } = useCurrentUser();

  const [status, setStatus] = useState<StatusMessage>(null);
  const [isLoading, setIsLoading] = useState({ load: false, submit: false });
  const [shiftLookup, setShiftLookup] = useState({
    shiftId: "",
  });
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [allTransactions, setAllTransactions] = useState<CashTransaction[]>([]);
  const [movementForm, setMovementForm] = useState({
    kind: "deposit" as MovementKind,
    amount: "",
    reason: "",
  });
  const [movementFilter, setMovementFilter] = useState<"all" | "in" | "out">("all");

  const summary = useMemo(() => {
    const totalsByKind = movements.reduce<Record<string, { totalCents: number; count: number }>>((acc, movement) => {
      const key = movement.kind;
      const amount = Number(movement.amountCents ?? 0);
      if (!acc[key]) {
        acc[key] = { totalCents: 0, count: 0 };
      }
      acc[key].totalCents += amount;
      acc[key].count += 1;
      return acc;
    }, {});

    const netMovementCents = movements.reduce((sum, movement) => {
      const direction =
        MOVEMENT_DIRECTIONS[movement.kind as MovementKind] ?? (movement.kind === "refund" ? -1 : 1);
      return sum + direction * Number(movement.amountCents ?? 0);
    }, 0);

    return { totalsByKind, netMovementCents };
  }, [movements]);

  const resetState = useCallback(() => {
    setActiveShift(null);
    setMovements([]);
    setAllTransactions([]);
    setShiftLookup({ shiftId: "" });
    setMovementFilter("all");
  }, []);

  const loadShiftById = async (shiftId: number, successMessage?: string) => {
    setIsLoading((state) => ({ ...state, load: true }));
    setStatus(null);

    try {
      const [movementsData, transactionsData] = await Promise.all([
        getJson<ShiftMovementsResponse>(`/api/cash-movements?shiftId=${shiftId}`),
        getJson<CashTransactionsResponse>(`/api/shifts/${shiftId}/cash-transactions`),
      ]);
      
      if (activeBranch && movementsData.shift.branchId !== activeBranch.id) {
        setStatus({
          tone: "error",
          message: "El turno pertenece a otra sucursal. Ajusta la sucursal activa para revisar este turno.",
        });
        resetState();
        return;
      }
      setActiveShift(movementsData.shift);
      setMovements(movementsData.movements);
      setAllTransactions(transactionsData.transactions);
      setShiftLookup({ shiftId: String(movementsData.shift.id) });
      setMovementFilter("all");
      if (successMessage) {
        setStatus({ tone: "success", message: successMessage });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar el turno.";
      if ((error as ApiError)?.status === 404) {
        resetState();
      }
      setStatus({ tone: "error", message });
    } finally {
      setIsLoading((state) => ({ ...state, load: false }));
    }
  };

  const loadActiveShiftForBranch = useCallback(
    async (branchId: number, options: { quiet?: boolean } = {}) => {
      const { quiet = false } = options;

      setIsLoading((state) => ({ ...state, load: true }));
      if (!quiet) {
        setStatus(null);
      }

      try {
        const movementsData = await getJson<ShiftMovementsResponse>(`/api/shifts/active?branchId=${branchId}`);
        
        if (activeBranch && movementsData.shift.branchId !== activeBranch.id) {
          throw new Error(
            "El turno activo pertenece a otra sucursal. Actualiza la sucursal activa en ajustes para continuar."
          );
        }
        
        const transactionsData = await getJson<CashTransactionsResponse>(`/api/shifts/${movementsData.shift.id}/cash-transactions`).catch(() => ({ shift: movementsData.shift, transactions: [] }));
        
        setActiveShift(movementsData.shift);
        setMovements(movementsData.movements);
        setAllTransactions(transactionsData.transactions);
        setShiftLookup({ shiftId: String(movementsData.shift.id) });
        setMovementFilter("all");
        if (!quiet) {
          setStatus({
            tone: "success",
            message: `Turno activo #${movementsData.shift.id} para la sucursal ${branchId} listo para registrar movimientos.`,
          });
        }
      } catch (error) {
        resetState();
        if (!quiet) {
          const message = error instanceof Error ? error.message : "No se encontró un turno activo.";
          setStatus({ tone: "error", message });
        }
      } finally {
        setIsLoading((state) => ({ ...state, load: false }));
      }
    },
    [activeBranch, resetState],
  );

  const handleLoadActiveShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading.load) {
      return;
    }

    if (!activeBranch) {
      setStatus({
        tone: "error",
        message: branchError ?? "Configura una sucursal activa en ajustes para cargar el turno.",
      });
      return;
    }

    await loadActiveShiftForBranch(activeBranch.id);
  };

  const handleLoadShiftById = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading.load) {
      return;
    }

    const shiftId = Number(shiftLookup.shiftId);
    if (!Number.isInteger(shiftId) || shiftId <= 0) {
      setStatus({ tone: "error", message: "Ingresa un ID de turno válido." });
      return;
    }

    await loadShiftById(shiftId, `Turno #${shiftId} cargado.`);
  };

  useEffect(() => {
    if (branchLoading) {
      return;
    }

    if (!activeBranch) {
      resetState();
      return;
    }

    void loadActiveShiftForBranch(activeBranch.id, { quiet: true });
  }, [activeBranch, branchLoading, loadActiveShiftForBranch, resetState]);

  const handleMovementSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading.submit) {
      return;
    }

    if (!activeShift) {
      setStatus({ tone: "error", message: "Carga un turno activo antes de registrar movimientos." });
      return;
    }

    if (!currentUser) {
      setStatus({ tone: "error", message: "Usuario no disponible. Por favor, recarga la página." });
      return;
    }

    if (!movementForm.amount) {
      setStatus({ tone: "error", message: "El monto es obligatorio." });
      return;
    }

    const amountCents = parseAmountToCents(movementForm.amount);
    if (amountCents === null) {
      setStatus({ tone: "error", message: "Ingresa un monto válido en RD$." });
      return;
    }

    const direction = MOVEMENT_DIRECTIONS[movementForm.kind];
    if (direction < 0 && !movementForm.reason.trim()) {
      setStatus({ tone: "error", message: "Las salidas requieren un motivo documentado." });
      return;
    }

    setIsLoading((state) => ({ ...state, submit: true }));
    setStatus(null);

    try {
      const payload = {
        shiftId: activeShift.id,
        kind: movementForm.kind,
        amountCents,
        performedBy: currentUser.id,
        pin: "1234", // Default PIN for current user
        reason: movementForm.reason || null,
      };

      const data = await postJson<{ shift: Shift; movement: CashMovement }>("/api/cash-movements", payload);

      setActiveShift(data.shift);
      setMovements((state) => [data.movement, ...state]);
      
      // Reload all transactions to include the new movement
      try {
        const transactionsData = await getJson<CashTransactionsResponse>(`/api/shifts/${data.shift.id}/cash-transactions`);
        setAllTransactions(transactionsData.transactions);
      } catch {
        // If transaction loading fails, just add the movement manually
        setAllTransactions((state) => [
          {
            id: `cash_movement_${data.movement.id}`,
            type: "adjustment" as const,
            kind: data.movement.kind,
            amountCents: data.movement.amountCents,
            reason: data.movement.reason,
            createdAt: data.movement.createdAt,
            metadata: { cashMovementId: data.movement.id },
          },
          ...state,
        ]);
      }
      
      setMovementForm((state) => ({ ...state, amount: "", reason: "" }));
      setStatus({
        tone: "success",
        message: `${MOVEMENT_LABELS[movementForm.kind]} registrado correctamente para el turno #${data.shift.id}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar el movimiento.";
      setStatus({ tone: "error", message });
    } finally {
      setIsLoading((state) => ({ ...state, submit: false }));
    }
  };

  const orderedSummaryKeys = useMemo(() => {
    const existingKeys = Object.keys(summary.totalsByKind);
    const manualKeys = MOVEMENT_ORDER.filter((key) => existingKeys.includes(key));
    const remaining = existingKeys.filter((key) => !manualKeys.includes(key as MovementKind));
    return [...manualKeys, ...remaining];
  }, [summary.totalsByKind]);

  const flowTotals = useMemo(
    () =>
      movements.reduce(
        (acc, movement) => {
          const direction =
            MOVEMENT_DIRECTIONS[movement.kind as MovementKind] ?? (movement.kind === "refund" ? -1 : 1);
          const amount = Math.max(0, Number(movement.amountCents ?? 0));

          if (direction >= 0) {
            acc.inCents += amount;
            acc.inCount += 1;
          } else {
            acc.outCents += amount;
            acc.outCount += 1;
          }

          return acc;
        },
        { inCents: 0, inCount: 0, outCents: 0, outCount: 0 },
      ),
    [movements],
  );

  const transactionFlowTotals = useMemo(() => {
    return allTransactions.reduce(
      (acc, transaction) => {
        const direction = getTransactionDirection(transaction);
        const amount = Math.max(0, Number(transaction.amountCents ?? 0));

        if (direction >= 0) {
          acc.inCents += amount;
          acc.inCount += 1;
        } else {
          acc.outCents += amount;
          acc.outCount += 1;
        }

        return acc;
      },
      { inCents: 0, inCount: 0, outCents: 0, outCount: 0 },
    );
  }, [allTransactions]);

  // Combined totals including all cash transactions
  const combinedFlowTotals = useMemo(() => {
    const manual = flowTotals;
    const transactions = transactionFlowTotals;
    return {
      inCents: manual.inCents + transactions.inCents,
      inCount: manual.inCount + transactions.inCount,
      outCents: manual.outCents + transactions.outCents,
      outCount: manual.outCount + transactions.outCount,
    };
  }, [flowTotals, transactionFlowTotals]);

  const filteredMovements = useMemo(() => {
    if (movementFilter === "all") {
      return movements;
    }

    return movements.filter((movement) => {
      const direction =
        MOVEMENT_DIRECTIONS[movement.kind as MovementKind] ?? (movement.kind === "refund" ? -1 : 1);
      return movementFilter === "in" ? direction >= 0 : direction < 0;
    });
  }, [movementFilter, movements]);

  const filteredTransactions = useMemo(() => {
    if (movementFilter === "all") {
      return allTransactions;
    }

    return allTransactions.filter((transaction) => {
      const direction = getTransactionDirection(transaction);
      return movementFilter === "in" ? direction >= 0 : direction < 0;
    });
  }, [movementFilter, allTransactions]);

  const filterOptions = useMemo(
    () => [
      { value: "all" as const, label: "Todo", count: allTransactions.length },
      { value: "in" as const, label: "Entradas", count: transactionFlowTotals.inCount },
      { value: "out" as const, label: "Salidas", count: transactionFlowTotals.outCount },
    ],
    [transactionFlowTotals.inCount, transactionFlowTotals.outCount, allTransactions.length],
  );

  const totalFlowCents = flowTotals.inCents + flowTotals.outCents;
  const inboundShare = totalFlowCents === 0 ? 0 : (flowTotals.inCents / totalFlowCents) * 100;
  const outboundShare = totalFlowCents === 0 ? 0 : 100 - inboundShare;
  const netIsPositive = summary.netMovementCents > 0;
  const netIsNegative = summary.netMovementCents < 0;
  const netMovementAbsolute = Math.abs(summary.netMovementCents);
  const netMovementCopy = netIsNegative
    ? "Salió más efectivo del turno"
    : netIsPositive
    ? "Entró más efectivo al turno"
    : "Balance sin variaciones";

  const renderStatusBanner = () => {
    if (!status) {
      return null;
    }

    const Icon = status.tone === "success" ? ShieldCheck : AlertTriangle;
    const colorClasses =
      status.tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-200"
        : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200";

    return (
      <div className={`mb-8 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${colorClasses}`}>
        <Icon className="mt-0.5 h-5 w-5" />
        <p>{status.message}</p>
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10 flex flex-col gap-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cash</span>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Cash movements</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Registra depósitos, paid-ins, paid-outs y traslados a bóveda conectados al turno activo para que el cierre de caja
          refleje cada ajuste en tiempo real.
        </p>
      </header>

      {renderStatusBanner()}

      <section className="grid gap-8 lg:grid-cols-[1.6fr,1fr]">
        <div className="space-y-8">
          <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900/60">
            <header className="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <PiggyBank className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Contexto del turno</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Consulta el efectivo esperado y el impacto neto de los movimientos manuales registrados.
                </p>
              </div>
            </header>

            {!activeShift ? (
              <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                Carga un turno activo para visualizar su balance y los movimientos manuales registrados.
              </p>
            ) : (
              <div className="grid gap-6 px-6 py-6">
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                    Turno #{activeShift.id}
                  </span>
                  <span>Sucursal {activeShift.branchId}</span>
                  <span>
                    Apertura: <strong>{formatDate(activeShift.openedAt)}</strong>
                  </span>
                  <span>
                    Estado: {activeShift.closedAt ? <strong>Cerrado</strong> : <strong>Activo</strong>}
                  </span>
                </div>

                <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/40 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Apertura declarada</p>
                    <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {centsToCurrency(activeShift.openingCashCents)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Efectivo reportado al inicio del turno.</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Efectivo esperado</p>
                    <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {centsToCurrency(activeShift.expectedCashCents)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Incluye ventas, pagos y movimientos manuales.</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Entradas totales</p>
                    <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-300">
                      {centsToCurrency(combinedFlowTotals.inCents)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {combinedFlowTotals.inCount} {combinedFlowTotals.inCount === 1 ? "transacción" : "transacciones"} hacia caja.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Salidas totales</p>
                    <p className="text-xl font-semibold text-rose-600 dark:text-rose-300">
                      {centsToCurrency(combinedFlowTotals.outCents)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {combinedFlowTotals.outCount} {combinedFlowTotals.outCount === 1 ? "transacción" : "transacciones"} hacia fuera.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white/70 p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Impacto neto total</p>
                      <p
                        className={`flex items-center gap-2 text-2xl font-semibold ${
                          combinedFlowTotals.inCents - combinedFlowTotals.outCents < 0
                            ? "text-rose-600 dark:text-rose-300"
                            : combinedFlowTotals.inCents - combinedFlowTotals.outCents > 0
                            ? "text-emerald-600 dark:text-emerald-300"
                            : "text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        <ArrowLeftRight className="h-5 w-5" />
                        {centsToCurrency(Math.abs(combinedFlowTotals.inCents - combinedFlowTotals.outCents))}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {combinedFlowTotals.inCents - combinedFlowTotals.outCents < 0
                          ? "Salió más efectivo del turno"
                          : combinedFlowTotals.inCents - combinedFlowTotals.outCents > 0
                          ? "Entró más efectivo al turno"
                          : "Balance sin variaciones"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      {allTransactions.length} {allTransactions.length === 1 ? "transacción" : "transacciones"} de efectivo
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <span>Entradas {centsToCurrency(combinedFlowTotals.inCents)}</span>
                      <span>Salidas {centsToCurrency(combinedFlowTotals.outCents)}</span>
                    </div>
                    {combinedFlowTotals.inCents + combinedFlowTotals.outCents === 0 ? (
                      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800" />
                    ) : (
                      <div className="flex h-2 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                        <span
                          className="h-full bg-emerald-500/80"
                          style={{ 
                            width: `${Math.max(0, Math.min(100, ((combinedFlowTotals.inCents / (combinedFlowTotals.inCents + combinedFlowTotals.outCents)) * 100) || 0))}%` 
                          }}
                        />
                        <span
                          className="h-full bg-rose-500/80"
                          style={{ 
                            width: `${Math.max(0, Math.min(100, ((combinedFlowTotals.outCents / (combinedFlowTotals.inCents + combinedFlowTotals.outCents)) * 100) || 0))}%` 
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white/70 p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-950/40">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Desglose por tipo
                  </p>
                  {orderedSummaryKeys.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Aún no hay movimientos manuales registrados.</p>
                  ) : (
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {orderedSummaryKeys.map((key) => {
                        const totals = summary.totalsByKind[key];
                        const direction =
                          MOVEMENT_DIRECTIONS[key as MovementKind] ?? (key === "refund" ? -1 : 1);
                        const displayLabel = MOVEMENT_LABELS[key as MovementKind] ?? key.replace(/_/g, " ");
                        const amount = centsToCurrency(totals.totalCents);
                        return (
                          <li
                            key={key}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/60"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-700 dark:text-slate-200">{displayLabel}</span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {totals.count} {totals.count === 1 ? "registro" : "registros"}
                              </span>
                            </div>
                            <span
                              className={`text-sm font-semibold ${
                                direction < 0
                                  ? "text-rose-600 dark:text-rose-300"
                                  : "text-emerald-600 dark:text-emerald-300"
                              }`}
                            >
                              {direction < 0 ? "- " : ""}
                              {amount}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900/60">
            <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <History className="h-5 w-5" />
              </span>
              <div className="min-w-[200px]">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Historial del turno</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Visualiza todos los movimientos de efectivo: ventas, préstamos, layaways, devoluciones y ajustes manuales.
                </p>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                {filterOptions.map((option) => {
                  const isActive = movementFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMovementFilter(option.value)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
                      }`}
                      aria-pressed={isActive}
                    >
                      {option.label}
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                          isActive
                            ? "bg-white/20"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {option.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </header>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {!activeShift ? (
                <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                  Selecciona un turno para revisar sus movimientos.
                </p>
              ) : filteredTransactions.length === 0 ? (
                <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                  {movementFilter === "all"
                    ? "Aún no hay movimientos de efectivo registrados para este turno."
                    : movementFilter === "in"
                    ? "No se registraron entradas con el filtro aplicado."
                    : "No se registraron salidas con el filtro aplicado."}
                </p>
              ) : (
                filteredTransactions.map((transaction) => {
                  const direction = getTransactionDirection(transaction);
                  const formattedAmount = centsToCurrency(transaction.amountCents);
                  const TransactionIcon = TRANSACTION_TYPE_ICONS[transaction.type];
                  const label = getTransactionLabel(transaction);
                  return (
                    <article
                      key={transaction.id}
                      className="flex items-start justify-between gap-4 px-6 py-4 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full ${
                            direction < 0
                              ? "bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-200"
                              : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200"
                          }`}
                        >
                          <TransactionIcon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-100">
                            {label}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatDate(transaction.createdAt)}
                            {transaction.reason ? ` · ${transaction.reason}` : ""}
                            {transaction.metadata?.orderId ? ` · Orden #${transaction.metadata.orderId}` : ""}
                            {transaction.metadata?.loanId ? ` · Préstamo #${transaction.metadata.loanId}` : ""}
                            {transaction.metadata?.layawayId ? ` · Layaway #${transaction.metadata.layawayId}` : ""}
                            {transaction.metadata?.invoiceId ? ` · Factura #${transaction.metadata.invoiceId}` : ""}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold ${
                          direction < 0
                            ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-200"
                            : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200"
                        }`}
                      >
                        {direction < 0 ? "-" : "+"}
                        {formattedAmount}
                      </span>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <section className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900/60">
            <header className="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Seleccionar turno</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Localiza el turno activo por sucursal o carga uno específico por ID.
                </p>
              </div>
            </header>

            <div className="space-y-6 px-6 py-5 text-sm">
              <form onSubmit={handleLoadActiveShift} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1 space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Sucursal activa
                    </span>
                    {branchLoading ? (
                      <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando configuración…
                      </span>
                    ) : branchError ? (
                      <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                        {branchError}
                      </span>
                    ) : activeBranch ? (
                      <span className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-200">
                        {activeBranch.name}
                      </span>
                    ) : (
                      <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-600">
                        Configura una sucursal activa en ajustes para operar caja.
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading.load || branchLoading || !activeBranch}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    {isLoading.load ? "Buscando..." : "Cargar turno activo"}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Busca automáticamente el turno abierto de la sucursal configurada en ajustes y sincroniza sus movimientos.
                </p>
              </form>

              <form onSubmit={handleLoadShiftById} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="flex-1 space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      ID de turno
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={shiftLookup.shiftId}
                      onChange={(event) => setShiftLookup((state) => ({ ...state, shiftId: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                      placeholder="Ej. 104"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isLoading.load}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    {isLoading.load ? "Cargando..." : "Buscar por ID"}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Útil para auditar turnos anteriores y validar que los movimientos queden registrados en el historial.
                </p>
              </form>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900/60">
            <header className="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <ArrowDownToLine className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Registrar movimiento</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Cada registro actualiza el efectivo esperado del turno y queda disponible para el cierre de caja.
                </p>
              </div>
            </header>
            <form onSubmit={handleMovementSubmit} className="space-y-4 px-6 py-5 text-sm">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipo de movimiento</span>
                <select
                  value={movementForm.kind}
                  onChange={(event) =>
                    setMovementForm((state) => ({ ...state, kind: event.target.value as MovementKind }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                >
                  {movementOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {MOVEMENT_HELPERS[movementForm.kind]}
                </p>
              </label>

              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Cajero responsable
                  </span>
                  {userLoading ? (
                    <span className="inline-flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
                    </span>
                  ) : currentUser ? (
                    <span className="block rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
                      {currentUser.fullName} (ID: {currentUser.id})
                    </span>
                  ) : (
                    <span className="block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      Usuario no disponible
                    </span>
                  )}
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Monto <span className="text-rose-500">*</span>
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={movementForm.amount}
                    onChange={(event) => setMovementForm((state) => ({ ...state, amount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                    placeholder="RD$ 0.00"
                    required
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Motivo / nota</span>
                <textarea
                  value={movementForm.reason}
                  onChange={(event) => setMovementForm((state) => ({ ...state, reason: event.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                  placeholder="Detalle interno, número de sobre, proveedor, etc."
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Obligatorio para salidas de efectivo. Ayuda al gerente a auditar drops y gastos.
                </p>
              </label>

              <button
                type="submit"
                disabled={isLoading.submit || !activeShift}
                className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                {isLoading.submit ? "Registrando..." : "Registrar movimiento"}
              </button>
              {!activeShift ? (
                <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                  Primero selecciona un turno activo para habilitar el formulario.
                </p>
              ) : null}
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
