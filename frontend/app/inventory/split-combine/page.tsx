"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  ArrowRightLeft,
  GitBranch,
  Layers,
  Loader2,
  Plus,
  RefreshCcw,
  Scissors,
  Trash2,
} from "lucide-react";

import { formatCurrencyFromCents } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type FlashMessage = { tone: "success" | "error"; message: string } | null;

type ComponentNode = {
  productCodeId: number;
  code: string;
  name: string;
  components: {
    childProductCodeId: number;
    code: string;
    name: string;
    qtyRatio: number;
  }[];
};

type VersionNode = {
  productCodeVersionId: number;
  productCodeId: number;
  code: string;
  name: string;
  branchId: number | null;
  branchName: string | null;
  qtyOnHand: number;
  costCents: number | null;
  priceCents: number | null;
  sku: string | null;
};

type ComponentSnapshot = {
  components: ComponentNode[];
  versions: VersionNode[];
};

type ComponentInputLine = {
  id: number;
  childVersionId: number | null;
  qtyPerParent: number;
};

async function fetchComponentSnapshot(): Promise<ComponentSnapshot> {
  const response = await fetch(`${API_BASE_URL}/api/inventory/component-tree`, {
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : "No se pudo cargar la composición";
    throw new Error(message);
  }

  return data as ComponentSnapshot;
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : "Operación no completada";
    throw new Error(message);
  }

  return data as T;
}

function formatBranchName(version: VersionNode | undefined): string {
  if (!version) {
    return "Sucursal desconocida";
  }

  if (version.branchName) {
    return version.branchName;
  }

  if (version.branchId != null) {
    return `Sucursal ${version.branchId}`;
  }

  return "Sucursal no asignada";
}

function formatCost(costCents: number | null): string {
  if (costCents == null) {
    return "—";
  }

  return formatCurrencyFromCents(costCents);
}

function normalizeLines(lines: ComponentInputLine[]) {
  return lines
    .filter((line) => line.childVersionId != null && line.qtyPerParent > 0)
    .map((line) => ({
      childVersionId: line.childVersionId as number,
      quantity: Math.round(line.qtyPerParent),
    }));
}

