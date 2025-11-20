"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { ArrowLeft, ArrowRight, ClipboardCheck, Plus, Search, Trash2 } from "lucide-react";

import { formatCurrency } from "@/components/pos/utils";
import { formatDateForDisplay } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

function makeLineKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `line-${Math.random().toString(36).slice(2, 11)}`;
}

function centsToCurrency(cents: number | null | undefined) {
  return formatCurrency(Number(cents ?? 0) / 100);
}

type BranchOption = {
  id: number;
  name: string;
};

type PurchaseSearchItem = {
  id: number;
  branchId: number;
  supplierName: string | null;
  supplierInvoice: string | null;
  referenceNo: string | null;
  receivedAt: string | null;
  totalQuantity: number;
  totalCostCents: number;
};

type PurchaseLine = {
  id: number;
  productCodeVersionId: number;
  code: string | null;
  name: string | null;
  sku: string | null;
  quantity: number;
  unitCostCents: number;
  lineTotalCents: number;
  availableQuantity: number;
  returnedQuantity: number;
};

type PurchaseDetail = {
  id: number;
  branchId: number;
  supplierName: string | null;
  supplierInvoice: string | null;
  referenceNo: string | null;
  receivedAt: string | null;
  totalQuantity: number;
  totalCostCents: number;
};

type ReturnLine = {
  key: string;
  purchaseLineId: number;
  code: string | null;
  name: string | null;
  unitCostCents: number;
  maxQuantity: number;
  quantity: string;
};

type StatusMessage = { tone: "success" | "error"; message: string } | null;

type PurchaseReturnResponse = {
  purchaseReturn: {
    id: number;
    totalQuantity: number;
    totalCostCents: number;
    supplierName: string | null;
    supplierInvoice: string | null;
  };
  supplierCredit: {
    id: number;
    amountCents: number;
    balanceCents: number;
    supplierName: string | null;
    supplierInvoice: string | null;
  };
  remaining: Array<{ purchaseLineId: number; availableQuantity: number }>;
};

