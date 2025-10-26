"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  History,
  Loader2,
  PiggyBank,
  RefreshCcw,
  ShieldAlert,
  Wallet,
} from "lucide-react";

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

type LoanCustomer = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
};

type LoanHeader = {
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
  customer: LoanCustomer;
};

type LoanCollateral = {
  id: number;
  description: string;
  estimatedValueCents: number | null;
  photoPath: string | null;
};

type LoanScheduleEntry = {
  id: number;
  dueOn: string | null;
  interestCents: number;
  feeCents: number;
  createdAt: string | null;
};

type LoanPayment = {
  id: number;
  kind: "interest" | "advance" | "redeem" | "renew" | "extension" | "rewrite";
  amountCents: number;
  method: "cash" | "card" | "transfer";
  createdAt: string | null;
};

type LoanBalance = {
  principalCents: number;
  interestAccruedCents: number;
  feeAccruedCents: number;
  interestPaidCents: number;
  principalPaidCents: number;
  totalPaidCents: number;
  outstandingPrincipalCents: number;
  outstandingInterestCents: number;
  totalDueCents: number;
};

type LoanAlert = {
  type: "success" | "info" | "warning" | "danger";
  message: string;
  interestDueCents?: number;
};

type LoanForfeiture = {
  id: number;
  productCodeId: number;
  productCode: string | null;
  productName: string | null;
  createdAt: string | null;
} | null;

type LoanDetailResponse = {
  loan: LoanHeader;
  collateral: LoanCollateral[];
  schedule: LoanScheduleEntry[];
  history: LoanPayment[];
  balance: LoanBalance;
  alerts: LoanAlert[];
  forfeiture: LoanForfeiture;
};

type ApiError = Error & { status?: number };

type Role = "seller" | "cashier" | "manager" | "admin";

const roleLabels: Record<Role, string> = {
  seller: "Vendedor (solo vista)",
  cashier: "Cajero",
  manager: "Gerente",
  admin: "Administrador",
};

