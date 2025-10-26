"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const pesoFormatter = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatCurrency(cents: number) {
  return pesoFormatter.format((Number(cents) || 0) / 100);
}

type LayawayDetail = {
  layaway: {
    id: number;
    branchId: number;
    branchName: string | null;
    customerId: number;
    customerName: string | null;
    orderId: number;
    status: string;
    totalCents: number;
    paidCents: number;
    balanceCents: number;
    totalFormatted: string;
    paidFormatted: string;
    balanceFormatted: string;
    dueDate: string | null;
    pawnLoanId: number | null;
    pawnedAt: string | null;
    overdueDays: number;
    isOverdue: boolean;
    createdAt: string | null;
    updatedAt: string | null;
  };
  order: {
    id: number;
    orderNumber: string;
    totalCents: number;
    status: string;
    createdAt: string | null;
  } | null;
  items: {
    id: number;
    productCodeVersionId: number;
    productName: string | null;
    productCode: string | null;
    qty: number;
    totalCents: number;
    totalFormatted: string;
    unitPriceFormatted: string;
  }[];
  payments: {
    id: number;
    amountCents: number;
    amountFormatted: string;
    method: string;
    note: string | null;
    createdAt: string | null;
  }[];
};

type StatusMessage = { tone: "success" | "error"; message: string } | null;

async function fetchLayaway(id: number) {
  const response = await fetch(`${API_BASE_URL}/api/layaways/${id}`);
  const data = (await response.json().catch(() => ({}))) as LayawayDetail & { error?: string };

  if (!response.ok) {
    throw new Error(data?.error ?? "No se pudo cargar el layaway");
  }

  return data;
}

async function postAction<T>(path: string, payload?: Record<string, unknown>) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data?.error ?? "Acción no disponible");
  }

  return data;
}

const paymentMethods = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
];