export default function InventorySplitCombinePage() {
  const [snapshot, setSnapshot] = useState<ComponentSnapshot>({ components: [], versions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashMessage>(null);

  const [splitParentId, setSplitParentId] = useState<number | "">("");
  const [splitQuantity, setSplitQuantity] = useState<number>(1);
  const [splitLines, setSplitLines] = useState<ComponentInputLine[]>([{ id: 0, childVersionId: null, qtyPerParent: 1 }]);
  const [splitSubmitting, setSplitSubmitting] = useState(false);
  const [splitLineCounter, setSplitLineCounter] = useState(1);

  const [combineParentId, setCombineParentId] = useState<number | "">("");
  const [combineQuantity, setCombineQuantity] = useState<number>(1);
  const [combineLines, setCombineLines] = useState<ComponentInputLine[]>([{ id: 0, childVersionId: null, qtyPerParent: 1 }]);
  const [combineSubmitting, setCombineSubmitting] = useState(false);
  const [combineLineCounter, setCombineLineCounter] = useState(1);

  const loadSnapshot = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchComponentSnapshot();
      setSnapshot(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cargar la composición";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const versionsById = useMemo(() => {
    return new Map(snapshot.versions.map((version) => [version.productCodeVersionId, version]));
  }, [snapshot.versions]);

  const branchGroups = useMemo(() => {
    const groups = new Map<number | "sin_sucursal", { label: string; versions: VersionNode[] }>();

    snapshot.versions.forEach((version) => {
      const key = version.branchId ?? "sin_sucursal";
      if (!groups.has(key)) {
        groups.set(key, { label: formatBranchName(version), versions: [] });
      }
      groups.get(key)!.versions.push(version);
    });

    return Array.from(groups.values()).map((entry) => ({
      label: entry.label,
      versions: entry.versions.sort((a, b) => a.code.localeCompare(b.code)),
    }));
  }, [snapshot.versions]);

  const splitParent = typeof splitParentId === "number" ? versionsById.get(splitParentId) : undefined;
  const splitChildCost = useMemo(() => {
    return splitLines.reduce((sum, line) => {
      if (line.childVersionId == null) {
        return sum;
      }
      const child = versionsById.get(line.childVersionId);
      if (!child?.costCents) {
        return sum;
      }
      return sum + child.costCents * line.qtyPerParent;
    }, 0);
  }, [splitLines, versionsById]);

  const splitCostDelta = splitParent?.costCents != null ? Math.abs(splitParent.costCents - splitChildCost) : null;
  const splitCostBalanced = splitCostDelta == null || splitCostDelta <= Math.max(1, splitLines.length);

  const combineParent = typeof combineParentId === "number" ? versionsById.get(combineParentId) : undefined;
  const combineChildCost = useMemo(() => {
    return combineLines.reduce((sum, line) => {
      if (line.childVersionId == null) {
        return sum;
      }
      const child = versionsById.get(line.childVersionId);
      if (!child?.costCents) {
        return sum;
      }
      return sum + child.costCents * line.qtyPerParent;
    }, 0);
  }, [combineLines, versionsById]);

  const combineCostDelta = combineParent?.costCents != null ? Math.abs(combineParent.costCents - combineChildCost) : null;
  const combineCostBalanced = combineCostDelta == null || combineCostDelta <= Math.max(1, combineLines.length);

  const splitChildOptions = useMemo(() => {
    if (!splitParent) {
      return snapshot.versions;
    }
    return snapshot.versions.filter((version) => version.branchId === splitParent.branchId);
  }, [snapshot.versions, splitParent]);

  const combineChildOptions = useMemo(() => {
    if (!combineParent) {
      return snapshot.versions;
    }
    return snapshot.versions.filter((version) => version.branchId === combineParent.branchId);
  }, [snapshot.versions, combineParent]);

  const handleAddSplitLine = () => {
    setSplitLines((lines) => [...lines, { id: splitLineCounter, childVersionId: null, qtyPerParent: 1 }]);
    setSplitLineCounter((value) => value + 1);
  };

  const handleRemoveSplitLine = (id: number) => {
    setSplitLines((lines) => (lines.length === 1 ? lines : lines.filter((line) => line.id !== id)));
  };

  const handleAddCombineLine = () => {
    setCombineLines((lines) => [...lines, { id: combineLineCounter, childVersionId: null, qtyPerParent: 1 }]);
    setCombineLineCounter((value) => value + 1);
  };

  const handleRemoveCombineLine = (id: number) => {
    setCombineLines((lines) => (lines.length === 1 ? lines : lines.filter((line) => line.id !== id)));
  };

  const handleSplitSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (typeof splitParentId !== "number") {
      setFlash({ tone: "error", message: "Selecciona el código que vas a dividir" });
      return;
    }

    const lines = normalizeLines(splitLines);
    if (lines.length === 0) {
      setFlash({ tone: "error", message: "Agrega al menos un componente" });
      return;
    }

    try {
      setSplitSubmitting(true);
      const result = await postJson<ComponentSnapshot & { message?: string }>("/api/inventory/split", {
        parentVersionId: splitParentId,
        quantity: splitQuantity,
        components: lines,
      });
      setSnapshot({ components: result.components, versions: result.versions });
      setFlash({ tone: "success", message: result.message ?? "Split registrado" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo registrar el split";
      setFlash({ tone: "error", message });
    } finally {
      setSplitSubmitting(false);
    }
  };

  const handleCombineSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (typeof combineParentId !== "number") {
      setFlash({ tone: "error", message: "Selecciona el código que vas a combinar" });
      return;
    }

    const lines = normalizeLines(combineLines);
    if (lines.length === 0) {
      setFlash({ tone: "error", message: "Agrega al menos un componente" });
      return;
    }

    try {
      setCombineSubmitting(true);
      const result = await postJson<ComponentSnapshot & { message?: string }>("/api/inventory/combine", {
        parentVersionId: combineParentId,
        quantity: combineQuantity,
        components: lines,
      });
      setSnapshot({ components: result.components, versions: result.versions });
      setFlash({ tone: "success", message: result.message ?? "Combinación registrada" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo registrar la combinación";
      setFlash({ tone: "error", message });
    } finally {
      setCombineSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">Inventory</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Split &amp; combine</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            Divide bundles into sellable componentes o arma kits a partir de piezas individuales mientras conservas el costo por
            unidad. Cada movimiento actualiza la relación en cascada y registra el ajuste en el libro mayor de inventario.
          </p>
        </div>
        <button
          type="button"
          onClick={loadSnapshot}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}Recargar
        </button>
      </header>

      {flash && (
        <div
          className={`mb-6 flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${
            flash.tone === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{flash.message}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <section className="grid gap-8 lg:grid-cols-2">
        <form
          onSubmit={handleSplitSubmit}
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Scissors className="h-5 w-5" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dividir código</h2>
          </div>

          <div className="mt-4 space-y-4 text-sm">
            <label className="block">
              <span className="font-medium text-slate-700 dark:text-slate-200">Código padre</span>
              <select
                value={splitParentId}
                onChange={(event) => {
                  const value = event.target.value ? Number(event.target.value) : "";
                  setSplitParentId(Number.isFinite(value as number) ? value : "");
                }}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">Selecciona el código a dividir</option>
                {branchGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.versions.map((version) => (
                      <option key={version.productCodeVersionId} value={version.productCodeVersionId}>
                        {version.code} · {version.name} · Stock: {version.qtyOnHand}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="font-medium text-slate-700 dark:text-slate-200">Cantidad a dividir</span>
              <input
                type="number"
                min={1}
                value={splitQuantity}
                onChange={(event) => setSplitQuantity(Math.max(1, Number(event.target.value) || 1))}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            <div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-200">Componentes resultantes</span>
                <button
                  type="button"
                  onClick={handleAddSplitLine}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Plus className="h-3 w-3" />Agregar línea
                </button>
              </div>
              <div className="mt-2 space-y-3">
                {splitLines.map((line) => (
                  <div key={line.id} className="grid grid-cols-7 gap-3">
                    <select
                      value={line.childVersionId ?? ""}
                      onChange={(event) => {
                        const value = event.target.value ? Number(event.target.value) : null;
                        setSplitLines((lines) =>
                          lines.map((current) =>
                            current.id === line.id ? { ...current, childVersionId: value } : current,
                          ),
                        );
                      }}
                      className="col-span-5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="">Selecciona variante</option>
                      {splitChildOptions.map((option) => (
                        <option key={option.productCodeVersionId} value={option.productCodeVersionId}>
                          {option.code} · {option.name} · Stock: {option.qtyOnHand}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={line.qtyPerParent}
                      onChange={(event) => {
                        const value = Math.max(1, Number(event.target.value) || 1);
                        setSplitLines((lines) =>
                          lines.map((current) =>
                            current.id === line.id ? { ...current, qtyPerParent: value } : current,
                          ),
                        );
                      }}
                      className="col-span-1 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSplitLine(line.id)}
                      className="col-span-1 inline-flex items-center justify-center rounded-md border border-slate-300 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <p className="flex items-center gap-2 font-medium">
                <GitBranch className="h-3.5 w-3.5" /> Balance de costo
              </p>
              <p className="mt-1">
                Padre: <strong>{formatCost(splitParent?.costCents ?? null)}</strong> · Componentes: <strong>{formatCost(splitChildCost)}</strong>
              </p>
              {splitCostDelta != null && (
                <p className={splitCostBalanced ? "mt-1 text-emerald-600 dark:text-emerald-300" : "mt-1 text-rose-600 dark:text-rose-300"}>
                  Diferencia: {formatCurrencyFromCents(splitCostDelta)} {splitCostBalanced ? "(dentro del margen de redondeo)" : "→ revisa los costos"}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-400"
            disabled={splitSubmitting}
          >
            {splitSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}Registrar split
          </button>
        </form>

        <form
          onSubmit={handleCombineSubmit}
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Layers className="h-5 w-5" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Combinar en kit</h2>
          </div>

          <div className="mt-4 space-y-4 text-sm">
            <label className="block">
              <span className="font-medium text-slate-700 dark:text-slate-200">Código destino</span>
              <select
                value={combineParentId}
                onChange={(event) => {
                  const value = event.target.value ? Number(event.target.value) : "";
                  setCombineParentId(Number.isFinite(value as number) ? value : "");
                }}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">Selecciona el código resultante</option>
                {branchGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.versions.map((version) => (
                      <option key={version.productCodeVersionId} value={version.productCodeVersionId}>
                        {version.code} · {version.name} · Stock: {version.qtyOnHand}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="font-medium text-slate-700 dark:text-slate-200">Cantidad a producir</span>
              <input
                type="number"
                min={1}
                value={combineQuantity}
                onChange={(event) => setCombineQuantity(Math.max(1, Number(event.target.value) || 1))}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            <div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-200">Componentes necesarios</span>
                <button
                  type="button"
                  onClick={handleAddCombineLine}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Plus className="h-3 w-3" />Agregar línea
                </button>
              </div>
              <div className="mt-2 space-y-3">
                {combineLines.map((line) => (
                  <div key={line.id} className="grid grid-cols-7 gap-3">
                    <select
                      value={line.childVersionId ?? ""}
                      onChange={(event) => {
                        const value = event.target.value ? Number(event.target.value) : null;
                        setCombineLines((lines) =>
                          lines.map((current) =>
                            current.id === line.id ? { ...current, childVersionId: value } : current,
                          ),
                        );
                      }}
                      className="col-span-5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="">Selecciona variante</option>
                      {combineChildOptions.map((option) => (
                        <option key={option.productCodeVersionId} value={option.productCodeVersionId}>
                          {option.code} · {option.name} · Stock: {option.qtyOnHand}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={line.qtyPerParent}
                      onChange={(event) => {
                        const value = Math.max(1, Number(event.target.value) || 1);
                        setCombineLines((lines) =>
                          lines.map((current) =>
                            current.id === line.id ? { ...current, qtyPerParent: value } : current,
                          ),
                        );
                      }}
                      className="col-span-1 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCombineLine(line.id)}
                      className="col-span-1 inline-flex items-center justify-center rounded-md border border-slate-300 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <p className="flex items-center gap-2 font-medium">
                <ArrowRightLeft className="h-3.5 w-3.5" /> Balance de costo
              </p>
              <p className="mt-1">
                Resultado: <strong>{formatCost(combineParent?.costCents ?? null)}</strong> · Componentes: <strong>{formatCost(combineChildCost)}</strong>
              </p>
              {combineCostDelta != null && (
                <p
                  className={
                    combineCostBalanced ? "mt-1 text-emerald-600 dark:text-emerald-300" : "mt-1 text-rose-600 dark:text-rose-300"
                  }
                >
                  Diferencia: {formatCurrencyFromCents(combineCostDelta)} {combineCostBalanced ? "(dentro del margen de redondeo)" : "→ revisa los costos"}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-400"
            disabled={combineSubmitting}
          >
            {combineSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}Registrar combinación
          </button>
        </form>
      </section>

      <section className="mt-10 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <GitBranch className="h-5 w-5" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Relaciones registradas</h2>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Consulta cómo se descompone cada código o cuáles componentes se combinan para formar un kit. Las proporciones se
          aplican en cada movimiento posterior.
        </p>

        <div className="mt-4 space-y-4">
          {snapshot.components.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Aún no se han registrado relaciones de split/combine.</p>
          ) : (
            snapshot.components.map((node) => (
              <div key={node.productCodeId} className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {node.code} · {node.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatBranchName(snapshot.versions.find((version) => version.productCodeId === node.productCodeId))}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {node.components.length} componente(s)
                  </span>
                </div>
                {node.components.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {node.components.map((component) => (
                      <li key={component.childProductCodeId} className="flex items-center justify-between rounded-md bg-white px-3 py-2 shadow-sm dark:bg-slate-950">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-100">
                            {component.code} · {component.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Ratio: {component.qtyRatio}
                          </p>
                        </div>
                        <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">x{component.qtyRatio}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Sin componentes asociados.</p>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
