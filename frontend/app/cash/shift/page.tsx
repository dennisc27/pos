"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  AlertTriangle,
  Calculator,
  Coins,
  FileText,
  History,
  Loader2,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import { formatCurrency } from "@/components/cash/utils";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const numberFormatter = new Intl.NumberFormat("es-DO");
const dateTimeFormatter = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" });
const OVER_SHORT_THRESHOLD_CENTS = 5_000; // RD$50 variance threshold

type ApiError = Error & { status?: number };

type Shift = {
  id: number;
  branchId: number;
  openedBy: number;
  closedBy: number | null;
  openingCashCents: number;
  closingCashCents: number | null;
  expectedCashCents: number;
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

type ShiftSnapshot = {
  computedAt: string;
  shift: {
    id: number;
    branchId: number | null;
    openedBy: number | null;
    closedBy: number | null;
    openedAt: string | null;
    closedAt: string | null;
  };
  openingCashCents: number;
  closingCashCents: number | null;
  expectedCashCents: number;
  overShortCents: number | null;
  cashPaymentsCents: number;
  paymentsByMethod: Record<string, { totalCents: number; count: number }>;
  cashMovements: {
    totalsByKind: Record<string, { totalCents: number; count: number }>;
    netMovementCents: number;
  };
};

type ShiftMovementsResponse = {
  shift: Shift;
  movements: CashMovement[];
  summary: {
    totalsByKind: Record<string, { totalCents: number; count: number }>;
    netMovementCents: number;
  };
};

type ShiftEndReportResponse = {
  generatedAt: string;
  shift: {
    id: number;
    branchId: number | null;
    openedBy: number | null;
    closedBy: number | null;
    openedAt: string | null;
    closedAt: string | null;
  };
  totals: {
    openingCashCents?: number | null;
    closingCashCents?: number | null;
    expectedCashCents?: number | null;
    overShortCents?: number | null;
    cashPaymentsCents?: number | null;
    netMovementCents?: number | null;
  };
  payments?: {
    summary?: {
      methods?: Record<string, { totalCents: number; count: number }>;
    };
  };
  cashMovements?: {
    summary?: {
      totalsByKind?: Record<string, { totalCents: number; count: number }>;
      netMovementCents?: number | null;
    };
  };
  recentShifts?: Array<{ id: number | null }>;
  resolvedShiftId: number;
};

type StatusMessage = { tone: "success" | "error"; message: string } | null;

type MovementType = "drop" | "paid-in" | "paid-out";

const DENOMINATIONS: Array<{ label: string; value: number; group: "bills" | "coins" }> = [
  { label: "RD$2,000", value: 2000, group: "bills" },
  { label: "RD$1,000", value: 1000, group: "bills" },
  { label: "RD$500", value: 500, group: "bills" },
  { label: "RD$200", value: 200, group: "bills" },
  { label: "RD$100", value: 100, group: "bills" },
  { label: "RD$50", value: 50, group: "coins" },
  { label: "RD$25", value: 25, group: "coins" },
  { label: "RD$10", value: 10, group: "coins" },
  { label: "RD$5", value: 5, group: "coins" },
  { label: "RD$1", value: 1, group: "coins" },
];

const denominationKey = (value: number) => value.toString();

const initialDenominationState = DENOMINATIONS.reduce<Record<string, string>>((acc, denom) => {
  acc[denominationKey(denom.value)] = "";
  return acc;
}, {});

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

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
};

const centsToCurrency = (value: number | null | undefined) => formatCurrency((Number(value ?? 0) / 100) || 0);

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