export default function LayawayDetailPage({ params }: { params: { id: string } }) {
  const layawayId = Number(params.id);
  const router = useRouter();
  const [detail, setDetail] = useState<LayawayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [paymentDraft, setPaymentDraft] = useState({ amount: "", method: "cash", note: "" });
  const [pawnDraft, setPawnDraft] = useState({
    ticketNumber: "",
    interestModelId: "",
    dueDate: formatInputDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)),
    comments: "",
    collateralDescription: "",
  });

  useEffect(() => {
    if (!Number.isInteger(layawayId) || layawayId <= 0) {
      setStatus({ tone: "error", message: "Identificador no válido" });
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchLayaway(layawayId);
        setDetail(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo cargar el layaway";
        setStatus({ tone: "error", message });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [layawayId]);

  const summary = useMemo(() => {
    if (!detail) return null;

    const overdueLabel = detail.layaway.isOverdue
      ? `${detail.layaway.overdueDays} días de atraso`
      : "Al día";

    return {
      customer: detail.layaway.customerName ?? "Cliente sin asignar",
      branch: detail.layaway.branchName ? `${detail.layaway.branchName} · ID ${detail.layaway.branchId}` : `Sucursal ${detail.layaway.branchId}`,
      order: detail.order?.orderNumber ?? `Orden #${detail.layaway.orderId}`,
      total: detail.layaway.totalFormatted,
      paid: detail.layaway.paidFormatted,
      balance: detail.layaway.balanceFormatted,
      dueDate: detail.layaway.dueDate ? dateFormatter.format(new Date(detail.layaway.dueDate)) : "Sin definir",
      overdueLabel,
    };
  }, [detail]);

  const handlePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!detail) return;

    const amount = Number(paymentDraft.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus({ tone: "error", message: "Ingrese un monto válido" });
      return;
    }

    const amountCents = Math.round(amount * 100);

    try {
      setActionKey("pay");
      const data = await postAction<LayawayDetail>(`/api/layaways/${layawayId}/pay`, {
        amountCents,
        method: paymentDraft.method,
        note: paymentDraft.note?.trim() || undefined,
      });
      setDetail(data);
      setStatus({ tone: "success", message: "Pago registrado correctamente" });
      setPaymentDraft({ amount: "", method: paymentDraft.method, note: "" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar el pago";
      setStatus({ tone: "error", message });
    } finally {
      setActionKey(null);
    }
  };

  const handleCancel = async () => {
    if (!detail) return;

    const confirmed = window.confirm("¿Desea cancelar este layaway y liberar el inventario?");
    if (!confirmed) {
      return;
    }

    try {
      setActionKey("cancel");
      const data = await postAction<LayawayDetail>(`/api/layaways/${layawayId}/cancel`);
      setDetail(data);
      setStatus({ tone: "success", message: "Layaway cancelado y stock liberado" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cancelar el layaway";
      setStatus({ tone: "error", message });
    } finally {
      setActionKey(null);
    }
  };

  const handleComplete = async () => {
    if (!detail) return;

    const confirmed = window.confirm("¿Confirmar entrega del layaway? El inventario se dará de baja.");
    if (!confirmed) {
      return;
    }

    try {
      setActionKey("complete");
      const data = await postAction<LayawayDetail>(`/api/layaways/${layawayId}/complete`);
      setDetail(data);
      setStatus({ tone: "success", message: "Layaway completado y stock aplicado" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo completar el layaway";
      setStatus({ tone: "error", message });
    } finally {
      setActionKey(null);
    }
  };

  const handlePawn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!detail) return;

    const interestModelId = Number(pawnDraft.interestModelId);

    if (!pawnDraft.ticketNumber.trim() || !Number.isInteger(interestModelId) || interestModelId <= 0) {
      setStatus({ tone: "error", message: "Ingrese ticket y modelo de interés válidos" });
      return;
    }

    if (!pawnDraft.dueDate) {
      setStatus({ tone: "error", message: "Seleccione una fecha de vencimiento para el préstamo" });
      return;
    }

    try {
      setActionKey("pawn");
      const payload = {
        ticketNumber: pawnDraft.ticketNumber,
        interestModelId,
        dueDate: pawnDraft.dueDate,
        comments: pawnDraft.comments?.trim() || undefined,
        collateralDescription: pawnDraft.collateralDescription?.trim() || undefined,
      };
      const data = await postAction<LayawayDetail>(`/api/layaways/${layawayId}/pawn`, payload);
      setDetail(data);
      setStatus({ tone: "success", message: "Layaway convertido a préstamo empeño" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo convertir a empeño";
      setStatus({ tone: "error", message });
    } finally {
      setActionKey(null);
    }
  };

  if (!Number.isFinite(layawayId)) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Identificador de layaway inválido.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-6 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
      >
        ← Volver
      </button>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Cargando información del layaway…
        </div>
      ) : detail ? (
        <div className="space-y-8">
          <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Layaway #{detail.layaway.id}</p>
                <h1 className="text-2xl font-semibold text-slate-900">{summary?.customer}</h1>
                <p className="text-sm text-slate-600">{summary?.branch}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                  {summary?.order}
                </div>
                <div
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    detail.layaway.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : detail.layaway.status === "cancelled"
                      ? "bg-rose-50 text-rose-700"
                      : detail.layaway.status === "pawned"
                      ? "bg-indigo-50 text-indigo-700"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {detail.layaway.status.toUpperCase()}
                </div>
              </div>
            </div>
            <dl className="mt-6 grid gap-4 text-sm text-slate-700 md:grid-cols-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</dt>
                <dd className="text-lg font-semibold text-slate-900">{summary?.total}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pagado</dt>
                <dd className="text-lg font-semibold text-emerald-700">{summary?.paid}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saldo</dt>
                <dd className="text-lg font-semibold text-slate-900">{summary?.balance}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha límite</dt>
                <dd className="text-lg font-semibold text-slate-900">{summary?.dueDate}</dd>
                <p className="text-xs text-slate-500">{summary?.overdueLabel}</p>
              </div>
            </dl>
          </header>

          {status && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                status.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {status.message}
            </div>
          )}

          <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Artículos reservados</h2>
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Artículo</th>
                        <th className="px-4 py-3">Cant.</th>
                        <th className="px-4 py-3">Precio</th>
                        <th className="px-4 py-3">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {detail.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{item.productName ?? `Código ${item.productCodeVersionId}`}</div>
                            <div className="text-xs text-slate-500">
                              {item.productCode ? `SKU ${item.productCode}` : `Versión ${item.productCodeVersionId}`}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{item.qty}</td>
                          <td className="px-4 py-3 text-slate-700">{item.unitPriceFormatted}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{item.totalFormatted}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Historial de pagos</h2>
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Método</th>
                        <th className="px-4 py-3">Monto</th>
                        <th className="px-4 py-3">Nota</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {detail.payments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                            No se han registrado pagos todavía.
                          </td>
                        </tr>
                      ) : (
                        detail.payments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="px-4 py-3 text-slate-700">
                              {payment.createdAt ? dateTimeFormatter.format(new Date(payment.createdAt)) : "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{payment.method.toUpperCase()}</td>
                            <td className="px-4 py-3 font-medium text-emerald-700">{payment.amountFormatted}</td>
                            <td className="px-4 py-3 text-slate-600">{payment.note ?? "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <aside className="space-y-6">
              <form onSubmit={handlePayment} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Registrar pago</h2>
                  <p className="text-sm text-slate-600">Actualice el saldo cuando el cliente abone una cuota.</p>
                </div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Monto (RD$)
                  <input
                    value={paymentDraft.amount}
                    onChange={(event) => setPaymentDraft((draft) => ({ ...draft, amount: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    type="number"
                    min={0.01}
                    step={0.01}
                    disabled={detail.layaway.status !== "active"}
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Método
                  <select
                    value={paymentDraft.method}
                    onChange={(event) => setPaymentDraft((draft) => ({ ...draft, method: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    disabled={detail.layaway.status !== "active"}
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nota opcional
                  <input
                    value={paymentDraft.note}
                    onChange={(event) => setPaymentDraft((draft) => ({ ...draft, note: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="Número de recibo, referencia, etc."
                    disabled={detail.layaway.status !== "active"}
                  />
                </label>
                <button
                  type="submit"
                  disabled={detail.layaway.status !== "active" || actionKey === "pay"}
                  className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {actionKey === "pay" ? "Registrando…" : "Agregar pago"}
                </button>
              </form>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Acciones rápidas</h2>
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={
                    detail.layaway.status !== "active" || detail.layaway.balanceCents > 0 || actionKey === "complete"
                  }
                  className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {actionKey === "complete" ? "Procesando…" : "Entregar y cerrar"}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={detail.layaway.status !== "active" || actionKey === "cancel"}
                  className="w-full rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:cursor-not-allowed disabled:border-rose-100 disabled:bg-rose-50"
                >
                  {actionKey === "cancel" ? "Cancelando…" : "Cancelar layaway"}
                </button>
                {detail.layaway.status === "pawned" && detail.layaway.pawnLoanId && (
                  <p className="text-xs text-slate-600">
                    Convertido a préstamo #{detail.layaway.pawnLoanId}. Revise el módulo de préstamos para continuar el seguimiento.
                  </p>
                )}
              </div>

              <form onSubmit={handlePawn} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Convertir en empeño</h2>
                  <p className="text-sm text-slate-600">
                    Disponible para planes vencidos con saldo pendiente. Genera un nuevo préstamo y libera el inventario.
                  </p>
                </div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ticket de préstamo
                  <input
                    value={pawnDraft.ticketNumber}
                    onChange={(event) => setPawnDraft((draft) => ({ ...draft, ticketNumber: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="PAW-0001"
                    disabled={!detail.layaway.isOverdue || detail.layaway.status !== "active"}
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Modelo de interés (ID)
                  <input
                    value={pawnDraft.interestModelId}
                    onChange={(event) => setPawnDraft((draft) => ({ ...draft, interestModelId: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="2"
                    disabled={!detail.layaway.isOverdue || detail.layaway.status !== "active"}
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vence el préstamo
                  <input
                    type="date"
                    value={pawnDraft.dueDate}
                    onChange={(event) => setPawnDraft((draft) => ({ ...draft, dueDate: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    disabled={!detail.layaway.isOverdue || detail.layaway.status !== "active"}
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Descripción de colateral
                  <input
                    value={pawnDraft.collateralDescription}
                    onChange={(event) => setPawnDraft((draft) => ({ ...draft, collateralDescription: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="Equipo devuelto en tienda"
                    disabled={!detail.layaway.isOverdue || detail.layaway.status !== "active"}
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Comentarios internos
                  <textarea
                    value={pawnDraft.comments}
                    onChange={(event) => setPawnDraft((draft) => ({ ...draft, comments: event.target.value }))}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="Cliente solicita extender plazo vía empeño"
                    disabled={!detail.layaway.isOverdue || detail.layaway.status !== "active"}
                  />
                </label>
                <button
                  type="submit"
                  disabled={!detail.layaway.isOverdue || detail.layaway.status !== "active" || actionKey === "pawn"}
                  className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:bg-amber-300"
                >
                  {actionKey === "pawn" ? "Generando…" : "Convertir a empeño"}
                </button>
              </form>
            </aside>
          </section>
        </div>
      ) : (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          No se encontró el layaway solicitado.
        </div>
      )}
    </main>
  );
}

function formatInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
