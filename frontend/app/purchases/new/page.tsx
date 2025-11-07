"use client";

import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useState } from "react";

import { ClipboardList, Loader2, PackagePlus, Printer, Search, Trash2 } from "lucide-react";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

import { formatCurrency } from "@/components/pos/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const MAX_LABELS = 200;

const today = () => new Date().toISOString().slice(0, 10);

function parseAmountToCents(value: string) {
  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function centsToCurrency(cents: number | null | undefined) {
  return formatCurrency(Number(cents ?? 0) / 100);
}

function makeLineKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `line-${Math.random().toString(36).slice(2, 10)}`;
}

type LayoutOption = {
  id: string;
  name: string;
};

type CodeResult = {
  productCodeVersionId: number;
  code: string;
  name: string;
  branchId: number;
  branchName: string | null;
  sku: string | null;
  priceCents: number | null;
  costCents: number | null;
};

type PurchaseLineInput = {
  key: string;
  productCodeVersionId: number;
  code: string;
  name: string;
  branchId: number;
  branchName: string | null;
  sku: string | null;
  quantity: string;
  unitCost: string;
  labelQuantity: string;
};

type StatusMessage = { tone: "success" | "error"; message: string } | null;

type PurchaseResponse = {
  purchase: {
    id: number;
    referenceNo: string | null;
    supplierName: string | null;
    totalCostCents: number;
    totalQuantity: number;
    labelLayout: string | null;
    labelCount: number;
  };
  lines: Array<{
    productCodeVersionId: number;
    code: string | null;
    name: string | null;
    quantity: number;
    unitCostCents: number;
    lineTotalCents: number;
    labelQuantity: number;
  }>;
  totals: {
    totalQuantity: number;
    totalCostCents: number;
  };
  labels: {
    totalLabels: number;
    layout: LayoutOption & { columns?: number; rows?: number };
  };
};