export default function PurchaseReturnsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PurchaseSearchItem[]>([]);

  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseDetail | null>(null);
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([]);

  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);

  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [status, setStatus] = useState<StatusMessage>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastReturn, setLastReturn] = useState<PurchaseReturnResponse | null>(null);

  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);

  useEffect(() => {
    async function loadBranches() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/codes?page=1&pageSize=1`);
        const body = (await response.json().catch(() => ({}))) as {
          metadata?: { branches?: BranchOption[] };
        };

        if (Array.isArray(body.metadata?.branches)) {
          setBranchOptions(body.metadata!.branches!);
        }
      } catch (error) {
        console.error("Unable to load branch options", error);
      }
    }

    loadBranches();
  }, []);

  const branchNameById = useMemo(() => {
    const map = new Map<number, string>();

    for (const option of branchOptions) {
      map.set(option.id, option.name);
    }

    return map;
  }, [branchOptions]);

  const totals = useMemo(() => {
    let totalQuantity = 0;
    let totalCostCents = 0;

    for (const line of returnLines) {
      const quantity = Number.parseInt(line.quantity, 10);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        continue;
      }

      totalQuantity += quantity;
      totalCostCents += quantity * line.unitCostCents;
    }

    return { totalQuantity, totalCostCents };
  }, [returnLines]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setStatus(null);
    setLastReturn(null);

    const query = searchTerm.trim();
    if (query.length < 2 && Number.isNaN(Number.parseInt(query, 10))) {
      setStatus({ tone: "error", message: "Introduce al menos 2 caracteres o un ID válido." });
      return;
    }

    setSearching(true);
    try {
      const params = new URLSearchParams();
      params.set("q", query);
      params.set("limit", "8");

      const response = await fetch(`${API_BASE_URL}/api/purchases/search?${params.toString()}`);
      const body = (await response.json().catch(() => ({}))) as {
        items?: PurchaseSearchItem[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudieron cargar las compras");
      }

      setSearchResults(Array.isArray(body.items) ? body.items : []);
      if (!Array.isArray(body.items) || body.items.length === 0) {
        setStatus({ tone: "error", message: "No se encontraron compras para devolver." });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falló la búsqueda";
      setStatus({ tone: "error", message });
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function loadPurchaseDetail(purchaseId: number) {
    setStatus(null);
    setLastReturn(null);
    setReturnLines([]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/purchases/${purchaseId}`);
      const body = (await response.json().catch(() => ({}))) as {
        purchase?: PurchaseDetail;
        lines?: PurchaseLine[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudo cargar la compra seleccionada");
      }

      setSelectedPurchase(body.purchase ?? null);
      setPurchaseLines(Array.isArray(body.lines) ? body.lines : []);

      if (Array.isArray(body.lines) && body.lines.every((line) => line.availableQuantity <= 0)) {
        setStatus({ tone: "error", message: "No quedan unidades disponibles para devolver." });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al cargar la compra";
      setStatus({ tone: "error", message });
      setSelectedPurchase(null);
      setPurchaseLines([]);
    }
  }

  function addReturnLine(line: PurchaseLine) {
    if (line.availableQuantity <= 0) {
      setStatus({ tone: "error", message: "Esta línea ya no tiene unidades disponibles." });
      return;
    }

    setReturnLines((existing) => {
      if (existing.some((entry) => entry.purchaseLineId === line.id)) {
        return existing;
      }

      return [
        ...existing,
        {
          key: makeLineKey(),
          purchaseLineId: line.id,
          code: line.code,
          name: line.name,
          unitCostCents: line.unitCostCents,
          maxQuantity: line.availableQuantity,
          quantity: String(Math.min(1, line.availableQuantity) || 1),
        },
      ];
    });
  }

  function updateReturnQuantity(key: string, value: string, maxQuantity: number) {
    setReturnLines((lines) =>
      lines.map((line) => {
        if (line.key !== key) {
          return line;
        }

        const numeric = Number.parseInt(value, 10);
        if (!Number.isInteger(numeric) || numeric <= 0) {
          return { ...line, quantity: value };
        }

        const bounded = Math.min(maxQuantity, numeric);
        return { ...line, quantity: String(bounded) };
      })
    );
  }

  function removeReturnLine(key: string) {
    setReturnLines((lines) => lines.filter((line) => line.key !== key));
  }

  async function submitReturn(event: FormEvent) {
    event.preventDefault();

    if (!selectedPurchase) {
      setStatus({ tone: "error", message: "Selecciona una compra antes de registrar la devolución." });
      return;
    }

    if (returnLines.length === 0) {
      setStatus({ tone: "error", message: "Agrega al menos una línea para devolver." });
      return;
    }

    const payloadLines = [] as Array<{ purchaseLineId: number; quantity: number }>;

    for (const line of returnLines) {
      const quantity = Number.parseInt(line.quantity, 10);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        setStatus({ tone: "error", message: "Verifica las cantidades ingresadas." });
        return;
      }

      payloadLines.push({ purchaseLineId: line.purchaseLineId, quantity });
    }

    setSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/purchase-returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: selectedPurchase.id,
          reason: reason.trim() || undefined,
          notes: notes.trim() || undefined,
          lines: payloadLines,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as PurchaseReturnResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudo registrar la devolución");
      }

      setLastReturn(body);
      setStatus({ tone: "success", message: "Devolución registrada correctamente." });
      setReturnLines([]);
      setReason("");
      setNotes("");

      if (Array.isArray(body.remaining)) {
        const remainingMap = new Map<number, number>();
        for (const entry of body.remaining) {
          remainingMap.set(entry.purchaseLineId, entry.availableQuantity);
        }

        setPurchaseLines((lines) =>
          lines.map((line) => {
            if (!remainingMap.has(line.id)) {
              return line;
            }

            const availableQuantity = Math.max(0, remainingMap.get(line.id) ?? 0);
            const returnedQuantity = Math.max(0, line.quantity - availableQuantity);

            return {
              ...line,
              availableQuantity,
              returnedQuantity,
            };
          })
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al registrar la devolución";
      setStatus({ tone: "error", message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Compras</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Devoluciones a proveedor</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Busca una compra registrada, selecciona las líneas a devolver y genera automáticamente el crédito del proveedor.
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Buscar compra
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Proveedor, factura, referencia o ID"
                className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 pr-10 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <button
            type="submit"
            disabled={searching}
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-300"
          >
            <Search className="h-4 w-4" /> Buscar
          </button>
        </form>

        {status && (
          <div
            className={`mt-4 rounded-md border px-4 py-3 text-sm ${
              status.tone === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-rose-300 bg-rose-50 text-rose-700"
            }`}
          >
            {status.message}
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Factura / Ref.</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Recibido</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-sm dark:divide-slate-800 dark:bg-slate-950">
                {searchResults.map((item) => (
                  <tr key={item.id} className="hover:bg-amber-50/60 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                      {item.supplierName ?? "Sin proveedor"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {[item.supplierInvoice, item.referenceNo].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {branchNameById.get(item.branchId) ?? `Sucursal #${item.branchId}`}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {item.receivedAt ? formatDateForDisplay(item.receivedAt) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                      {centsToCurrency(item.totalCostCents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => loadPurchaseDetail(item.id)}
                        className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-amber-500 hover:text-amber-600 dark:border-slate-600 dark:text-slate-200"
                      >
                        <ArrowRight className="h-3.5 w-3.5" /> Seleccionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedPurchase && (
        <section className="mt-8 grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-lg border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Compra #{selectedPurchase.id}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {selectedPurchase.supplierName ?? "Sin proveedor"} · {branchNameById.get(selectedPurchase.branchId) ?? `Sucursal #${selectedPurchase.branchId}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPurchase(null);
                  setPurchaseLines([]);
                  setReturnLines([]);
                  setLastReturn(null);
                }}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-400 hover:text-rose-500 dark:border-slate-600 dark:text-slate-300"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Cambiar compra
              </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
                  <tr className="text-left">
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3 text-right">Recibido</th>
                    <th className="px-4 py-3 text-right">Devuelto</th>
                    <th className="px-4 py-3 text-right">Disponible</th>
                    <th className="px-4 py-3 text-right">Costo</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-sm dark:divide-slate-800 dark:bg-slate-950">
                  {purchaseLines.map((line) => (
                    <tr key={line.id} className="hover:bg-amber-50/60 dark:hover:bg-slate-800/60">
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">
                        {line.code ?? `#${line.productCodeVersionId}`}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{line.name ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{line.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{line.returnedQuantity}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                        {line.availableQuantity}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                        {centsToCurrency(line.unitCostCents)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => addReturnLine(line)}
                          className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-amber-500 hover:text-amber-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 dark:border-slate-600 dark:text-slate-200"
                          disabled={line.availableQuantity <= 0 || returnLines.some((entry) => entry.purchaseLineId === line.id)}
                        >
                          <Plus className="h-3.5 w-3.5" /> Añadir
                        </button>
                      </td>
                    </tr>
                  ))}
                  {purchaseLines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        No se encontraron líneas para esta compra.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <form
            onSubmit={submitReturn}
            className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Líneas a devolver
            </h3>

            <div className="space-y-3">
              {returnLines.length === 0 && (
                <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Selecciona líneas de la tabla para agregarlas a la devolución.
                </p>
              )}

              {returnLines.map((line) => (
                <div
                  key={line.key}
                  className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {line.code ?? `Línea #${line.purchaseLineId}`}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{line.name ?? "Sin descripción"}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Máx. {line.maxQuantity} unidades · Costo unitario {centsToCurrency(line.unitCostCents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={line.maxQuantity}
                      value={line.quantity}
                      onChange={(event) => updateReturnQuantity(line.key, event.target.value, line.maxQuantity)}
                      className="w-20 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => removeReturnLine(line.key)}
                      className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-white p-2 text-rose-600 shadow-sm transition hover:bg-rose-50 dark:border-rose-400/40 dark:bg-slate-900 dark:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Motivo de la devolución
              </label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                placeholder="Ej. productos defectuosos"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notas internas
              </label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="Observaciones adicionales para el equipo de compras"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-950">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">Cantidad total</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{totals.totalQuantity}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">Crédito estimado</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {centsToCurrency(totals.totalCostCents)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || returnLines.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              <ClipboardCheck className="h-4 w-4" /> Registrar devolución
            </button>

            {lastReturn && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-200">
                <p className="font-semibold">Crédito generado #{lastReturn.supplierCredit.id}</p>
                <p>
                  Monto: {centsToCurrency(lastReturn.supplierCredit.amountCents)} ({lastReturn.supplierCredit.supplierName ?? "Proveedor"})
                </p>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-200/80">
                  Guarda el comprobante y notifica al proveedor según corresponda.
                </p>
              </div>
            )}
          </form>
        </section>
      )}
    </main>
  );
}