export default function CashShiftPage() {
  const { branch: activeBranch, loading: branchLoading, error: branchError } = useActiveBranch();
  const [status, setStatus] = useState<StatusMessage>(null);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [reports, setReports] = useState<ShiftSnapshot[]>([]);
  const [denominations, setDenominations] = useState(initialDenominationState);
  const [isLoading, setIsLoading] = useState({ open: false, close: false, movement: false, load: false });
  const [openForm, setOpenForm] = useState({ branchId: "", openedBy: "", pin: "", openingCash: "" });
  const [closeForm, setCloseForm] = useState({ closedBy: "", pin: "", closingCash: "" });
  const [movementForm, setMovementForm] = useState({
    performedBy: "",
    pin: "",
    amount: "",
    reason: "",
    type: "drop" as MovementType,
  });
  const denominationRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setOpenForm((state) => ({
      ...state,
      branchId: activeBranch ? String(activeBranch.id) : "",
    }));
  }, [activeBranch]);

  const countedTotal = useMemo(() => {
    return DENOMINATIONS.reduce((sum, denom) => {
      const key = denominationKey(denom.value);
      const quantity = Number(denominations[key] ?? "0");
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return sum;
      }

      return sum + denom.value * quantity;
    }, 0);
  }, [denominations]);

  const expectedCash = activeShift ? Number(activeShift.expectedCashCents ?? 0) / 100 : 0;
  const variance = countedTotal - expectedCash;

  const mapReportToSnapshot = useCallback((report: ShiftEndReportResponse): ShiftSnapshot => {
    const paymentsByMethod = report.payments?.summary?.methods ?? {};
    const totalsByKind = report.cashMovements?.summary?.totalsByKind ?? {};

    return {
      computedAt: report.generatedAt,
      shift: {
        id: report.shift.id,
        branchId: report.shift.branchId ?? null,
        openedBy: report.shift.openedBy ?? null,
        closedBy: report.shift.closedBy ?? null,
        openedAt: report.shift.openedAt ?? null,
        closedAt: report.shift.closedAt ?? null,
      },
      openingCashCents: Number(report.totals?.openingCashCents ?? 0),
      closingCashCents:
        report.totals?.closingCashCents == null
          ? null
          : Number(report.totals?.closingCashCents ?? 0),
      expectedCashCents: Number(report.totals?.expectedCashCents ?? 0),
      overShortCents:
        report.totals?.overShortCents == null ? null : Number(report.totals?.overShortCents ?? 0),
      cashPaymentsCents: Number(report.totals?.cashPaymentsCents ?? 0),
      paymentsByMethod,
      cashMovements: {
        totalsByKind,
        netMovementCents: Number(report.cashMovements?.summary?.netMovementCents ?? 0),
      },
    };
  }, []);

  const loadShiftReportsForBranch = useCallback(
    async (branchId: number | null, options: { quiet?: boolean } = {}) => {
      const { quiet = false } = options;

      try {
        const query = branchId != null ? `?branchId=${branchId}` : "";
        const primary = await getJson<ShiftEndReportResponse>(`/api/reports/shift-end${query}`);

        const snapshots: ShiftSnapshot[] = [mapReportToSnapshot(primary)];

        const additionalIds = Array.from(
          new Set(
            (primary.recentShifts ?? [])
              .map((item) => (item?.id ? Number(item.id) : null))
              .filter((id): id is number => Number.isInteger(id) && id > 0 && id !== primary.resolvedShiftId),
          ),
        ).slice(0, 4);

        if (additionalIds.length > 0) {
          const extraReports = await Promise.all(
            additionalIds.map(async (id) => {
              try {
                const detail = await getJson<ShiftEndReportResponse>(`/api/reports/shift-end?shiftId=${id}`);
                return mapReportToSnapshot(detail);
              } catch (error) {
                return null;
              }
            }),
          );

          snapshots.push(...extraReports.filter((item): item is ShiftSnapshot => item != null));
        }

        setReports(snapshots);
      } catch (error) {
        setReports([]);
        if (!quiet) {
          const message = error instanceof Error ? error.message : "No se pudieron cargar los reportes.";
          setStatus({ tone: "error", message });
        }
      }
    },
    [mapReportToSnapshot],
  );

  const loadActiveShiftForBranch = useCallback(
    async (branchId: number, options: { quiet?: boolean } = {}) => {
      const { quiet = false } = options;

      setIsLoading((state) => ({ ...state, load: true }));
      if (!quiet) {
        setStatus(null);
      }

      try {
        const data = await getJson<ShiftMovementsResponse>(`/api/shifts/active?branchId=${branchId}`);
        setActiveShift(data.shift);
        setMovements(data.movements);
        await loadShiftReportsForBranch(branchId, { quiet: true });

        if (!quiet) {
          setStatus({
            tone: "success",
            message: `Turno activo #${data.shift.id} cargado para la sucursal ${branchId}.`,
          });
        }
      } catch (error) {
        if ((error as ApiError)?.status === 404) {
          setActiveShift(null);
          setMovements([]);
          await loadShiftReportsForBranch(branchId, { quiet: true });
          if (!quiet) {
            setStatus({ tone: "error", message: "No hay un turno abierto para esta sucursal." });
          }
        } else {
          const message = error instanceof Error ? error.message : "No se pudo cargar el turno.";
          if (!quiet) {
            setStatus({ tone: "error", message });
          }
        }
      } finally {
        setIsLoading((state) => ({ ...state, load: false }));
      }
    },
    [loadShiftReportsForBranch],
  );

  useEffect(() => {
    if (activeBranch) {
      void loadShiftReportsForBranch(activeBranch.id, { quiet: true });
      void loadActiveShiftForBranch(activeBranch.id, { quiet: true });
    } else {
      void loadShiftReportsForBranch(null, { quiet: true });
      setActiveShift(null);
      setMovements([]);
    }
  }, [activeBranch, loadActiveShiftForBranch, loadShiftReportsForBranch]);

  const handleDenominationChange = (value: number, next: string) => {
    if (/^\d*$/.test(next.trim())) {
      setDenominations((state) => ({ ...state, [denominationKey(value)]: next }));
    }
  };

  const focusDenominationAt = (index: number) => {
    if (index < 0 || index >= DENOMINATIONS.length) {
      return;
    }

    const key = denominationKey(DENOMINATIONS[index].value);
    const target = denominationRefs.current[key];
    if (target) {
      target.focus();
      target.select();
    }
  };

  const handleDenominationKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      focusDenominationAt(index + 1);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      focusDenominationAt(index + 1);
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      focusDenominationAt(index - 1);
    }
  };

  const handleResetDenominations = () => {
    setDenominations(initialDenominationState);
  };

  const setCounterAsOpening = () => {
    setOpenForm((state) => ({ ...state, openingCash: countedTotal ? countedTotal.toFixed(2) : "" }));
  };

  const setCounterAsClosing = () => {
    setCloseForm((state) => ({ ...state, closingCash: countedTotal ? countedTotal.toFixed(2) : "" }));
  };

  const handleOpenShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading.open) {
      return;
    }

    if (!activeBranch) {
      setStatus({
        tone: "error",
        message: branchError ?? "Configura una sucursal activa en ajustes antes de abrir turnos.",
      });
      return;
    }

    if (!openForm.openedBy || !openForm.pin) {
      setStatus({ tone: "error", message: "Branch, operator, and PIN are required to open a shift." });
      return;
    }

    const openingCents = parseAmountToCents(openForm.openingCash || "0");
    if (openingCents === null) {
      setStatus({ tone: "error", message: "Enter a valid opening cash amount." });
      return;
    }

    setIsLoading((state) => ({ ...state, open: true }));
    setStatus(null);

    try {
      const payload = {
        branchId: activeBranch.id,
        openedBy: Number(openForm.openedBy),
        openingCashCents: openingCents,
        pin: openForm.pin,
      };
      const data = await postJson<{ shift: Shift }>("/api/shifts/open", payload);
      setActiveShift(data.shift);
      setMovements([]);
      await loadShiftReportsForBranch(payload.branchId, { quiet: true });
      setStatus({ tone: "success", message: `Shift #${data.shift.id} opened for branch ${data.shift.branchId}.` });
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Unable to open shift." });
    } finally {
      setIsLoading((state) => ({ ...state, open: false }));
    }
  };

  const handleCloseShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeShift || isLoading.close) {
      return;
    }

    if (activeShift.closedAt) {
      setStatus({ tone: "error", message: "Este turno ya se encuentra cerrado." });
      return;
    }

    if (!closeForm.closedBy || !closeForm.pin) {
      setStatus({ tone: "error", message: "Closing operator and PIN are required." });
      return;
    }

    const closingCents = parseAmountToCents(closeForm.closingCash || "0");
    if (closingCents === null) {
      setStatus({ tone: "error", message: "Enter a valid closing cash amount." });
      return;
    }

    setIsLoading((state) => ({ ...state, close: true }));
    setStatus(null);

    try {
      const payload = {
        closedBy: Number(closeForm.closedBy),
        closingCashCents: closingCents,
        pin: closeForm.pin,
      };
      const data = await postJson<{ shift: Shift; snapshot: ShiftSnapshot }>(
        `/api/shifts/${activeShift.id}/close`,
        payload,
      );

      setActiveShift(data.shift);
      setReports((state) => [data.snapshot, ...state.filter((item) => item.shift.id !== data.snapshot.shift.id)]);
      const branchIdForReports =
        data.shift.branchId == null ? null : Number(data.shift.branchId);
      await loadShiftReportsForBranch(branchIdForReports, { quiet: true });
      setStatus({
        tone: "success",
        message: `Shift #${data.shift.id} closed with variance ${centsToCurrency(data.shift.overShortCents)}.`,
      });
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Unable to close shift." });
    } finally {
      setIsLoading((state) => ({ ...state, close: false }));
    }
  };

  const handleMovementSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeShift || isLoading.movement) {
      return;
    }

    if (activeShift.closedAt) {
      setStatus({ tone: "error", message: "No puedes registrar movimientos en un turno cerrado." });
      return;
    }

    if (!movementForm.performedBy || !movementForm.pin || !movementForm.amount) {
      setStatus({ tone: "error", message: "Amount, performer, and PIN are required for drawer movements." });
      return;
    }

    const amountCents = parseAmountToCents(movementForm.amount);
    if (amountCents === null || amountCents <= 0) {
      setStatus({ tone: "error", message: "Enter a valid movement amount." });
      return;
    }

    if ((movementForm.type === "drop" || movementForm.type === "paid-out") && !movementForm.reason.trim()) {
      setStatus({ tone: "error", message: "A reason is required for drops and paid-outs." });
      return;
    }

    setIsLoading((state) => ({ ...state, movement: true }));
    setStatus(null);

    try {
      const endpoint =
        movementForm.type === "drop"
          ? `/api/shifts/${activeShift.id}/drop`
          : movementForm.type === "paid-in"
          ? `/api/shifts/${activeShift.id}/paid-in`
          : `/api/shifts/${activeShift.id}/paid-out`;

      const payload = {
        performedBy: Number(movementForm.performedBy),
        amountCents,
        pin: movementForm.pin,
        reason: movementForm.reason || null,
      };

      const data = await postJson<{ shift: Shift; movement: CashMovement }>(endpoint, payload);
      setActiveShift(data.shift);
      setMovements((state) => [data.movement, ...state]);
      setStatus({ tone: "success", message: `${movementForm.type.replace("-", " ")} recorded successfully.` });
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Unable to record movement." });
    } finally {
      setIsLoading((state) => ({ ...state, movement: false }));
    }
  };

  const handleFetchActiveShift = async () => {
    if (isLoading.load) {
      return;
    }

    if (!activeBranch) {
      setStatus({
        tone: "error",
        message: branchError ?? "Configura una sucursal activa en ajustes antes de cargar el turno.",
      });
      return;
    }

    await loadActiveShiftForBranch(activeBranch.id);
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10 flex flex-col gap-2">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cash</span>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Shift management</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Count drawer cash with denomination precision, record drops and paid-ins in real time, and archive Z-reports
          with over/short alerts for audit review.
        </p>
      </header>

      {branchLoading ? (
        <div className="mb-8 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Sincronizando sucursal activa…
        </div>
      ) : !activeBranch ? (
        <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-200">
          Configura una sucursal predeterminada en Ajustes → Sistema antes de gestionar turnos.
        </div>
      ) : branchError ? (
        <div className="mb-8 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200">
          {branchError}
        </div>
      ) : null}

      {status ? (
        <div
          className={`mb-8 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            status.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200"
          }`}
        >
          {status.tone === "success" ? <ShieldCheck className="mt-0.5 h-5 w-5" /> : <AlertTriangle className="mt-0.5 h-5 w-5" />}
          <p>{status.message}</p>
        </div>
      ) : null}

      <section className="grid gap-8 lg:grid-cols-[1.6fr,1fr]">
        <div className="space-y-8">
          <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm ring-1 ring-black/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  <Calculator className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Denomination counter</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Introduce las cantidades por denominación para conciliar el efectivo del cajón.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={setCounterAsOpening}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Usar para apertura
                </button>
                <button
                  type="button"
                  onClick={setCounterAsClosing}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Usar para cierre
                </button>
                <button
                  type="button"
                  onClick={handleResetDenominations}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Reiniciar
                </button>
              </div>
            </div>

            <div className="grid gap-6 px-6 pb-6 pt-4 lg:grid-cols-[1.4fr,1fr]">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {DENOMINATIONS.map((denom, index) => {
                    const key = denominationKey(denom.value);
                    return (
                      <label
                        key={key}
                        className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm dark:border-slate-700 dark:bg-slate-900/40"
                      >
                        <span className="mb-2 flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <Coins className="h-4 w-4 text-slate-500" />
                          {denom.label}
                          <span className="ml-auto text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {denom.group === "bills" ? "Billetes" : "Monedas"}
                          </span>
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={denominations[key]}
                          onChange={(event) => handleDenominationChange(denom.value, event.target.value)}
                          onKeyDown={(event) => handleDenominationKeyDown(event, index)}
                          placeholder="0"
                          ref={(element) => {
                            denominationRefs.current[key] = element;
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                        />
                        <span className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Total: {formatCurrency(denom.value * Number(denominations[key] || 0))}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <aside className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white/60 p-5 text-sm shadow-inner dark:border-slate-700 dark:bg-slate-900/40">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total contado</p>
                    <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(countedTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Esperado</p>
                    <p className="text-lg font-medium text-slate-800 dark:text-slate-200">{formatCurrency(expectedCash)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Variación</p>
                    <p
                      className={`text-lg font-semibold ${
                        variance === 0
                          ? "text-slate-600 dark:text-slate-300"
                          : variance > 0
                          ? "text-emerald-600 dark:text-emerald-300"
                          : "text-rose-600 dark:text-rose-300"
                      }`}
                    >
                      {formatCurrency(variance)}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                  <p>
                    Usa este contador para documentar cierres y aperturas. Las diferencias mayores a RD$50 se marcarán en
                    el historial de Z-report.
                  </p>
                </div>
              </aside>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900/60">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  <History className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Movimientos recientes</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Cada drop, paid-in o paid-out ajusta el efectivo esperado del turno activo.
                  </p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {movements.length === 0 ? (
                <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
                  Sin movimientos registrados aún. Completa una acción en el panel derecho para comenzar el registro.
                </p>
              ) : (
                movements.map((movement) => {
                  const amount = centsToCurrency(movement.amountCents);
                  return (
                    <div key={movement.id} className="flex items-center justify-between px-6 py-4 text-sm">
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{movement.kind.replace(/_/g, " ")}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(movement.createdAt)}
                          {movement.reason ? ` · ${movement.reason}` : ""}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          movement.amountCents >= 0
                            ? "text-emerald-600 dark:text-emerald-300"
                            : "text-rose-600 dark:text-rose-300"
                        }`}
                      >
                        {amount}
                      </span>
                    </div>
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
                <RefreshCcw className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Ciclo del turno</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Abre el turno con tu PIN y regístralo al cerrar con el total contado.
                </p>
              </div>
            </header>

            <div className="space-y-6 px-6 py-5 text-sm">
              <form
                onSubmit={handleOpenShift}
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Apertura</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleFetchActiveShift}
                      disabled={isLoading.load}
                      className="text-xs font-medium text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {isLoading.load ? "Buscando..." : "Cargar turno"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenForm({ branchId: "", openedBy: "", pin: "", openingCash: "" })}
                      className="text-xs font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Sucursal</span>
                    {branchLoading ? (
                      <span className="inline-flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando…
                      </span>
                    ) : branchError ? (
                      <span className="block rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                        {branchError}
                      </span>
                    ) : activeBranch ? (
                      <span className="block rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
                        {activeBranch.name}
                      </span>
                    ) : (
                      <span className="block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        Configura una sucursal activa en ajustes
                      </span>
                    )}
                  </div>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Cajero</span>
                    <input
                      type="number"
                      min={1}
                      value={openForm.openedBy}
                      onChange={(event) => setOpenForm((state) => ({ ...state, openedBy: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                      placeholder="ID empleado"
                      required
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Efectivo inicial</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={openForm.openingCash}
                      onChange={(event) => setOpenForm((state) => ({ ...state, openingCash: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                      placeholder="RD$ 0.00"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">PIN de supervisor</span>
                    <input
                      type="password"
                      value={openForm.pin}
                      onChange={(event) => setOpenForm((state) => ({ ...state, pin: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                      placeholder="****"
                      required
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={isLoading.open}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {isLoading.open ? "Abriendo..." : "Abrir turno"}
                </button>
              </form>

              <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Turno activo</h3>
                {activeShift ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
                    <div>
                      <dt className="uppercase tracking-wide text-[10px] text-slate-400">Shift ID</dt>
                      <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">#{activeShift.id}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide text-[10px] text-slate-400">Sucursal</dt>
                      <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">{activeShift.branchId}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide text-[10px] text-slate-400">Esperado</dt>
                      <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {centsToCurrency(activeShift.expectedCashCents)}
                      </dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide text-[10px] text-slate-400">Apertura</dt>
                      <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">{formatDate(activeShift.openedAt)}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide text-[10px] text-slate-400">Estado</dt>
                      <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {activeShift.closedAt ? "Cerrado" : "Abierto"}
                      </dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-wide text-[10px] text-slate-400">Variance</dt>
                      <dd
                        className={`text-sm font-medium ${
                          (activeShift.overShortCents ?? 0) === 0
                            ? "text-slate-600 dark:text-slate-300"
                            : (activeShift.overShortCents ?? 0) > 0
                            ? "text-emerald-600 dark:text-emerald-300"
                            : "text-rose-600 dark:text-rose-300"
                        }`}
                      >
                        {centsToCurrency(activeShift.overShortCents)}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Ningún turno abierto. Registra la apertura para habilitar los movimientos y el cierre.
                  </p>
                )}
              </div>

              <form
                onSubmit={handleCloseShift}
                className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cierre</h3>
                  <button
                    type="button"
                    onClick={() => setCloseForm({ closedBy: "", pin: "", closingCash: "" })}
                    className="text-xs font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Limpiar
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Supervisor</span>
                    <input
                      type="number"
                      min={1}
                      value={closeForm.closedBy}
                      onChange={(event) => setCloseForm((state) => ({ ...state, closedBy: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                      placeholder="ID supervisor"
                      required
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total contado</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={closeForm.closingCash}
                      onChange={(event) => setCloseForm((state) => ({ ...state, closingCash: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                      placeholder="RD$ 0.00"
                      required
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">PIN</span>
                    <input
                      type="password"
                      value={closeForm.pin}
                      onChange={(event) => setCloseForm((state) => ({ ...state, pin: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                      placeholder="****"
                      required
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={isLoading.close || !activeShift}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  <FileText className="h-4 w-4" />
                  {isLoading.close ? "Cerrando..." : "Cerrar turno"}
                </button>
              </form>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900/60">
            <header className="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                <Coins className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Acciones del cajón</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Registra drops, paid-ins o paid-outs. Las salidas requieren motivo documentado.
                </p>
              </div>
            </header>
            <form onSubmit={handleMovementSubmit} className="space-y-4 px-6 py-5 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Acción</span>
                  <select
                    value={movementForm.type}
                    onChange={(event) =>
                      setMovementForm((state) => ({ ...state, type: event.target.value as MovementType }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                  >
                    <option value="drop">Drop a bóveda</option>
                    <option value="paid-in">Paid-in</option>
                    <option value="paid-out">Paid-out</option>
                  </select>
                </label>
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
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Realizado por</span>
                  <input
                    type="number"
                    min={1}
                    value={movementForm.performedBy}
                    onChange={(event) => setMovementForm((state) => ({ ...state, performedBy: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                    placeholder="ID cajero"
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
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Motivo</span>
                <textarea
                  value={movementForm.reason}
                  onChange={(event) => setMovementForm((state) => ({ ...state, reason: event.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                  placeholder="Notas internas o número de sobre"
                />
              </label>
              <button
                type="submit"
                disabled={isLoading.movement || !activeShift}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <RefreshCcw className="h-4 w-4" />
                {isLoading.movement ? "Registrando..." : "Registrar movimiento"}
              </button>
            </form>
          </section>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border border-slate-200 bg-white/90 shadow-sm ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900/60">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Historial de Z-report</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Guarda cada cierre con el conteo del cajón y resalta variaciones que requieran auditoría.
              </p>
            </div>
          </div>
        </header>

        {reports.length === 0 ? (
          <p className="px-6 py-10 text-sm text-slate-500 dark:text-slate-400">
            Aún no hay Z-reports registrados. Cierra un turno para generar el primer registro.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
            {reports.map((report) => {
              const flagged = Math.abs(report.overShortCents) >= OVER_SHORT_THRESHOLD_CENTS;
              return (
                <li
                  key={`${report.shift.id}-${report.computedAt}`}
                  className="grid gap-4 px-6 py-5 md:grid-cols-[1.2fr,1fr] md:items-start"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Shift #{report.shift.id} · {formatDate(report.shift.closedAt)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Calculado {formatDate(report.computedAt)} · Supervisor {numberFormatter.format(report.shift.closedBy)}
                        </p>
                      </div>
                      {flagged ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                          <AlertTriangle className="h-3.5 w-3.5" /> Revisión requerida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                          <ShieldCheck className="h-3.5 w-3.5" /> Balanceado
                        </span>
                      )}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-4">
                      <div>
                        <dt className="uppercase tracking-wide text-[10px] text-slate-400">Apertura</dt>
                        <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {centsToCurrency(report.openingCashCents)}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide text-[10px] text-slate-400">Cierre contado</dt>
                        <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {centsToCurrency(report.closingCashCents)}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide text-[10px] text-slate-400">Esperado</dt>
                        <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {centsToCurrency(report.expectedCashCents)}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wide text-[10px] text-slate-400">Over/Short</dt>
                        <dd
                          className={`text-sm font-semibold ${
                            report.overShortCents === 0
                              ? "text-slate-600 dark:text-slate-300"
                              : report.overShortCents > 0
                              ? "text-emerald-600 dark:text-emerald-300"
                              : "text-rose-600 dark:text-rose-300"
                          }`}
                        >
                          {centsToCurrency(report.overShortCents)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        Pagos
                      </p>
                      <ul className="space-y-1">
                        {Object.entries(report.paymentsByMethod).map(([method, breakdown]) => (
                          <li key={method} className="flex justify-between">
                            <span className="capitalize text-slate-500 dark:text-slate-400">{method}</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {centsToCurrency(breakdown.totalCents)} · {numberFormatter.format(breakdown.count)}
                            </span>
                          </li>
                        ))}
                        {Object.keys(report.paymentsByMethod).length === 0 ? (
                          <li className="text-slate-400">Sin pagos registrados</li>
                        ) : null}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        Movimientos de cajón
                      </p>
                      <ul className="space-y-1">
                        {Object.entries(report.cashMovements.totalsByKind).map(([kind, breakdown]) => (
                          <li key={kind} className="flex justify-between">
                            <span className="capitalize text-slate-500 dark:text-slate-400">{kind.replace(/_/g, " ")}</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {centsToCurrency(breakdown.totalCents)} · {numberFormatter.format(breakdown.count)}
                            </span>
                          </li>
                        ))}
                        {Object.keys(report.cashMovements.totalsByKind).length === 0 ? (
                          <li className="text-slate-400">Sin movimientos adicionales</li>
                        ) : null}
                      </ul>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Netos: {centsToCurrency(report.cashMovements.netMovementCents)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
