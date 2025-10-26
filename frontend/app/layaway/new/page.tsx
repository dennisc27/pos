"use client";

import { FormEvent, useMemo, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const pesoFormatter = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium" });

function formatCurrency(cents: number) {
  return pesoFormatter.format((Number(cents) || 0) / 100);
}

function formatInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

type CartItem = {
  id: string;
  productCodeVersionId: number;
  description: string;
  qty: number;
  unitPriceCents: number;
};

type LayawayDetail = {
  layaway: {
    id: number;
    orderId: number;
    status: string;
    totalCents: number;
    paidCents: number;
    balanceCents: number;
    dueDate: string | null;
    branchName: string | null;
    customerName: string | null;
    pawnLoanId: number | null;
  };
  order: {
    id: number;
    orderNumber: string;
    totalCents: number;
  } | null;
  items: {
    id: number;
    productName: string | null;
    productCode: string | null;
    qty: number;
    totalCents: number;
  }[];
  payments: {
    id: number;
    amountCents: number;
    method: string;
    createdAt: string | null;
  }[];
};

type StatusMessage = { tone: "success" | "error"; message: string } | null;

type OrderResponse = {
  id: number;
  orderNumber: string;
  totalCents: number;
};

async function postJson<T>(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    const errorMessage = data?.error ?? "Request failed";
    throw new Error(errorMessage);
  }

  return data;
}

const paymentMethods = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
];

