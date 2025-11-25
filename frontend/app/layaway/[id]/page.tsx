"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, AlertTriangle, Trash2 } from "lucide-react";

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
  const [showPayoffDialog, setShowPayoffDialog] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{ amountCents: number; method: string; note?: string } | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<number | null>(null);
  const [interestModels, setInterestModels] = useState<Array<{ id: number; name: string; periodDays: number }>>([]);
  const [loadingInterestModels, setLoadingInterestModels] = useState(false);
  const [pawnDraft, setPawnDraft] = useState({
    ticketNumber: "",
    interestModelId: "",
    dueDate: formatInputDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)),
    comments: "",
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
    const balanceCents = detail.layaway.balanceCents;

    // Check if payment exceeds balance
    if (amountCents > balanceCents) {
      setStatus({ tone: "error", message: `El monto no puede exceder el saldo pendiente de ${formatCurrency(balanceCents)}` });
      return;
    }

    // Check if payment would pay off the layaway
    if (amountCents >= balanceCents) {
      setPendingPayment({
        amountCents,
        method: paymentDraft.method,
        note: paymentDraft.note?.trim() || undefined,
      });
      setShowPayoffDialog(true);
      return;
    }

    // Regular payment that doesn't pay off the layaway
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

  const handleConfirmPayoff = async () => {
    if (!detail || !pendingPayment) return;

    try {
      setActionKey("pay");
      setShowPayoffDialog(false);
      
      // First, register the payment
      const paymentData = await postAction<LayawayDetail>(`/api/layaways/${layawayId}/pay`, {
        amountCents: pendingPayment.amountCents,
        method: pendingPayment.method,
        note: pendingPayment.note,
      });

      // Then, complete the layaway
      const completedData = await postAction<LayawayDetail>(`/api/layaways/${layawayId}/complete`);
      setDetail(completedData);
      setStatus({ tone: "success", message: "Pago registrado y layaway completado. Inventario aplicado." });
      setPaymentDraft({ amount: "", method: paymentDraft.method, note: "" });
      setPendingPayment(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo procesar el pago y cierre";
      setStatus({ tone: "error", message });
      setShowPayoffDialog(true);
    } finally {
      setActionKey(null);
    }
  };

  const handleCancelPayoff = () => {
    setShowPayoffDialog(false);
    setPendingPayment(null);
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!detail) return;

    const payment = detail.payments.find((p) => p.id === paymentId);
    if (!payment) return;

    const confirmed = window.confirm(
      `¿Está seguro de que desea eliminar este pago de ${payment.amountFormatted}? Esta acción no se puede deshacer.`
    );
    if (!confirmed) {
      return;
    }

    try {
      setActionKey("delete-payment");
      setPaymentToDelete(paymentId);
      const response = await fetch(`${API_BASE_URL}/api/layaways/${layawayId}/payments/${paymentId}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      const data = (await response.json().catch(() => ({}))) as LayawayDetail & { error?: string };

      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo eliminar el pago");
      }

      setDetail(data);
      setStatus({ tone: "success", message: "Pago eliminado correctamente" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar el pago";
      setStatus({ tone: "error", message });
    } finally {
      setActionKey(null);
      setPaymentToDelete(null);
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

  const loadNextTicketNumber = useCallback(async () => {
    if (!detail) return;

    const branchId = detail.layaway.branchId;
    if (!Number.isInteger(branchId) || branchId <= 0) {
      return;
    }

    try {
      const params = new URLSearchParams();
      params.set("branchId", String(branchId));

      const response = await fetch(`${API_BASE_URL}/api/loans/next-ticket?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });

      const data = (await response.json().catch(() => ({}))) as { ticketNumber?: string } & { error?: string };

      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo obtener el número de ticket");
      }

      const generated = data.ticketNumber?.trim();
      if (generated && generated.length > 0) {
        setPawnDraft((draft) => ({ ...draft, ticketNumber: generated }));
      }
    } catch (error) {
      // Silently fail - user can still enter ticket number manually
      console.error("Failed to load next ticket number:", error);
    }
  }, [detail]);

  useEffect(() => {
    if (detail && detail.layaway.status === "active" && detail.layaway.isOverdue) {
      void loadNextTicketNumber();
    }
  }, [detail, loadNextTicketNumber]);

  // Load interest models
  useEffect(() => {
    const loadInterestModels = async () => {
      setLoadingInterestModels(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/interest-models`, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error("No se pudieron cargar los modelos de interés");
        }
        const data = await response.json();
        setInterestModels(data.interestModels ?? []);
      } catch (error) {
        console.error("Failed to load interest models:", error);
      } finally {
        setLoadingInterestModels(false);
      }
    };
    void loadInterestModels();
  }, []);

  // Update due date when interest model changes
  useEffect(() => {
    if (pawnDraft.interestModelId) {
      const modelId = Number(pawnDraft.interestModelId);
      const model = interestModels.find((m) => m.id === modelId);
      if (model && model.periodDays) {
        const newDueDate = new Date();
        newDueDate.setDate(newDueDate.getDate() + model.periodDays);
        setPawnDraft((prev) => ({
          ...prev,
          dueDate: formatInputDate(newDueDate),
        }));
      }
    }
  }, [pawnDraft.interestModelId, interestModels]);

  const handlePawn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!detail) return;

    // Fetch fresh ticket number right before submission to handle concurrent loan creation
    await loadNextTicketNumber();

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
        ticketNumber: pawnDraft.ticketNumber.trim(),
        interestModelId,
        dueDate: pawnDraft.dueDate,
        comments: pawnDraft.comments?.trim() || undefined,
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
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {detail.payments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
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
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeletePayment(payment.id)}
                                disabled={
                                  detail.layaway.status !== "active" ||
                                  actionKey === "delete-payment" ||
                                  paymentToDelete === payment.id
                                }
                                className="rounded-lg p-2 text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-300"
                                title="Eliminar pago"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
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
                    max={detail.layaway.balanceCents / 100}
                    step={0.01}
                    disabled={detail.layaway.status !== "active"}
                  />
                  {detail.layaway.balanceCents > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      Saldo pendiente: {formatCurrency(detail.layaway.balanceCents)}
                    </p>
                  )}
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
                    className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    placeholder="PAW-0001"
                    disabled={true}
                    readOnly
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Modelo de interés <span className="text-rose-500">*</span>
                  {loadingInterestModels ? (
                    <div className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800">
                      Cargando modelos...
                    </div>
                  ) : (
                    <select
                      value={pawnDraft.interestModelId}
                      onChange={(event) => setPawnDraft((draft) => ({ ...draft, interestModelId: event.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      disabled={!detail.layaway.isOverdue || detail.layaway.status !== "active"}
                      required
                    >
                      <option value="">Seleccionar modelo...</option>
                      {interestModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} ({model.periodDays} días)
                        </option>
                      ))}
                    </select>
                  )}
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vence el préstamo
                  <input
                    type="date"
                    value={pawnDraft.dueDate}
                    onChange={(event) => setPawnDraft((draft) => ({ ...draft, dueDate: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    disabled={true}
                    readOnly
                  />
                  {pawnDraft.interestModelId && (
                    <p className="mt-1 text-xs text-slate-500">
                      Calculado automáticamente según el modelo de interés seleccionado
                    </p>
                  )}
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

          {/* Payoff Confirmation Dialog */}
          {showPayoffDialog && pendingPayment && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
              onClick={handleCancelPayoff}
            >
              <div
                className="w-full max-w-md space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-500/20">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Confirmar pago completo</h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Este pago completará el saldo pendiente del layaway.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelPayoff}
                    className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  <p className="font-medium">El layaway será pagado y cerrado automáticamente.</p>
                  <p className="mt-1">El inventario será dado de baja y los artículos estarán disponibles para entrega.</p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Monto del pago:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(pendingPayment.amountCents)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Saldo pendiente:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(detail.layaway.balanceCents)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
                    <span className="font-medium text-slate-900 dark:text-white">Saldo después del pago:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(Math.max(0, detail.layaway.balanceCents - pendingPayment.amountCents))}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCancelPayoff}
                    disabled={actionKey === "pay"}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPayoff}
                    disabled={actionKey === "pay"}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionKey === "pay" ? "Procesando…" : "Confirmar y cerrar"}
                  </button>
                </div>
              </div>
            </div>
          )}
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
