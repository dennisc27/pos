"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  History,
  PiggyBank,
  ShieldCheck,
} from "lucide-react";

import { formatCurrency } from "@/components/cash/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const dateTimeFormatter = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
  timeStyle: "short",
});

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

type MovementSummary = {
  totalsByKind: Record<string, { totalCents: number; count: number }>;
  netMovementCents: number;
};

type ShiftMovementsResponse = {
  shift: Shift;
  movements: CashMovement[];
  summary: MovementSummary;
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

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return dateTimeFormatter.format(date);
};

export default function CashMovementsPage() {
  const [status, setStatus] = useState<StatusMessage>(null);
  const [isLoading, setIsLoading] = useState({ load: false, submit: false });
  const [shiftLookup, setShiftLookup] = useState({ branchId: "", shiftId: "" });
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [movementForm, setMovementForm] = useState({
    kind: "deposit" as MovementKind,
    amount: "",
    performedBy: "",
    pin: "",
    reason: "",
  });

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

  const resetState = () => {
    setActiveShift(null);
    setMovements([]);
  };

  const loadShiftById = async (shiftId: number, successMessage?: string) => {
    setIsLoading((state) => ({ ...state, load: true }));
    setStatus(null);

    try {
      const data = await getJson<ShiftMovementsResponse>(`/api/cash-movements?shiftId=${shiftId}`);
      setActiveShift(data.shift);
      setMovements(data.movements);
      setShiftLookup((state) => ({ ...state, shiftId: String(data.shift.id) }));
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

  const loadActiveShiftForBranch = async (branchId: number) => {
    setIsLoading((state) => ({ ...state, load: true }));
    setStatus(null);

    try {
      const data = await getJson<ShiftMovementsResponse>(`/api/shifts/active?branchId=${branchId}`);
      setActiveShift(data.shift);
      setMovements(data.movements);
      setShiftLookup({ branchId: String(branchId), shiftId: String(data.shift.id) });
      setStatus({
        tone: "success",
        message: `Turno activo #${data.shift.id} para la sucursal ${branchId} listo para registrar movimientos.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se encontró un turno activo.";
      resetState();
      setStatus({ tone: "error", message });
    } finally {
      setIsLoading((state) => ({ ...state, load: false }));
    }
  };

  const handleLoadActiveShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading.load) {
      return;
    }

    const branchId = Number(shiftLookup.branchId);
    if (!Number.isInteger(branchId) || branchId <= 0) {
      setStatus({ tone: "error", message: "Ingresa un ID de sucursal válido." });
      return;
    }

    await loadActiveShiftForBranch(branchId);
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

  const handleMovementSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading.submit) {
      return;
    }

    if (!activeShift) {
      setStatus({ tone: "error", message: "Carga un turno activo antes de registrar movimientos." });
      return;
    }

    if (!movementForm.performedBy || !movementForm.pin || !movementForm.amount) {
      setStatus({ tone: "error", message: "Monto, cajero y PIN son obligatorios." });
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
        performedBy: Number(movementForm.performedBy),
        pin: movementForm.pin,
        reason: movementForm.reason || null,
      };

      const data = await postJson<{ shift: Shift; movement: CashMovement }>("/api/cash-movements", payload);

      setActiveShift(data.shift);
      setMovements((state) => [data.movement, ...state]);
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

                <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/40 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Efectivo esperado</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {centsToCurrency(activeShift.expectedCashCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Apertura declarada</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {centsToCurrency(activeShift.openingCashCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Movimientos manuales</p>
                    <p
                      className={`text-lg font-semibold ${
                        summary.netMovementCents === 0
                          ? "text-slate-700 dark:text-slate-300"
                          : summary.netMovementCents > 0
                          ? "text-emerald-600 dark:text-emerald-300"
                          : "text-rose-600 dark:text-rose-300"
                      }`}
                    >
                      {centsToCurrency(Math.abs(summary.netMovementCents))}
                      {summary.netMovementCents === 0 ? "" : summary.netMovementCents > 0 ? " ingreso" : " salida"}
                    </p>
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
            <header className="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <History className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Historial del turno</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Visualiza cada movimiento manual registrado con su motivo y hora exacta.
                </p>
              </div>
            </header>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {!activeShift ? (
                <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                  Selecciona un turno para revisar sus movimientos.
                </p>
              ) : movements.length === 0 ? (
                <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                  Aún no hay movimientos registrados para este turno.
                </p>
              ) : (
                movements.map((movement) => {
                  const direction =
                    MOVEMENT_DIRECTIONS[movement.kind as MovementKind] ?? (movement.kind === "refund" ? -1 : 1);
                  const formattedAmount = centsToCurrency(movement.amountCents);
                  return (
                    <article key={movement.id} className="flex items-center justify-between px-6 py-4 text-sm">
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">
                          {MOVEMENT_LABELS[movement.kind as MovementKind] ?? movement.kind.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(movement.createdAt)}
                          {movement.reason ? ` · ${movement.reason}` : ""}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 text-sm font-semibold ${
                          direction < 0 ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300"
                        }`}
                      >
                        {direction < 0 ? <ArrowUpFromLine className="h-4 w-4" /> : <ArrowDownToLine className="h-4 w-4" />}
                        {direction < 0 ? "- " : ""}
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
                  <label className="flex-1 space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      ID de sucursal
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={shiftLookup.branchId}
                      onChange={(event) => setShiftLookup((state) => ({ ...state, branchId: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                      placeholder="Ej. 1"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isLoading.load}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    {isLoading.load ? "Buscando..." : "Cargar turno activo"}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Busca automáticamente el turno abierto para la sucursal seleccionada y trae su historial.
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

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Monto</span>
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
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Cajero responsable
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={movementForm.performedBy}
                    onChange={(event) => setMovementForm((state) => ({ ...state, performedBy: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                    placeholder="ID de usuario"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">PIN</span>
                  <input
                    type="password"
                    value={movementForm.pin}
                    onChange={(event) => setMovementForm((state) => ({ ...state, pin: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                    placeholder="****"
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
