"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, ShieldAlert, Sparkles, Store } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const pesoFormatter = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
});

type LoanCollateral = {
  id: number;
  description: string;
  estimatedValueCents: number | null;
  photoPath: string | null;
};

type LoanHeader = {
  id: number;
  branchId: number;
  ticketNumber: string;
  status: "active" | "renewed" | "redeemed" | "forfeited";
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
  forfeiture: LoanForfeiture;
};

type ApiError = Error & { status?: number };

type ForfeitResponse = LoanDetailResponse & {
  forfeiture: NonNullable<LoanForfeiture>;
};

function parseCurrencyToCents(raw: string) {
  const normalized = raw.replace(/\s+/g, "").replace(/,/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}

function buildSuggestedCode(ticketNumber: string, collateralId: number) {
  return `PF-${ticketNumber}-${collateralId}`.toUpperCase().replace(/[^A-Z0-9-]+/g, "-");
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

type LoansForfeitPageProps = {
  params: { id: string };
};

export default function LoanForfeitPage({ params }: LoansForfeitPageProps) {
  const loanId = params.id;
  const [detail, setDetail] = useState<LoanDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCollateralId, setSelectedCollateralId] = useState<number | null>(null);
  const [branchId, setBranchId] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [costInput, setCostInput] = useState("0");
  const [codeInput, setCodeInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [skuInput, setSkuInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getJson<LoanDetailResponse>(`/api/loans/${loanId}`);
        setDetail(data);
        setBranchId(String(data.loan.branchId));
      } catch (err) {
        const apiError = err as ApiError;
        setError(apiError.message ?? "No se pudo cargar el préstamo");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [loanId]);

  useEffect(() => {
    if (!detail) return;
    if (!selectedCollateralId && detail.collateral.length > 0) {
      setSelectedCollateralId(detail.collateral[0].id);
    }
  }, [detail, selectedCollateralId]);

  useEffect(() => {
    if (!detail || selectedCollateralId == null) return;
    const collateral = detail.collateral.find((item) => item.id === selectedCollateralId);
    if (!collateral) return;

    setNameInput(collateral.description.slice(0, 200));
    setCodeInput(buildSuggestedCode(detail.loan.ticketNumber, collateral.id));
    if (!priceInput && collateral.estimatedValueCents != null) {
      setPriceInput((collateral.estimatedValueCents / 100).toFixed(2));
    }
  }, [detail, selectedCollateralId]);

  const disableActions = detail?.loan.status === "redeemed" || detail?.loan.status === "forfeited";

  const selectedCollateral = useMemo(() => {
    if (!detail) return null;
    return detail.collateral.find((item) => item.id === selectedCollateralId) ?? null;
  }, [detail, selectedCollateralId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    if (!detail) {
      return;
    }

    if (disableActions) {
      setSubmitError("El préstamo ya fue cerrado, no se puede forfeit");
      return;
    }

    if (!selectedCollateral) {
      setSubmitError("Selecciona un colateral a convertir");
      return;
    }

    const priceCents = parseCurrencyToCents(priceInput);
    if (priceCents == null || priceCents <= 0) {
      setSubmitError("Define el precio de venta en RD$");
      return;
    }

    const costCents = parseCurrencyToCents(costInput ?? "0");
    const finalBranchId = Number(branchId);

    if (!Number.isInteger(finalBranchId) || finalBranchId <= 0) {
      setSubmitError("Ingresa un ID de sucursal válido");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        collateralId: selectedCollateral.id,
        branchId: finalBranchId,
        priceCents,
        costCents: costCents ?? undefined,
        code: codeInput || undefined,
        name: nameInput || undefined,
        sku: skuInput || undefined,
      };

      const response = await postJson<ForfeitResponse>(`/api/loans/${loanId}/forfeit`, payload);
      setDetail(response);
      setSuccessMessage(
        `Forfeit creado: código ${response.forfeiture.productCode ?? response.forfeiture.productName ?? ""}`
      );
    } catch (err) {
      const apiError = err as ApiError;
      setSubmitError(apiError.message ?? "No se pudo completar el forfeit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/loans/${loanId}`}
        className="inline-flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al detalle del préstamo
      </Link>

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
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">Forfeit de ticket {detail.loan.ticketNumber}</h1>
                <p className="text-sm text-slate-500">
                  Convierte el colateral en un código de inventario listo para venderse.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                <p>Sucursal del préstamo</p>
                <p className="font-semibold text-slate-900">#{detail.loan.branchId}</p>
              </div>
            </div>

            {detail.forfeiture ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <CheckCircle2 className="mr-2 inline h-4 w-4" />
                Ticket ya convertido en {detail.forfeiture.productCode ?? detail.forfeiture.productName}
              </div>
            ) : null}
          </section>

          {successMessage ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}
          {submitError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,3fr)]">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <ShieldAlert className="h-5 w-5 text-slate-500" /> Selecciona colateral
              </h2>
              {detail.collateral.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">Este préstamo no tiene colateral registrado.</p>
              ) : (
                <ul className="mt-4 space-y-3 text-sm">
                  {detail.collateral.map((item) => {
                    const isSelected = selectedCollateralId === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedCollateralId(item.id)}
                          className={
                            "w-full rounded-lg border px-4 py-3 text-left transition " +
                            (isSelected
                              ? "border-sky-400 bg-sky-50 text-sky-900"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-200")
                          }
                          disabled={disableActions}
                        >
                          <p className="font-semibold">{item.description}</p>
                          <p className="text-xs text-slate-500">
                            Valor estimado: {pesoFormatter.format((item.estimatedValueCents ?? 0) / 100)}
                          </p>
                          {item.photoPath ? (
                            <p className="mt-1 text-xs text-slate-400">Foto: {item.photoPath}</p>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Sparkles className="h-5 w-5 text-slate-500" /> Configura el producto
              </h2>
              <form onSubmit={handleSubmit} className="mt-4 grid gap-4 text-sm">
                <label className="font-medium text-slate-700">
                  ID de sucursal destino
                  <input
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                    disabled={disableActions}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="font-medium text-slate-700">
                    Precio de venta RD$
                    <input
                      value={priceInput}
                      onChange={(event) => setPriceInput(event.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      placeholder="0.00"
                      disabled={disableActions}
                    />
                  </label>
                  <label className="font-medium text-slate-700">
                    Costo RD$ (opcional)
                    <input
                      value={costInput}
                      onChange={(event) => setCostInput(event.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      placeholder="0.00"
                      disabled={disableActions}
                    />
                  </label>
                </div>
                <label className="font-medium text-slate-700">
                  Nombre para inventario
                  <input
                    value={nameInput}
                    onChange={(event) => setNameInput(event.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                    disabled={disableActions}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="font-medium text-slate-700">
                    Código sugerido
                    <input
                      value={codeInput}
                      onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 uppercase"
                      disabled={disableActions}
                    />
                  </label>
                  <label className="font-medium text-slate-700">
                    SKU (opcional)
                    <input
                      value={skuInput}
                      onChange={(event) => setSkuInput(event.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      disabled={disableActions}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={disableActions || busy}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Generar código y forfeit
                </button>
                <p className="text-xs text-slate-500">
                  Se crea el código en inventario, la versión para la sucursal y un asiento en el stock ledger.
                </p>
              </form>

              {detail.forfeiture ? (
                <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">Último forfeit</p>
                  <p>Código: {detail.forfeiture.productCode ?? "(sin código)"}</p>
                  <p>Nombre: {detail.forfeiture.productName ?? "(sin nombre)"}</p>
                  <p className="text-xs text-slate-500">ID producto: {detail.forfeiture.productCodeId}</p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Store className="h-5 w-5 text-slate-500" /> Resultado esperado
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              • Se crea un registro en <strong>product_codes</strong> con el código indicado.<br />
              • Se agrega una versión para la sucursal seleccionada con existencia inicial de 1 unidad.<br />
              • Se registra un movimiento en <strong>stock_ledger</strong> con razón <code>pawn_forfeit_in</code>.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              El préstamo cambia a estado <strong>forfeited</strong> y ya no podrá recibir pagos o extensiones.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
