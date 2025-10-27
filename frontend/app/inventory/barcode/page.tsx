"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Printer,
  RefreshCcw,
  Search,
} from "lucide-react";

import { formatCurrencyFromCents } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const DEFAULT_LAYOUT_ID = "2x7";

const pageSizeOptions = [25, 50, 100];

const statusOptions = [
  { value: "active", label: "Activos" },
  { value: "all", label: "Todos" },
  { value: "inactive", label: "Inactivos" },
] as const;

const numberFormatter = new Intl.NumberFormat("es-DO");
const currencyFormatter = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
});
const dateTimeFormatter = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildQrUrl(payload: string, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}`;
}

type BranchOption = { id: number; name: string };

type CodeRecord = {
  productCodeId: number;
  productCodeVersionId: number;
  code: string;
  name: string;
  sku: string | null;
  branchId: number;
  branchName: string | null;
  priceCents: number | null;
  qtyOnHand: number;
  qtyReserved: number;
  isActive: boolean;
};

type PaginationState = {
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextPage: number | null;
};

type LabelLayout = {
  id: string;
  name: string;
  columns: number;
  rows: number;
  widthMm: number;
  heightMm: number;
  marginMm: number;
};

type LabelPreviewItem = {
  productCodeVersionId: number;
  productCodeId: number;
  code: string;
  name: string;
  sku: string | null;
  branchId: number;
  branchName: string | null;
  priceCents: number | null;
  note: string | null;
  qrPayload: string;
  pageNumber: number;
  rowIndex: number;
  columnIndex: number;
};

type LabelPreviewPage = {
  pageNumber: number;
  rows: (LabelPreviewItem | null)[][];
};

type PrintPreviewPayload = {
  generatedAt: string;
  layout: LabelLayout;
  totalLabels: number;
  labels: LabelPreviewItem[];
  pages: LabelPreviewPage[];
  warnings?: {
    missingVersionIds?: number[];
  };
  availableLayouts?: LabelLayout[];
};

type FiltersState = {
  branchId: number | "all";
  status: (typeof statusOptions)[number]["value"];
  page: number;
  pageSize: number;
  search: string;
};

type FlashMessage = { tone: "success" | "error" | "info"; message: string } | null;

const defaultFilters: FiltersState = {
  branchId: "all",
  status: "active",
  page: 1,
  pageSize: 50,
  search: "",
};

export default function InventoryBarcodePage() {
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [searchDraft, setSearchDraft] = useState(defaultFilters.search);
  const [codes, setCodes] = useState<CodeRecord[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [availableLayouts, setAvailableLayouts] = useState<LabelLayout[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>(DEFAULT_LAYOUT_ID);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 50,
    hasMore: false,
    nextPage: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<FlashMessage>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [includePrice, setIncludePrice] = useState(true);
  const [labelNote, setLabelNote] = useState("");
  const [printPreview, setPrintPreview] = useState<PrintPreviewPayload | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  const selectionSummary = useMemo(() => {
    const entries = Object.entries(quantities).filter(([, qty]) => qty > 0);
    const totalLabels = entries.reduce((sum, [, qty]) => sum + qty, 0);
    return {
      codes: entries.length,
      labels: totalLabels,
    };
  }, [quantities]);

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(filters.page));
      params.set("pageSize", String(filters.pageSize));
      params.set("status", filters.status);

      if (filters.branchId !== "all") {
        params.set("branchId", String(filters.branchId));
      }

      if (filters.search.trim()) {
        params.set("q", filters.search.trim());
      }

      const response = await fetch(`${API_BASE_URL}/api/codes?${params.toString()}`);
      const body = (await response.json().catch(() => ({}))) as {
        items?: CodeRecord[];
        metadata?: { branches?: BranchOption[]; layouts?: LabelLayout[] };
        pagination?: PaginationState;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudieron cargar los códigos");
      }

      setCodes(Array.isArray(body.items) ? body.items : []);

      if (body.pagination) {
        setPagination(body.pagination);
      } else {
        setPagination((previous) => ({
          ...previous,
          page: filters.page,
          pageSize: filters.pageSize,
          hasMore: false,
          nextPage: null,
        }));
      }

      if (Array.isArray(body.metadata?.branches)) {
        setBranches(body.metadata.branches);
      }

      if (Array.isArray(body.metadata?.layouts) && body.metadata.layouts.length > 0) {
        setAvailableLayouts(body.metadata.layouts);
        setSelectedLayoutId((prev) => {
          const firstLayout = body.metadata!.layouts![0]!.id || DEFAULT_LAYOUT_ID;
          if (!prev) {
            return firstLayout;
          }
          return body.metadata!.layouts!.some((layout) => layout.id === prev) ? prev : firstLayout;
        });
      }

      setFlashMessage(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar los códigos";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters((previous) => ({
      ...previous,
      search: searchDraft.trim(),
      page: 1,
    }));
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setSearchDraft(defaultFilters.search);
    setQuantities({});
    setPrintPreview(null);
    setFlashMessage(null);
    setError(null);
    setPreviewError(null);
    setPrintError(null);
  };

  const handleQuantityChange = (versionId: number, value: string) => {
    const numeric = Number(value);
    setQuantities((previous) => {
      const next = { ...previous };
      if (!Number.isFinite(numeric) || numeric <= 0) {
        delete next[versionId];
      } else {
        next[versionId] = Math.min(Math.round(numeric), 50);
      }
      return next;
    });
  };

  const handleClearQuantity = (versionId: number) => {
    setQuantities((previous) => {
      if (!(versionId in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[versionId];
      return next;
    });
  };

  const handlePageChange = (direction: "next" | "prev") => {
    if (direction === "next" && pagination.hasMore && pagination.nextPage) {
      setFilters((previous) => ({ ...previous, page: pagination.nextPage ?? previous.page + 1 }));
    } else if (direction === "prev" && filters.page > 1) {
      setFilters((previous) => ({ ...previous, page: previous.page - 1 }));
    }
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number(event.target.value);
    setFilters((previous) => ({ ...previous, pageSize: value, page: 1 }));
  };

  const handleGeneratePreview = async () => {
    const layoutToUse = selectedLayoutId || availableLayouts[0]?.id || DEFAULT_LAYOUT_ID;
    const itemsPayload = Object.entries(quantities)
      .map(([versionId, quantity]) => ({
        productCodeVersionId: Number(versionId),
        quantity,
      }))
      .filter((entry) => Number.isFinite(entry.quantity) && entry.quantity > 0);

    if (itemsPayload.length === 0) {
      setPreviewError("Selecciona al menos un código y cantidad");
      return;
    }

    setGeneratingPreview(true);
    setPreviewError(null);
    setPrintError(null);
    setFlashMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/labels/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layout: layoutToUse,
          includePrice,
          labelNote: labelNote.trim() || null,
          items: itemsPayload,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as PrintPreviewPayload & { error?: string };

      if (!response.ok) {
        throw new Error(body?.error ?? "No se pudo generar la vista previa de impresión");
      }

      setPrintPreview(body);
      setFlashMessage({
        tone: "success",
        message: `Vista previa lista con ${body.totalLabels ?? 0} etiquetas`,
      });

      if (Array.isArray(body.availableLayouts) && body.availableLayouts.length > 0) {
        setAvailableLayouts(body.availableLayouts);
        setSelectedLayoutId((prev) => {
          const fallback = body.layout?.id || body.availableLayouts![0]!.id || DEFAULT_LAYOUT_ID;
          if (!prev) {
            return fallback;
          }
          return body.availableLayouts!.some((layout) => layout.id === prev) ? prev : fallback;
        });
      } else if (body.layout?.id) {
        setSelectedLayoutId(body.layout.id);
      } else {
        setSelectedLayoutId(layoutToUse);
      }

      if (body?.warnings?.missingVersionIds?.length) {
        setPreviewError(
          `Algunas versiones no se encontraron (${body.warnings.missingVersionIds.join(", ")})`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo generar la vista previa de impresión";
      setPreviewError(message);
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handlePrint = () => {
    if (!printPreview) {
      setPrintError("Genera una vista previa antes de imprimir");
      return;
    }

    setPrintError(null);

    try {
      const layout = printPreview.layout;
      const gapMm = Math.max(layout.marginMm / 2, 2);
      const styles = `
        * { box-sizing: border-box; }
        @page { margin: ${layout.marginMm}mm; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; color: #111; }
        .page { width: 100%; display: grid; grid-template-columns: repeat(${layout.columns}, ${layout.widthMm}mm); grid-auto-rows: ${layout.heightMm}mm; gap: ${gapMm}mm; padding: ${layout.marginMm}mm; page-break-after: always; }
        .page:last-of-type { page-break-after: auto; }
        .label { border: 1px solid #e2e8f0; padding: 4mm; display: flex; flex-direction: column; justify-content: space-between; border-radius: 3mm; }
        .label h3 { margin: 0 0 2mm; font-size: 12px; line-height: 1.25; }
        .label p { margin: 0; font-size: 10px; line-height: 1.3; }
        .label .price { font-size: 14px; font-weight: 600; margin-top: 2mm; }
        .label .meta { color: #475569; }
        .label .note { margin-top: 2mm; font-style: italic; color: #0f172a; }
        .qr { margin-top: 2mm; display: flex; justify-content: center; }
        img { display: block; max-width: 100%; height: auto; }
      `;

      const parts: string[] = [];
      parts.push(`<html><head><title>Etiquetas ${escapeHtml(dateTimeFormatter.format(new Date(printPreview.generatedAt)))}</title><style>${styles}</style></head><body>`);

      printPreview.pages.forEach((page) => {
        parts.push('<section class="page">');
        page.rows.forEach((row) => {
          row.forEach((cell) => {
            if (!cell) {
              parts.push('<div class="label"></div>');
              return;
            }

            const priceText =
              typeof cell.priceCents === "number" ? currencyFormatter.format(cell.priceCents / 100) : "";
            const qrSrc = buildQrUrl(cell.qrPayload, 180);
            const skuText = cell.sku ? ` · SKU ${escapeHtml(cell.sku)}` : "";
            const branchText = cell.branchName ? `<p class=\"meta\">${escapeHtml(cell.branchName)}</p>` : "";
            const noteText = cell.note ? `<p class=\"note\">${escapeHtml(cell.note)}</p>` : "";
            const priceMarkup = priceText
              ? `<p class=\"price\">${escapeHtml(priceText)}</p>`
              : "<p class=\"meta\">Sin precio impreso</p>";

            parts.push(`
              <div class="label">
                <div>
                  <h3>${escapeHtml(cell.name)}</h3>
                  <p class="meta">${escapeHtml(cell.code)}${skuText}</p>
                  ${branchText}
                </div>
                ${priceMarkup}
                ${noteText}
                <div class="qr"><img src="${qrSrc}" alt="QR ${escapeHtml(cell.code)}" width="120" height="120" loading="lazy" /></div>
              </div>
            `);
          });
        });
        parts.push('</section>');
      });

      parts.push('</body></html>');

      const printWindow = window.open("", "print-labels");

      if (!printWindow) {
        setPrintError("El navegador bloqueó la ventana de impresión");
        return;
      }

      printWindow.document.open();
      printWindow.document.write(parts.join(""));
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (err) {
          console.error(err);
        }
      }, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo iniciar la impresión";
      setPrintError(message);
    }
  };

  const currentLayout = useMemo(() => {
    if (printPreview?.layout) {
      return printPreview.layout;
    }
    return availableLayouts.find((layout) => layout.id === selectedLayoutId) ?? availableLayouts[0] ?? null;
  }, [availableLayouts, printPreview, selectedLayoutId]);

  return (
    <main className="space-y-10">
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Imprimir etiquetas QR</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Genera etiquetas con código QR para versiones de producto, ajusta el diseño y prepara la hoja antes
          de enviar a impresión.
        </p>
      </header>

      <section className="space-y-6">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
          <form onSubmit={handleSearchSubmit} className="flex flex-1 flex-col gap-3 md:flex-row md:items-end">
            <label className="flex flex-1 flex-col gap-1 text-sm text-slate-600">
              Búsqueda
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Nombre, código o SKU"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </label>

            <label className="flex w-full flex-col gap-1 text-sm text-slate-600 md:w-48">
              Sucursal
              <select
                value={filters.branchId === "all" ? "all" : String(filters.branchId)}
                onChange={(event) => {
                  const value = event.target.value;
                  setFilters((previous) => ({
                    ...previous,
                    branchId: value === "all" ? "all" : Number(value),
                    page: 1,
                  }));
                }}
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="all">Todas las sucursales</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex w-full flex-col gap-1 text-sm text-slate-600 md:w-40">
              Estado
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((previous) => ({ ...previous, status: event.target.value as FiltersState["status"], page: 1 }))
                }
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex w-full flex-col gap-1 text-sm text-slate-600 md:w-36">
              Filas por página
              <select
                value={filters.pageSize}
                onChange={handlePageSizeChange}
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900"
              >
                Buscar
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
              >
                Limpiar
              </button>
            </div>
          </form>

          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>{selectionSummary.codes} códigos seleccionados</span>
            </div>
            <div className="flex items-center gap-2">
              <Printer className="h-4 w-4 text-slate-500" />
              <span>{selectionSummary.labels} etiquetas</span>
            </div>
            <button
              type="button"
              onClick={() => fetchCodes()}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-medium">No se pudieron cargar los códigos</p>
              <p>{error}</p>
            </div>
          </div>
        ) : null}

        {flashMessage ? (
          <div
            className={clsx(
              "flex items-start gap-3 rounded-md px-4 py-3 text-sm",
              flashMessage.tone === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : flashMessage.tone === "error"
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-slate-200 bg-slate-50 text-slate-700"
            )}
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4" />
            <p>{flashMessage.message}</p>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Código
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Descripción
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Sucursal
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Precio
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Disp.
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Cantidad etiquetas
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    <div className="inline-flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando códigos...
                    </div>
                  </td>
                </tr>
              ) : codes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    No se encontraron códigos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                codes.map((code) => {
                  const currentQuantity = quantities[code.productCodeVersionId] ?? "";
                  return (
                    <tr key={`${code.productCodeVersionId}-${code.branchId}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        <div className="flex flex-col gap-1">
                          <span>{code.code}</span>
                          {code.sku ? <span className="text-[11px] text-slate-400">SKU {code.sku}</span> : null}
                          <span
                            className={clsx(
                              "inline-flex h-5 w-fit items-center rounded-full px-2 text-[11px] font-medium",
                              code.isActive
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            )}
                          >
                            {code.isActive ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{code.name}</p>
                        <p className="text-xs text-slate-500">ID #{code.productCodeId}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {code.branchName ?? `Sucursal ${code.branchId}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {code.priceCents != null ? formatCurrencyFromCents(code.priceCents) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        <div className="flex flex-col">
                          <span>{numberFormatter.format(Math.max(0, code.qtyOnHand - code.qtyReserved))} disp.</span>
                          <span className="text-xs text-slate-400">
                            {numberFormatter.format(code.qtyOnHand)} en stock
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={currentQuantity}
                          onChange={(event) => handleQuantityChange(code.productCodeVersionId, event.target.value)}
                          className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleClearQuantity(code.productCodeVersionId)}
                          className="rounded-md border border-transparent bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
                        >
                          Limpiar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <div>
              Página {filters.page} · {codes.length} resultados mostrados
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange("prev")}
                disabled={filters.page === 1 || loading}
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => handlePageChange("next")}
                disabled={!pagination.hasMore || loading}
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Configuración de impresión</h2>
              <p className="text-sm text-slate-600">
                Ajusta el diseño de la hoja, incluye precio o notas y genera la vista previa antes de imprimir.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleGeneratePreview}
                disabled={generatingPreview}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generatingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Generar vista previa
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={!printPreview}
                className="inline-flex items-center gap-2 rounded-md border border-transparent bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              Diseño de hoja
              <select
                value={selectedLayoutId}
                onChange={(event) => setSelectedLayoutId(event.target.value)}
                className="rounded-md border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                {availableLayouts.length === 0 ? (
                  <option value={DEFAULT_LAYOUT_ID}>2 columnas x 7 filas</option>
                ) : (
                  availableLayouts.map((layout) => (
                    <option key={layout.id} value={layout.id}>
                      {layout.name}
                    </option>
                  ))
                )}
              </select>
              {currentLayout ? (
                <p className="text-xs text-slate-500">
                  {currentLayout.columns} columnas · {currentLayout.rows} filas · {currentLayout.widthMm}×{currentLayout.heightMm} mm
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-600">
              Nota impresa (opcional)
              <input
                type="text"
                value={labelNote}
                maxLength={140}
                onChange={(event) => setLabelNote(event.target.value)}
                placeholder="Ej. Garantía 30 días"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <span className="text-xs text-slate-400">{labelNote.length}/140 caracteres</span>
            </label>

            <label className="flex items-center gap-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includePrice}
                onChange={(event) => setIncludePrice(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              Incluir precio en etiqueta
            </label>
          </div>

          {previewError ? (
            <div className="mt-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <div>
                <p className="font-medium">Atención</p>
                <p>{previewError}</p>
              </div>
            </div>
          ) : null}

          {printError ? (
            <div className="mt-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <div>
                <p className="font-medium">No se pudo imprimir</p>
                <p>{printError}</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {printPreview ? (
        <section className="space-y-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Vista previa</h2>
              <p className="text-sm text-slate-600">
                Generada el {dateTimeFormatter.format(new Date(printPreview.generatedAt))} · {printPreview.totalLabels}{" "}
                etiquetas totales
              </p>
            </div>
            {printPreview.layout ? (
              <div className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
                {printPreview.layout.columns} columnas · {printPreview.layout.rows} filas · margen {printPreview.layout.marginMm} mm
              </div>
            ) : null}
          </div>

          <div className="space-y-8">
            {printPreview.pages.map((page) => (
              <div key={page.pageNumber} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-800">Hoja {page.pageNumber}</h3>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {page.rows.reduce((total, row) => total + row.filter((cell) => Boolean(cell)).length, 0)} etiquetas en esta hoja
                  </p>
                </div>
                <div
                  className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                  style={{
                    gridTemplateColumns: `repeat(${printPreview.layout.columns}, minmax(0, 1fr))`,
                  }}
                >
                  {page.rows.flatMap((row, rowIndex) =>
                    row.map((cell, columnIndex) => {
                      const key = `${page.pageNumber}-${rowIndex}-${columnIndex}`;
                      if (!cell) {
                        return (
                          <div
                            key={key}
                            className="flex h-full items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400"
                          >
                            Vacío
                          </div>
                        );
                      }

                      return (
                        <div
                          key={key}
                          className="flex h-full flex-col justify-between rounded border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{cell.name}</p>
                            <p className="text-xs text-slate-500">
                              {cell.code}
                              {cell.sku ? ` · SKU ${cell.sku}` : ""}
                            </p>
                            {cell.branchName ? (
                              <p className="text-xs text-slate-400">{cell.branchName}</p>
                            ) : null}
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            {cell.priceCents != null ? (
                              <p className="text-base font-semibold text-slate-900">
                                {formatCurrencyFromCents(cell.priceCents)}
                              </p>
                            ) : (
                              <span className="text-xs text-slate-400">Sin precio</span>
                            )}
                            <img
                              src={buildQrUrl(cell.qrPayload, 160)}
                              alt={`QR ${cell.code}`}
                              loading="lazy"
                              className="h-16 w-16 rounded bg-white p-1 shadow-inner"
                            />
                          </div>
                          {cell.note ? (
                            <p className="mt-2 text-xs text-slate-500">{cell.note}</p>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