function classNames(...values: Array<string | null | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function parseCurrencyToCents(raw: string) {
  const normalized = raw.replace(/\s+/g, "").replace(/,/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}

function addDays(base: string, days: number) {
  const dt = new Date(base);
  if (Number.isNaN(dt.getTime())) {
    return base;
  }

  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

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

function formatDate(value: string | null) {
  if (!value) {
    return "N/D";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return dateFormatter.format(parsed);
}

function getStatusBadge(status: LoanHeader["status"]) {
  switch (status) {
    case "redeemed":
      return { label: "Redimido", tone: "bg-emerald-100 text-emerald-700" };
    case "forfeited":
      return { label: "Abandonado", tone: "bg-amber-100 text-amber-700" };
    case "renewed":
      return { label: "Renovado", tone: "bg-blue-100 text-blue-700" };
    default:
      return { label: "Activo", tone: "bg-sky-100 text-sky-700" };
  }
}

function getAlertTone(alert: LoanAlert) {
  switch (alert.type) {
    case "success":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "danger":
      return "bg-red-50 text-red-700 border-red-200";
    case "warning":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
}

type LoansIdPageProps = {
  params: { id: string };
};

export default function LoanDetailPage({ params }: LoansIdPageProps) {
  const loanId = params.id;
  const [role, setRole] = useState<Role>("cashier");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<LoanDetailResponse | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [paymentKind, setPaymentKind] = useState<LoanPayment["kind"]>("interest");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<LoanPayment["method"]>("cash");
  const [paymentBusy, setPaymentBusy] = useState(false);

  const [renewTermCount, setRenewTermCount] = useState(1);
  const [renewPeriodDays, setRenewPeriodDays] = useState(30);
  const [renewInterestAmount, setRenewInterestAmount] = useState("");
  const [renewFeeAmount, setRenewFeeAmount] = useState("0");
  const [renewMethod, setRenewMethod] = useState<LoanPayment["method"]>("cash");
  const [renewBusy, setRenewBusy] = useState(false);
  const [renewInterestPayment, setRenewInterestPayment] = useState("0");

  const [redeemAmount, setRedeemAmount] = useState("");
  const [redeemMethod, setRedeemMethod] = useState<LoanPayment["method"]>("cash");
  const [redeemBusy, setRedeemBusy] = useState(false);

  const [extensionDays, setExtensionDays] = useState(15);
  const [extensionInterest, setExtensionInterest] = useState("");
  const [extensionFee, setExtensionFee] = useState("0");
  const [extensionMethod, setExtensionMethod] = useState<LoanPayment["method"]>("cash");
  const [extensionBusy, setExtensionBusy] = useState(false);

  const [rewritePrincipal, setRewritePrincipal] = useState("");
  const [rewriteRatePercent, setRewriteRatePercent] = useState("10");
  const [rewriteTermCount, setRewriteTermCount] = useState(1);
  const [rewritePeriodDays, setRewritePeriodDays] = useState(30);
  const [rewriteFee, setRewriteFee] = useState("0");
  const [rewriteMethod, setRewriteMethod] = useState<LoanPayment["method"]>("cash");
  const [rewriteBusy, setRewriteBusy] = useState(false);
  const [rewritePayment, setRewritePayment] = useState("0");

  const canTransact = role !== "seller";

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getJson<LoanDetailResponse>(`/api/loans/${loanId}`);
        setDetail(data);
      } catch (err) {
        const apiError = err as ApiError;
        setError(apiError.message ?? "No se pudo cargar el préstamo");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [loanId]);

  const outstandingAmount = useMemo(() => {
    if (!detail) return 0;
    return detail.balance.outstandingPrincipalCents + detail.balance.outstandingInterestCents;
  }, [detail]);

  const nextDueDate = useMemo(() => {
    if (!detail?.schedule?.length) {
      return detail?.loan.dueDate ?? null;
    }

    const upcoming = [...detail.schedule]
      .map((entry) => entry.dueOn)
      .filter((value): value is string => Boolean(value))
      .sort();

    return upcoming[0] ?? detail.loan.dueDate ?? null;
  }, [detail]);

  async function refreshDetail(message?: string) {
    try {
      const data = await getJson<LoanDetailResponse>(`/api/loans/${loanId}`);
      setDetail(data);
      if (message) {
        setActionMessage(message);
      }
    } catch (err) {
      const apiError = err as ApiError;
      setActionError(apiError.message ?? "No se pudo refrescar la información");
    }
  }

  async function handlePaymentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionMessage(null);
    setActionError(null);

    if (!canTransact) {
      setActionError("El rol actual no tiene permisos para registrar pagos");
      return;
    }

    const cents = parseCurrencyToCents(paymentAmount);
    if (cents == null || cents <= 0) {
      setActionError("Ingresa un monto válido en RD$");
      return;
    }

    setPaymentBusy(true);
    try {
      await postJson(`/api/loans/${loanId}/pay`, {
        kind: paymentKind,
        amountCents: cents,
        method: paymentMethod,
      });
      setPaymentAmount("");
      await refreshDetail("Pago registrado correctamente");
    } catch (err) {
      const apiError = err as ApiError;
      setActionError(apiError.message ?? "No se pudo registrar el pago");
    } finally {
      setPaymentBusy(false);
    }
  }

  async function handleRenewSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionMessage(null);
    setActionError(null);

    if (!canTransact) {
      setActionError("El rol actual no puede renovar préstamos");
      return;
    }

    const interestCents = parseCurrencyToCents(renewInterestAmount ?? "");
    const feeCents = parseCurrencyToCents(renewFeeAmount ?? "0") ?? 0;

    if (interestCents == null || interestCents <= 0) {
      setActionError("Define el interés por periodo para generar la renovación");
      return;
    }

    const schedule: Array<{ dueOn: string; interestCents: number; feeCents: number }> = [];
    const startDate = detail?.loan.dueDate ?? todayIso();
    for (let index = 1; index <= Math.max(1, renewTermCount); index += 1) {
      const dueOn = addDays(startDate, renewPeriodDays * index);
      schedule.push({ dueOn, interestCents, feeCents });
    }

    const renewalPayment = parseCurrencyToCents(renewInterestPayment ?? "0");

    setRenewBusy(true);
    try {
      await postJson(`/api/loans/${loanId}/renew`, {
        schedule,
        method: renewMethod,
        amountCents: renewalPayment && renewalPayment > 0 ? renewalPayment : undefined,
      });
      await refreshDetail("Renovación aplicada");
    } catch (err) {
      const apiError = err as ApiError;
      setActionError(apiError.message ?? "No se pudo renovar el préstamo");
    } finally {
      setRenewBusy(false);
    }
  }

  async function handleRedeemSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionMessage(null);
    setActionError(null);

    if (!canTransact) {
      setActionError("El rol actual no puede redimir préstamos");
      return;
    }

    const cents = parseCurrencyToCents(redeemAmount);
    if (cents == null || cents <= 0) {
      setActionError("Ingresa el monto total para redimir");
      return;
    }

    setRedeemBusy(true);
    try {
      await postJson(`/api/loans/${loanId}/redeem`, {
        amountCents: cents,
        method: redeemMethod,
      });
      setRedeemAmount("");
      await refreshDetail("Préstamo marcado como redimido");
    } catch (err) {
      const apiError = err as ApiError;
      setActionError(apiError.message ?? "No se pudo redimir el préstamo");
    } finally {
      setRedeemBusy(false);
    }
  }

  async function handleExtensionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionMessage(null);
    setActionError(null);

    if (!canTransact) {
      setActionError("El rol actual no puede extender préstamos");
      return;
    }

    const interestCents = parseCurrencyToCents(extensionInterest ?? "0");
    const feeCents = parseCurrencyToCents(extensionFee ?? "0") ?? 0;
    const currentDueDate = detail?.loan.dueDate ?? todayIso();
    const dueOn = addDays(currentDueDate, Math.max(1, extensionDays));

    const schedule = interestCents && interestCents > 0 ? [{ dueOn, interestCents, feeCents }] : [];
    const extensionPayment = interestCents && interestCents > 0 ? interestCents + feeCents : undefined;

    setExtensionBusy(true);
    try {
      await postJson(`/api/loans/${loanId}/extension`, {
        dueDate: dueOn,
        schedule,
        method: extensionMethod,
        amountCents: extensionPayment,
      });
      await refreshDetail("Extensión aplicada");
    } catch (err) {
      const apiError = err as ApiError;
      setActionError(apiError.message ?? "No se pudo aplicar la extensión");
    } finally {
      setExtensionBusy(false);
    }
  }

  async function handleRewriteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionMessage(null);
    setActionError(null);

    if (!canTransact) {
      setActionError("El rol actual no puede reescribir préstamos");
      return;
    }

    const principalCents = parseCurrencyToCents(rewritePrincipal);
    if (principalCents == null || principalCents <= 0) {
      setActionError("Ingresa el nuevo capital en RD$");
      return;
    }

    const ratePercent = Number(rewriteRatePercent);
    if (!Number.isFinite(ratePercent) || ratePercent <= 0) {
      setActionError("La tasa debe ser mayor que 0");
      return;
    }

    const interestPerPeriod = Math.round((principalCents * ratePercent) / 100);
    const feeCents = parseCurrencyToCents(rewriteFee ?? "0") ?? 0;
    const startDate = detail?.loan.dueDate ?? todayIso();

    const schedule: Array<{ dueOn: string; interestCents: number; feeCents: number }> = [];
    for (let index = 1; index <= Math.max(1, rewriteTermCount); index += 1) {
      const dueOn = addDays(startDate, rewritePeriodDays * index);
      schedule.push({ dueOn, interestCents: interestPerPeriod, feeCents });
    }

    const rewritePaymentCents = parseCurrencyToCents(rewritePayment ?? "0");

    setRewriteBusy(true);
    try {
      await postJson(`/api/loans/${loanId}/rewrite`, {
        principalCents,
        interestRate: ratePercent / 100,
        schedule,
        method: rewriteMethod,
        amountCents: rewritePaymentCents && rewritePaymentCents > 0 ? rewritePaymentCents : undefined,
        feeCents,
      });
      await refreshDetail("Reestructura guardada");
    } catch (err) {
      const apiError = err as ApiError;
      setActionError(apiError.message ?? "No se pudo reescribir el préstamo");
    } finally {
      setRewriteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/loans"
          className="inline-flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a préstamos
        </Link>
        <div className="ml-auto flex items-center gap-2 text-sm text-slate-500">
          <span>Rol activo:</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-sm"
          >
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-12 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando préstamo...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">No se pudo cargar el préstamo</p>
          <p className="text-sm">{error}</p>
        </div>
      ) : detail ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold text-slate-900">
                    Ticket {detail.loan.ticketNumber}
                  </h1>
                  {(() => {
                    const badge = getStatusBadge(detail.loan.status);
                    return (
                      <span className={classNames("rounded-full px-3 py-1 text-xs font-medium", badge.tone)}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Creado el {formatDate(detail.loan.createdAt)} · Última actualización {" "}
                  {formatDate(detail.loan.updatedAt)}
                </p>

                <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <Wallet className="h-5 w-5 text-slate-500" />
                    <div>
                      <p className="text-xs uppercase text-slate-500">Capital original</p>
                      <p className="font-semibold text-slate-900">
                        {pesoFormatter.format(detail.loan.principalCents / 100)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <CalendarClock className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-xs uppercase text-amber-600">Próximo vencimiento</p>
                      <p className="font-semibold text-amber-700">{formatDate(nextDueDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
                    <PiggyBank className="h-5 w-5 text-sky-600" />
                    <div>
                      <p className="text-xs uppercase text-sky-600">Intereses acumulados</p>
                      <p className="font-semibold text-sky-700">
                        {pesoFormatter.format(detail.balance.interestAccruedCents / 100)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <BadgeCheck className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="text-xs uppercase text-emerald-600">Saldo pendiente</p>
                      <p className="font-semibold text-emerald-700">
                        {pesoFormatter.format(outstandingAmount / 100)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full max-w-xs rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase text-slate-500">Cliente</p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {[detail.loan.customer.firstName, detail.loan.customer.lastName]
                    .filter(Boolean)
                    .join(" ") || "Sin nombre"}
                </p>
                <p className="mt-1">Tel: {detail.loan.customer.phone ?? "N/D"}</p>
                <p>Email: {detail.loan.customer.email ?? "N/D"}</p>
                <p className="mt-2 text-xs uppercase text-slate-500">Comentarios</p>
                <p className="mt-1 text-sm">
                  {detail.loan.comments?.trim() ? detail.loan.comments : "Sin notas"}
                </p>
                {detail.forfeiture ? (
                  <p className="mt-3 text-xs text-amber-600">
                    Forfeitado como código {detail.forfeiture.productCode ?? detail.forfeiture.productName}
                  </p>
                ) : null}
              </div>
            </div>

            {detail.alerts.length > 0 ? (
              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {detail.alerts.map((alert, index) => (
                  <div
                    key={`${alert.message}-${index}`}
                    className={classNames(
                      "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                      getAlertTone(alert)
                    )}
                  >
                    {alert.type === "danger" ? (
                      <ShieldAlert className="h-4 w-4" />
                    ) : alert.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <div>
                      <p className="font-medium">{alert.message}</p>
                      {alert.interestDueCents ? (
                        <p>{pesoFormatter.format(alert.interestDueCents / 100)}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {actionMessage ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {actionMessage}
            </div>
          ) : null}
          {actionError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionError}
            </div>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,3fr)]">
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <DollarSign className="h-5 w-5 text-slate-500" /> Registrar pago
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Aplica intereses o abonos a capital. Solo disponible para cajeros, gerentes y administradores.
                </p>
                <form onSubmit={handlePaymentSubmit} className="mt-4 grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm font-medium text-slate-700">
                      Tipo de pago
                      <select
                        value={paymentKind}
                        onChange={(event) =>
                          setPaymentKind(event.target.value as LoanPayment["kind"])
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        disabled={!canTransact}
                      >
                        <option value="interest">Interés</option>
                        <option value="advance">Abono a capital</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Método
                      <select
                        value={paymentMethod}
                        onChange={(event) =>
                          setPaymentMethod(event.target.value as LoanPayment["method"])
                        }
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        disabled={!canTransact}
                      >
                        <option value="cash">Efectivo</option>
                        <option value="card">Tarjeta</option>
                        <option value="transfer">Transferencia</option>
                      </select>
                    </label>
                  </div>
                  <label className="text-sm font-medium text-slate-700">
                    Monto RD$
                    <input
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="0.00"
                      disabled={!canTransact}
                    />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={!canTransact || paymentBusy}
                  >
                    {paymentBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Registrar pago
                  </button>
                </form>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <RefreshCcw className="h-5 w-5 text-slate-500" /> Renovar préstamo
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Genera un nuevo calendario con los periodos deseados. Registra automáticamente el pago de
                  intereses si se indica un monto en "Pago de renovación".
                </p>
                <form onSubmit={handleRenewSubmit} className="mt-4 grid gap-3 text-sm">
                  <div className="grid grid-cols-3 gap-3">
                    <label className="font-medium text-slate-700">
                      Periodos
                      <input
                        type="number"
                        min={1}
                        value={renewTermCount}
                        onChange={(event) => setRenewTermCount(Number(event.target.value) || 1)}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        disabled={!canTransact}
                      />
                    </label>
                    <label className="font-medium text-slate-700">
                      Días por periodo
                      <input
                        type="number"
                        min={1}
                        value={renewPeriodDays}
                        onChange={(event) => setRenewPeriodDays(Number(event.target.value) || 1)}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        disabled={!canTransact}
                      />
                    </label>
                    <label className="font-medium text-slate-700">
                      Interés por periodo (RD$)
                      <input
                        value={renewInterestAmount}
                        onChange={(event) => setRenewInterestAmount(event.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        placeholder="0.00"
                        disabled={!canTransact}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="font-medium text-slate-700">
                      Comisión por periodo (RD$)
                      <input
                        value={renewFeeAmount}
                        onChange={(event) => setRenewFeeAmount(event.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        placeholder="0.00"
                        disabled={!canTransact}
                      />
                    </label>
                    <label className="font-medium text-slate-700">
                      Pago de renovación (RD$)
                      <input
                        value={renewInterestPayment}
                        onChange={(event) => setRenewInterestPayment(event.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        placeholder="0.00"
                        disabled={!canTransact}
                      />
                    </label>
                  </div>
                  <label className="font-medium text-slate-700">
                    Método de cobro
                    <select
                      value={renewMethod}
                      onChange={(event) => setRenewMethod(event.target.value as LoanPayment["method"])}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      disabled={!canTransact}
                    >
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={!canTransact || renewBusy}
                  >
                    {renewBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Aplicar renovación
                  </button>
                </form>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <CheckCircle2 className="h-5 w-5 text-slate-500" /> Redimir ticket
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Marca el préstamo como redimido y registra el pago final.
                </p>
                <form onSubmit={handleRedeemSubmit} className="mt-4 grid gap-3 text-sm">
                  <label className="font-medium text-slate-700">
                    Monto total RD$
                    <input
                      value={redeemAmount}
                      onChange={(event) => setRedeemAmount(event.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      placeholder={pesoFormatter.format(outstandingAmount / 100)}
                      disabled={!canTransact}
                    />
                  </label>
                  <label className="font-medium text-slate-700">
                    Método
                    <select
                      value={redeemMethod}
                      onChange={(event) => setRedeemMethod(event.target.value as LoanPayment["method"])}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      disabled={!canTransact}
                    >
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={!canTransact || redeemBusy}
                  >
                    {redeemBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Marcar como redimido
                  </button>
                </form>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <CalendarClock className="h-5 w-5 text-slate-500" /> Extender vencimiento
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Agrega días adicionales al ticket y registra el cobro correspondiente.
                </p>
                <form onSubmit={handleExtensionSubmit} className="mt-4 grid gap-3 text-sm">
                  <div className="grid grid-cols-3 gap-3">
                    <label className="font-medium text-slate-700">
                      Días adicionales
                      <input
                        type="number"
                        min={1}
                        value={extensionDays}
                        onChange={(event) => setExtensionDays(Number(event.target.value) || 1)}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        disabled={!canTransact}
                      />
                    </label>
                    <label className="font-medium text-slate-700">
                      Interés (RD$)
                      <input
                        value={extensionInterest}
                        onChange={(event) => setExtensionInterest(event.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        placeholder="0.00"
                        disabled={!canTransact}
                      />
                    </label>
                    <label className="font-medium text-slate-700">
                      Comisión (RD$)
                      <input
                        value={extensionFee}
                        onChange={(event) => setExtensionFee(event.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        placeholder="0.00"
                        disabled={!canTransact}
                      />
                    </label>
                  </div>
                  <label className="font-medium text-slate-700">
                    Método
                    <select
                      value={extensionMethod}
                      onChange={(event) => setExtensionMethod(event.target.value as LoanPayment["method"])}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      disabled={!canTransact}
                    >
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={!canTransact || extensionBusy}
                  >
                    {extensionBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Registrar extensión
                  </button>
                </form>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <History className="h-5 w-5 text-slate-500" /> Reescribir ticket
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ajusta el principal y genera un nuevo calendario conservando la trazabilidad del ticket.
                </p>
                <form onSubmit={handleRewriteSubmit} className="mt-4 grid gap-3 text-sm">
                  <label className="font-medium text-slate-700">
                    Nuevo principal RD$
                    <input
                      value={rewritePrincipal}
                      onChange={(event) => setRewritePrincipal(event.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      placeholder={pesoFormatter.format(detail.loan.principalCents / 100)}
                      disabled={!canTransact}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="font-medium text-slate-700">
                      Tasa por periodo (%)
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={rewriteRatePercent}
                        onChange={(event) => setRewriteRatePercent(event.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        disabled={!canTransact}
                      />
                    </label>
                    <label className="font-medium text-slate-700">
                      Comisión (RD$)
                      <input
                        value={rewriteFee}
                        onChange={(event) => setRewriteFee(event.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        placeholder="0.00"
                        disabled={!canTransact}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="font-medium text-slate-700">
                      Periodos
                      <input
                        type="number"
                        min={1}
                        value={rewriteTermCount}
                        onChange={(event) => setRewriteTermCount(Number(event.target.value) || 1)}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        disabled={!canTransact}
                      />
                    </label>
                    <label className="font-medium text-slate-700">
                      Días por periodo
                      <input
                        type="number"
                        min={1}
                        value={rewritePeriodDays}
                        onChange={(event) => setRewritePeriodDays(Number(event.target.value) || 1)}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                        disabled={!canTransact}
                      />
                    </label>
                  </div>
                  <label className="font-medium text-slate-700">
                    Pago registrado (opcional)
                    <input
                      value={rewritePayment}
                      onChange={(event) => setRewritePayment(event.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      placeholder="0.00"
                      disabled={!canTransact}
                    />
                  </label>
                  <label className="font-medium text-slate-700">
                    Método
                    <select
                      value={rewriteMethod}
                      onChange={(event) => setRewriteMethod(event.target.value as LoanPayment["method"])}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      disabled={!canTransact}
                    >
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={!canTransact || rewriteBusy}
                  >
                    {rewriteBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Guardar reestructura
                  </button>
                </form>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <CalendarClock className="h-5 w-5 text-slate-500" /> Calendario
                </h2>
                {detail.schedule.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No hay calendario registrado.</p>
                ) : (
                  <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-2 text-left">Fecha</th>
                          <th className="px-4 py-2 text-right">Interés</th>
                          <th className="px-4 py-2 text-right">Comisión</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.schedule.map((entry) => (
                          <tr key={entry.id}>
                            <td className="px-4 py-2 text-slate-700">{formatDate(entry.dueOn)}</td>
                            <td className="px-4 py-2 text-right text-slate-700">
                              {pesoFormatter.format(entry.interestCents / 100)}
                            </td>
                            <td className="px-4 py-2 text-right text-slate-500">
                              {pesoFormatter.format(entry.feeCents / 100)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <History className="h-5 w-5 text-slate-500" /> Historial
                </h2>
                {detail.history.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No hay movimientos registrados.</p>
                ) : (
                  <ul className="mt-4 space-y-3 text-sm">
                    {detail.history.map((payment) => (
                      <li
                        key={payment.id}
                        className="flex items-start justify-between rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <div>
                          <p className="font-semibold text-slate-800 capitalize">{payment.kind}</p>
                          <p className="text-xs text-slate-500">
                            {formatDate(payment.createdAt)} · {payment.method}
                          </p>
                        </div>
                        <p className="font-semibold text-slate-900">
                          {pesoFormatter.format(payment.amountCents / 100)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <ShieldAlert className="h-5 w-5 text-slate-500" /> Colateral
                </h2>
                {detail.collateral.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">Sin colateral registrado.</p>
                ) : (
                  <ul className="mt-4 space-y-3 text-sm">
                    {detail.collateral.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <p className="font-semibold text-slate-800">{item.description}</p>
                        <p className="text-xs text-slate-500">
                          Valor estimado: {pesoFormatter.format((item.estimatedValueCents ?? 0) / 100)}
                        </p>
                        {item.photoPath ? (
                          <p className="mt-1 text-xs text-slate-400">Foto: {item.photoPath}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href={`/loans/${loanId}/forfeit`}
                  className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <ShieldAlert className="h-4 w-4" /> Procesar abandono / forfeit
                </Link>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