export default function LayawayNewPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [lineDraft, setLineDraft] = useState({
    productCodeVersionId: "",
    description: "",
    qty: "1",
    unitPrice: "",
  });
  const [formDraft, setFormDraft] = useState({
    branchId: "",
    userId: "",
    customerId: "",
    dueDate: formatInputDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)),
    deposit: "0",
    depositMethod: "cash",
    depositNote: "",
    installments: "4",
  });
  const [status, setStatus] = useState<StatusMessage>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<LayawayDetail | null>(null);

  const totals = useMemo(() => {
    const subtotalCents = cartItems.reduce((sum, item) => sum + item.qty * item.unitPriceCents, 0);
    const depositCents = Math.max(0, Math.round(Number(formDraft.deposit || 0) * 100));
    const balanceCents = Math.max(subtotalCents - depositCents, 0);
    const installmentCount = Math.max(1, Number(formDraft.installments) || 1);
    const installmentAmount = Math.ceil(balanceCents / installmentCount);

    return { subtotalCents, depositCents, balanceCents, installmentCount, installmentAmount };
  }, [cartItems, formDraft.deposit, formDraft.installments]);

  const handleAddItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    const versionId = Number(lineDraft.productCodeVersionId);
    const qty = Number(lineDraft.qty);
    const unitPrice = Number(lineDraft.unitPrice);

    if (!Number.isInteger(versionId) || versionId <= 0) {
      setStatus({ tone: "error", message: "Ingrese un ID válido de versión de producto." });
      return;
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      setStatus({ tone: "error", message: "La cantidad debe ser mayor que cero." });
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setStatus({ tone: "error", message: "Ingrese un precio unitario válido." });
      return;
    }

    const unitPriceCents = Math.round(unitPrice * 100);

    setCartItems((items) => [
      ...items,
      {
        id: Math.random().toString(36).slice(2, 9),
        productCodeVersionId: versionId,
        description: lineDraft.description.trim() || `Artículo ${versionId}`,
        qty,
        unitPriceCents,
      },
    ]);

    setLineDraft({ productCodeVersionId: "", description: "", qty: "1", unitPrice: "" });
  };

  const handleRemoveItem = (id: string) => {
    setCartItems((items) => items.filter((item) => item.id !== id));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (cartItems.length === 0) {
      setStatus({ tone: "error", message: "Agregue al menos un artículo al carrito." });
      return;
    }

    const branchId = Number(formDraft.branchId);
    const userId = Number(formDraft.userId);
    const customerId = formDraft.customerId ? Number(formDraft.customerId) : null;

    if (!Number.isInteger(branchId) || branchId <= 0 || !Number.isInteger(userId) || userId <= 0) {
      setStatus({ tone: "error", message: "Sucursal y usuario son obligatorios." });
      return;
    }

    if (!formDraft.dueDate) {
      setStatus({ tone: "error", message: "Seleccione una fecha de vencimiento." });
      return;
    }

    if (totals.depositCents > totals.subtotalCents) {
      setStatus({ tone: "error", message: "El depósito no puede exceder el total del carrito." });
      return;
    }

    const itemsPayload = cartItems.map((item) => ({
      productCodeVersionId: item.productCodeVersionId,
      qty: item.qty,
      unitPriceCents: item.unitPriceCents,
    }));

    setSubmitting(true);

    try {
      const order = await postJson<OrderResponse>("/api/orders", {
        branchId,
        userId,
        customerId,
        items: itemsPayload,
        taxRate: 0,
      });

      const layawayPayload: Record<string, unknown> = {
        orderId: order.id,
        dueDate: formDraft.dueDate,
      };

      if (totals.depositCents > 0) {
        layawayPayload.initialPayment = {
          amountCents: totals.depositCents,
          method: formDraft.depositMethod,
          note: formDraft.depositNote?.trim() || undefined,
        };
      }

      const detail = await postJson<LayawayDetail>("/api/layaways", layawayPayload);

      setResult(detail);
      setStatus({ tone: "success", message: "Plan a plazo creado correctamente." });
      setCartItems([]);
      setLineDraft({ productCodeVersionId: "", description: "", qty: "1", unitPrice: "" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el plan a plazo";
      setStatus({ tone: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Layaway</p>
        <h1 className="text-3xl font-semibold text-slate-900">Crear plan a plazo</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Registre una orden, reserve el inventario y defina los términos del plan de pagos antes de imprimir el acuerdo
          con el cliente.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Carrito de artículos</h2>
                <p className="text-sm text-slate-600">Capture los productos que el cliente apartará.</p>
              </div>
              <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                Total: {formatCurrency(totals.subtotalCents)}
              </div>
            </div>

            <form onSubmit={handleAddItem} className="grid gap-3 rounded-lg border border-dashed border-slate-300 p-4 md:grid-cols-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Código versión
                <input
                  required
                  value={lineDraft.productCodeVersionId}
                  onChange={(event) => setLineDraft((draft) => ({ ...draft, productCodeVersionId: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="123"
                />
              </label>
              <label className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Descripción
                <input
                  value={lineDraft.description}
                  onChange={(event) => setLineDraft((draft) => ({ ...draft, description: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="Anillo 14K · 0.75ct"
                />
              </label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:col-span-1">
                <label className="col-span-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cant.
                  <input
                    value={lineDraft.qty}
                    onChange={(event) => setLineDraft((draft) => ({ ...draft, qty: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    type="number"
                    min={1}
                  />
                </label>
                <label className="col-span-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Precio
                  <input
                    value={lineDraft.unitPrice}
                    onChange={(event) => setLineDraft((draft) => ({ ...draft, unitPrice: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    type="number"
                    min={0.01}
                    step={0.01}
                  />
                </label>
                <button
                  type="submit"
                  className="col-span-2 mt-6 inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
                >
                  Añadir
                </button>
              </div>
            </form>

            <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3">Cant.</th>
                    <th className="px-4 py-3">Precio</th>
                    <th className="px-4 py-3">Subtotal</th>
                    <th className="px-3 py-3 text-right">&nbsp;</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {cartItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                        Aún no hay artículos en el carrito.
                      </td>
                    </tr>
                  ) : (
                    cartItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{item.description}</div>
                          <div className="text-xs text-slate-500">Versión #{item.productCodeVersionId}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.qty}</td>
                        <td className="px-4 py-3 text-slate-700">{formatCurrency(item.unitPriceCents)}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {formatCurrency(item.qty * item.unitPriceCents)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Detalles del plan</h2>
                <p className="text-sm text-slate-600">
                  Asigne sucursal, operador y cliente para reservar el inventario en el sistema.
                </p>
              </div>
              <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                Vence: {formDraft.dueDate ? dateFormatter.format(new Date(formDraft.dueDate)) : "—"}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sucursal (ID)
                <input
                  required
                  value={formDraft.branchId}
                  onChange={(event) => setFormDraft((draft) => ({ ...draft, branchId: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="1"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Operador (ID)
                <input
                  required
                  value={formDraft.userId}
                  onChange={(event) => setFormDraft((draft) => ({ ...draft, userId: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="12"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cliente (ID)
                <input
                  value={formDraft.customerId}
                  onChange={(event) => setFormDraft((draft) => ({ ...draft, customerId: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="86"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Fecha límite
                <input
                  type="date"
                  required
                  value={formDraft.dueDate}
                  onChange={(event) => setFormDraft((draft) => ({ ...draft, dueDate: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Depósito inicial (RD$)
                <input
                  value={formDraft.deposit}
                  onChange={(event) => setFormDraft((draft) => ({ ...draft, deposit: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  type="number"
                  min={0}
                  step={0.01}
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nº cuotas
                <input
                  value={formDraft.installments}
                  onChange={(event) => setFormDraft((draft) => ({ ...draft, installments: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  type="number"
                  min={1}
                  max={24}
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Método de depósito
                <select
                  value={formDraft.depositMethod}
                  onChange={(event) => setFormDraft((draft) => ({ ...draft, depositMethod: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nota en recibo
                <input
                  value={formDraft.depositNote}
                  onChange={(event) => setFormDraft((draft) => ({ ...draft, depositNote: event.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="Identificar comprobante, tarjeta, etc."
                />
              </label>
            </div>

            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="flex justify-between">
                <span>Total artículos</span>
                <span className="font-semibold text-slate-900">{formatCurrency(totals.subtotalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Depósito</span>
                <span className="text-amber-700">{formatCurrency(totals.depositCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Saldo pendiente</span>
                <span className="font-semibold text-slate-900">{formatCurrency(totals.balanceCents)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center rounded-md bg-amber-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:bg-amber-300"
              >
                {submitting ? "Guardando…" : "Crear layaway"}
              </button>
            </div>
          </form>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Plan de pagos sugerido</h2>
            <p className="mt-1 text-sm text-slate-600">
              Ajuste el número de cuotas para equilibrar pagos y fecha de vencimiento.
            </p>
            <dl className="mt-4 space-y-2 text-sm text-slate-700">
              <div className="flex justify-between">
                <dt>Depósito hoy</dt>
                <dd className="font-medium text-amber-700">{formatCurrency(totals.depositCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Saldo restante</dt>
                <dd className="font-medium text-slate-900">{formatCurrency(totals.balanceCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{totals.installmentCount} cuotas</dt>
                <dd className="font-medium text-slate-900">{formatCurrency(totals.installmentAmount)}</dd>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <dt>Fecha límite</dt>
                <dd>{formDraft.dueDate ? dateFormatter.format(new Date(formDraft.dueDate)) : "Por definir"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Vista previa acuerdo</h2>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Imprimir
              </button>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm text-slate-700">
              {`El cliente acepta pagar ${formatCurrency(totals.depositCents)} como depósito inicial y completar el saldo de ${formatCurrency(totals.balanceCents)} antes del ${formDraft.dueDate ? dateFormatter.format(new Date(formDraft.dueDate)) : "—"} en ${totals.installmentCount} cuotas consecutivas.`}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              El inventario queda reservado automáticamente y volverá a piso si el plan se cancela o vence.
            </p>
          </section>

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

          {result && (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-800 shadow-sm">
              <h3 className="text-lg font-semibold text-emerald-900">Layaway #{result.layaway.id} listo</h3>
              <ul className="mt-3 space-y-1">
                <li>
                  Orden vinculada: <span className="font-semibold">{result.order?.orderNumber ?? `#${result.layaway.orderId}`}</span>
                </li>
                <li>
                  Cliente: <span className="font-semibold">{result.layaway.customerName ?? "Sin registrar"}</span>
                </li>
                <li>
                  Balance: <span className="font-semibold">{formatCurrency(result.layaway.balanceCents)}</span>
                </li>
                <li>
                  Estado: <span className="font-semibold capitalize">{result.layaway.status}</span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-emerald-700">
                El inventario quedó reservado automáticamente. Regrese a esta vista para registrar pagos o imprimir el
                acuerdo firmado.
              </p>
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}