export default function PurchaseReceivePage() {
  const { branch: activeBranch, loading: branchLoading, error: branchError } = useActiveBranch();
  const [availableLayouts, setAvailableLayouts] = useState<LayoutOption[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [receivedAt, setReceivedAt] = useState<string>(today());
  const [notes, setNotes] = useState("");
  const [layoutId, setLayoutId] = useState<string>("");
  const [includePrice, setIncludePrice] = useState(true);
  const [labelNote, setLabelNote] = useState("");
  const [lines, setLines] = useState<PurchaseLineInput[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<CodeResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [status, setStatus] = useState<StatusMessage>(null);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<PurchaseResponse | null>(null);

  useEffect(() => {
    setBranchId((prev) => {
      const next = activeBranch ? String(activeBranch.id) : "";
      return prev === next ? prev : next;
    });
  }, [activeBranch]);

  useEffect(() => {
    async function loadMetadata() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/codes?page=1&pageSize=1`);
        const body = (await response.json().catch(() => ({}))) as {
          metadata?: { layouts?: LayoutOption[] };
        };

        if (Array.isArray(body.metadata?.layouts) && body.metadata!.layouts!.length > 0) {
          setAvailableLayouts(body.metadata!.layouts!);
          setLayoutId((prev) => {
            if (prev) {
              return prev;
            }
            return body.metadata!.layouts![0]!.id;
          });
        }
      } catch (error) {
        console.error("Unable to load purchase metadata", error);
      }
    }

    loadMetadata();
  }, []);

  const totals = useMemo(() => {
    let totalQuantity = 0;
    let totalCostCents = 0;

    for (const line of lines) {
      const qty = Number.parseInt(line.quantity, 10);
      const unitCostCents = parseAmountToCents(line.unitCost);

      if (Number.isInteger(qty) && qty > 0 && unitCostCents != null) {
        totalQuantity += qty;
        totalCostCents += unitCostCents * qty;
      }
    }

    return { totalQuantity, totalCostCents };
  }, [lines]);

  const runSearch = async () => {
    setStatus(null);
    setPreview(null);

    const query = searchTerm.trim();
    if (query.length < 2) {
      setStatus({ tone: "error", message: "Ingresa al menos 2 caracteres para buscar." });
      return;
    }

    setSearching(true);
    setSearchResults([]);
    try {
      const params = new URLSearchParams();
      params.set("q", query);
      params.set("pageSize", "8");
      params.set("status", "active");

      const response = await fetch(`${API_BASE_URL}/api/codes?${params.toString()}`);
      const body = (await response.json().catch(() => ({}))) as {
        items?: CodeResult[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudieron cargar los productos");
      }

      setSearchResults(Array.isArray(body.items) ? body.items : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fallo la búsqueda";
      setStatus({ tone: "error", message });
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void runSearch();
    }
  };

  const addLineFromCode = (code: CodeResult) => {
    setStatus(null);
    setPreview(null);

    const resolvedBranchId = activeBranch ? activeBranch.id : branchId ? Number(branchId) : null;

    if (resolvedBranchId == null) {
      setBranchId(String(code.branchId));
    } else if (Number(resolvedBranchId) !== Number(code.branchId)) {
      setStatus({
        tone: "error",
        message: "Todas las líneas deben pertenecer a la misma sucursal.",
      });
      return;
    }

    setLines((previous) => {
      const existing = previous.find((line) => line.productCodeVersionId === code.productCodeVersionId);
      const defaultCostCents =
        code.costCents != null
          ? Number(code.costCents)
          : code.priceCents != null
          ? Number(code.priceCents)
          : 0;
      const defaultCost = defaultCostCents > 0 ? (defaultCostCents / 100).toFixed(2) : "";

      if (existing) {
        return previous.map((line) =>
          line.productCodeVersionId === existing.productCodeVersionId
            ? {
                ...line,
                quantity: String(Number.parseInt(line.quantity, 10) + 1 || 1),
              }
            : line
        );
      }

      return [
        ...previous,
        {
          key: makeLineKey(),
          productCodeVersionId: code.productCodeVersionId,
          code: code.code,
          name: code.name,
          branchId: code.branchId,
          branchName: code.branchName,
          sku: code.sku,
          quantity: "1",
          unitCost: defaultCost,
          labelQuantity: "1",
        },
      ];
    });

    setSearchTerm("");
    setSearchResults([]);
  };

  const removeLine = (key: string) => {
    setLines((previous) => previous.filter((line) => line.key !== key));
  };

  const updateLine = (key: string, field: keyof PurchaseLineInput, value: string) => {
    setLines((previous) =>
      previous.map((line) => (line.key === key ? { ...line, [field]: value } : line))
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setPreview(null);

    if (!activeBranch) {
      setStatus({
        tone: "error",
        message: branchError ?? "Configura una sucursal activa en ajustes antes de recibir compras.",
      });
      return;
    }

    if (lines.length === 0) {
      setStatus({ tone: "error", message: "Agrega al menos una línea de producto." });
      return;
    }

    const parsedLines: Array<{
      productCodeVersionId: number;
      quantity: number;
      unitCostCents: number;
      labelQuantity: number;
    }> = [];
    let totalLabels = 0;

    for (const line of lines) {
      const quantity = Number.parseInt(line.quantity, 10);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        setStatus({
          tone: "error",
          message: `La cantidad de ${line.code} debe ser un entero mayor a cero.`,
        });
        return;
      }

      const unitCostCents = parseAmountToCents(line.unitCost);
      if (unitCostCents == null) {
        setStatus({
          tone: "error",
          message: `El costo unitario de ${line.code} debe ser mayor a 0.`,
        });
        return;
      }

      const labelQuantityRaw = line.labelQuantity.trim();
      const labelQuantity = labelQuantityRaw === ""
        ? quantity
        : Number.parseInt(labelQuantityRaw, 10);

      if (!Number.isInteger(labelQuantity) || labelQuantity < 0) {
        setStatus({
          tone: "error",
          message: `La cantidad de etiquetas de ${line.code} debe ser cero o un entero positivo.`,
        });
        return;
      }

      totalLabels += labelQuantity;
      parsedLines.push({
        productCodeVersionId: line.productCodeVersionId,
        quantity,
        unitCostCents,
        labelQuantity,
      });
    }

    if (totalLabels > MAX_LABELS) {
      setStatus({
        tone: "error",
        message: `Solicita máximo ${MAX_LABELS} etiquetas por recepción.`,
      });
      return;
    }

    const payload = {
      branchId: activeBranch.id,
      supplierName: supplierName.trim() || null,
      supplierInvoice: supplierInvoice.trim() || null,
      reference: referenceNo.trim() || null,
      receivedAt: receivedAt || null,
      notes: notes.trim() || null,
      layout: layoutId || null,
      includePrice,
      labelNote: labelNote.trim() || null,
      lines: parsedLines.map((line) => ({
        productCodeVersionId: line.productCodeVersionId,
        quantity: line.quantity,
        unitCostCents: line.unitCostCents,
        labelQuantity: line.labelQuantity,
      })),
    };

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => ({}))) as PurchaseResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudo registrar la compra");
      }

      setStatus({ tone: "success", message: "Compra registrada correctamente." });
      setPreview(body);
      setLines([]);
      setSearchResults([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar la compra";
      setStatus({ tone: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Recepción de compras</h1>
        <p className="text-sm text-slate-600">
          Registra facturas de proveedores, ajusta existencias y genera etiquetas listas para imprimir.
        </p>
      </header>

      {branchLoading ? (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Sincronizando configuración de sucursal…
        </div>
      ) : !activeBranch ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-200">
          Configura una sucursal predeterminada en Ajustes → Sistema para recibir mercancía.
        </div>
      ) : branchError ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200">
          {branchError}
        </div>
      ) : null}

      {status && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            status.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1 text-sm text-slate-700">
            <span>Sucursal</span>
            {branchLoading ? (
              <span className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando…
              </span>
            ) : branchError ? (
              <span className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                {branchError}
              </span>
            ) : activeBranch ? (
              <span className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
                {activeBranch.name}
              </span>
            ) : (
              <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Configura una sucursal activa en ajustes
              </span>
            )}
          </div>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Fecha de recepción
            <input
              type="date"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              value={receivedAt}
              onChange={(event) => setReceivedAt(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Proveedor
            <input
              type="text"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              value={supplierName}
              onChange={(event) => setSupplierName(event.target.value)}
              placeholder="Nombre del proveedor"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Factura / Documento
            <input
              type="text"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              value={supplierInvoice}
              onChange={(event) => setSupplierInvoice(event.target.value)}
              placeholder="Número de factura"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Referencia interna
            <input
              type="text"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              value={referenceNo}
              onChange={(event) => setReferenceNo(event.target.value)}
              placeholder="Opcional"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Nota interna
            <textarea
              className="h-24 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Comentarios adicionales"
            />
          </label>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Layout de etiqueta
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              value={layoutId}
              onChange={(event) => setLayoutId(event.target.value)}
            >
              {availableLayouts.length === 0 && <option value="">Por defecto</option>}
              {availableLayouts.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={includePrice}
              onChange={(event) => setIncludePrice(event.target.checked)}
            />
            Incluir precio en la etiqueta
          </label>

          <label className="md:col-span-2 flex flex-col gap-1 text-sm text-slate-700">
            Nota para etiqueta (opcional)
            <input
              type="text"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              value={labelNote}
              onChange={(event) => setLabelNote(event.target.value)}
              placeholder="Texto corto impreso en las etiquetas"
              maxLength={140}
            />
          </label>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-slate-500" />
              <input
                type="text"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar por código, nombre o SKU"
              />
              <button
                type="button"
                onClick={() => void runSearch()}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                disabled={searching}
              >
                <ClipboardList className="h-4 w-4" /> {searching ? "Buscando" : "Buscar"}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="grid gap-2 md:grid-cols-2">
                {searchResults.map((result) => (
                  <button
                    type="button"
                    key={result.productCodeVersionId}
                    onClick={() => addLineFromCode(result)}
                    className="flex flex-col items-start gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm text-emerald-800 hover:border-emerald-300"
                  >
                    <span className="font-medium">{result.code}</span>
                    <span>{result.name}</span>
                    <span className="text-xs text-emerald-700">
                      {result.branchName ?? `Sucursal ${result.branchId}`} · Exist. c/ costo {centsToCurrency(result.costCents)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2">Código</th>
                  <th className="px-4 py-2">Descripción</th>
                  <th className="px-4 py-2">Cantidad</th>
                  <th className="px-4 py-2">Costo unitario</th>
                  <th className="px-4 py-2">Etiquetas</th>
                  <th className="px-4 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Usa la búsqueda para agregar productos a la recepción.
                    </td>
                  </tr>
                )}
                {lines.map((line) => (
                  <tr key={line.key} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">{line.code}</td>
                    <td className="px-4 py-2 text-slate-700">{line.name}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={1}
                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
                        value={line.quantity}
                        onChange={(event) => updateLine(line.key, "quantity", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
                        value={line.unitCost}
                        onChange={(event) => updateLine(line.key, "unitCost", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={0}
                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
                        value={line.labelQuantity}
                        onChange={(event) => updateLine(line.key, "labelQuantity", event.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" /> Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Total artículos</span>
              <strong>{totals.totalQuantity}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Total costo</span>
              <strong>{centsToCurrency(totals.totalCostCents)}</strong>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
            disabled={submitting || branchLoading || !activeBranch}
          >
            <PackagePlus className="h-4 w-4" /> Registrar compra
          </button>
        </div>
      </form>

      {preview && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Printer className="h-5 w-5" /> Resumen de recepción #{preview.purchase.id}
          </h2>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="font-medium">Proveedor</p>
              <p>{preview.purchase.supplierName ?? "-"}</p>
            </div>
            <div>
              <p className="font-medium">Referencia</p>
              <p>{preview.purchase.referenceNo ?? "-"}</p>
            </div>
            <div>
              <p className="font-medium">Total costo</p>
              <p>{centsToCurrency(preview.totals.totalCostCents)}</p>
            </div>
            <div>
              <p className="font-medium">Etiquetas generadas</p>
              <p>
                {preview.labels.totalLabels} etiquetas · Layout {preview.purchase.labelLayout ?? preview.labels.layout.id}
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-md border border-emerald-200 bg-white">
            <table className="min-w-full divide-y divide-emerald-100 text-sm">
              <thead className="bg-emerald-100 text-left text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <tr>
                  <th className="px-4 py-2">Código</th>
                  <th className="px-4 py-2">Descripción</th>
                  <th className="px-4 py-2">Cantidad</th>
                  <th className="px-4 py-2">Costo unitario</th>
                  <th className="px-4 py-2">Etiquetas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {preview.lines.map((line) => (
                  <tr key={`${line.productCodeVersionId}-${line.quantity}`}>
                    <td className="px-4 py-2 font-medium">{line.code ?? line.productCodeVersionId}</td>
                    <td className="px-4 py-2">{line.name ?? "-"}</td>
                    <td className="px-4 py-2">{line.quantity}</td>
                    <td className="px-4 py-2">{centsToCurrency(line.unitCostCents)}</td>
                    <td className="px-4 py-2">{line.labelQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
