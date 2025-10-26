"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";

import {
  ArrowDownToLine,
  ArrowRightLeft,
  ClipboardCheck,
  ClipboardList,
  PackageSearch,
  ShieldAlert,
  Truck,
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type FlashMessage = { tone: "success" | "error"; message: string } | null;

type CountSessionLine = {
  id: number;
  productCodeVersionId: number;
  productCodeId: number;
  code: string;
  name: string;
  sku: string | null;
  expectedQty: number;
  countedQty: number;
  variance: number;
  status: string;
  createdAt: string | null;
};

type CountSessionDetail = {
  session: {
    id: number;
    branchId: number;
    branchName: string | null;
    scope: string;
    status: string;
    snapshotAt: string | null;
    createdBy: number;
    postedBy: number | null;
    postedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  lines: CountSessionLine[];
  totals: {
    totalLines: number;
    expectedQty: number;
    countedQty: number;
    totalVariance: number;
    varianceCount: number;
  };
};

type TransferLine = {
  id: number;
  productCodeVersionId: number;
  productCodeId: number;
  code: string;
  name: string;
  sku: string | null;
  branchId: number;
  qty: number;
};

type TransferDetail = {
  transfer: {
    id: number;
    fromBranchId: number;
    fromBranchName: string | null;
    toBranchId: number;
    toBranchName: string | null;
    status: string;
    createdBy: number;
    approvedBy: number | null;
    shippedBy: number | null;
    receivedBy: number | null;
    shippedAt: string | null;
    receivedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  lines: TransferLine[];
  summary: {
    totalLines: number;
    totalQty: number;
  };
};

type QuarantineEntry = {
  id: number;
  branchId: number;
  branchName: string | null;
  productCodeVersionId: number;
  productCodeId: number;
  code: string;
  name: string;
  sku: string | null;
  qty: number;
  reason: string | null;
  status: string;
  outcome: string | null;
  createdBy: number | null;
  resolvedBy: number | null;
  createdAt: string | null;
  resolvedAt: string | null;
};

async function postJson(path: string, payload: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : "La solicitud no pudo completarse.";
    throw new Error(message);
  }

  return data;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const defaultCountForm = { branchId: "", scope: "cycle", createdBy: "" };
const defaultCountScanForm = {
  sessionId: "",
  productCodeVersionId: "",
  countedQty: "1",
  mode: "add" as "add" | "set",
};

const defaultTransferForm = { fromBranchId: "", toBranchId: "", createdBy: "" };

const defaultQuarantineQueue = {
  branchId: "",
  productCodeVersionId: "",
  qty: "1",
  reason: "",
  createdBy: "",
};

const defaultQuarantineResolve = {
  quarantineId: "",
  outcome: "return" as "return" | "dispose",
  resolvedBy: "",
};

type TransferLineInput = { productCodeVersionId: string; qty: string };

export default function InventoryOpsPage() {
  const [countForm, setCountForm] = useState(defaultCountForm);
  const [countScanForm, setCountScanForm] = useState(defaultCountScanForm);
  const [countSession, setCountSession] = useState<CountSessionDetail | null>(null);
  const [countMessage, setCountMessage] = useState<FlashMessage>(null);

  const [transferForm, setTransferForm] = useState(defaultTransferForm);
  const [transferLines, setTransferLines] = useState<TransferLineInput[]>([
    { productCodeVersionId: "", qty: "1" },
  ]);
  const [transferDetail, setTransferDetail] = useState<TransferDetail | null>(null);
  const [transferMessage, setTransferMessage] = useState<FlashMessage>(null);
  const [approveForm, setApproveForm] = useState({ transferId: "", approvedBy: "" });
  const [shipForm, setShipForm] = useState({ transferId: "", shippedBy: "" });
  const [receiveForm, setReceiveForm] = useState({ transferId: "", receivedBy: "" });

  const [quarantineQueueForm, setQuarantineQueueForm] = useState(defaultQuarantineQueue);
  const [quarantineResolveForm, setQuarantineResolveForm] = useState(defaultQuarantineResolve);
  const [quarantineEntry, setQuarantineEntry] = useState<QuarantineEntry | null>(null);
  const [quarantineMessage, setQuarantineMessage] = useState<FlashMessage>(null);

  const handleCountSession = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setCountMessage(null);

      try {
        const payload = {
          branchId: Number(countForm.branchId),
          scope: countForm.scope,
          createdBy: Number(countForm.createdBy),
        };

        const detail = (await postJson("/api/inventory/count-sessions", payload)) as CountSessionDetail;
        setCountSession(detail);
        setCountScanForm((prev) => ({
          ...prev,
          sessionId: String(detail.session.id),
        }));
        setCountMessage({ tone: "success", message: "Conteo iniciado correctamente." });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo iniciar el conteo.";
        setCountMessage({ tone: "error", message });
      }
    },
    [countForm]
  );

  const handleCountLine = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setCountMessage(null);

      try {
        const payload = {
          sessionId: Number(countScanForm.sessionId),
          productCodeVersionId: Number(countScanForm.productCodeVersionId),
          countedQty: Number(countScanForm.countedQty || "0"),
          mode: countScanForm.mode,
        };

        const detail = (await postJson("/api/inventory/count-lines", payload)) as CountSessionDetail;
        setCountSession(detail);
        setCountMessage({ tone: "success", message: "Línea registrada." });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo registrar la línea.";
        setCountMessage({ tone: "error", message });
      }
    },
    [countScanForm]
  );

  const handleCountPost = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setCountMessage(null);

      try {
        const payload = {
          sessionId: Number(countScanForm.sessionId || countSession?.session.id || 0),
          postedBy: countForm.createdBy ? Number(countForm.createdBy) : undefined,
        };

        const detail = (await postJson("/api/inventory/count-post", payload)) as CountSessionDetail;
        setCountSession(detail);
        setCountMessage({ tone: "success", message: "Conteo contabilizado." });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo contabilizar el conteo.";
        setCountMessage({ tone: "error", message });
      }
    },
    [countForm.createdBy, countScanForm.sessionId, countSession?.session.id]
  );

  const handleAddTransferLine = useCallback(() => {
    setTransferLines((prev) => [...prev, { productCodeVersionId: "", qty: "1" }]);
  }, []);

  const handleRemoveTransferLine = useCallback((index: number) => {
    setTransferLines((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleTransferCreate = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setTransferMessage(null);

      try {
        const lines = transferLines
          .map((line) => ({
            productCodeVersionId: Number(line.productCodeVersionId),
            qty: Number(line.qty || "0"),
          }))
          .filter((line) => Number.isFinite(line.productCodeVersionId) && line.productCodeVersionId > 0 && line.qty > 0);

        const payload = {
          fromBranchId: Number(transferForm.fromBranchId),
          toBranchId: Number(transferForm.toBranchId),
          createdBy: Number(transferForm.createdBy),
          lines,
        };

        const detail = (await postJson("/api/inventory/transfers", payload)) as TransferDetail;
        setTransferDetail(detail);
        setApproveForm({ transferId: String(detail.transfer.id), approvedBy: transferForm.createdBy });
        setShipForm({ transferId: String(detail.transfer.id), shippedBy: transferForm.createdBy });
        setReceiveForm({ transferId: String(detail.transfer.id), receivedBy: transferForm.createdBy });
        setTransferMessage({ tone: "success", message: "Transferencia creada." });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo crear la transferencia.";
        setTransferMessage({ tone: "error", message });
      }
    },
    [transferForm, transferLines]
  );

  const handleTransferAction = useCallback(
    async (path: string, payload: Record<string, number>) => {
      const detail = (await postJson(path, payload)) as TransferDetail;
      setTransferDetail(detail);
      setTransferMessage({ tone: "success", message: "Transferencia actualizada." });
    },
    []
  );

  const handleApprove = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setTransferMessage(null);
      try {
        await handleTransferAction("/api/inventory/transfers/approve", {
          transferId: Number(approveForm.transferId),
          approvedBy: Number(approveForm.approvedBy),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo aprobar la transferencia.";
        setTransferMessage({ tone: "error", message });
      }
    },
    [approveForm, handleTransferAction]
  );

  const handleShip = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setTransferMessage(null);
      try {
        await handleTransferAction("/api/inventory/transfers/ship", {
          transferId: Number(shipForm.transferId),
          shippedBy: Number(shipForm.shippedBy),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo despachar la transferencia.";
        setTransferMessage({ tone: "error", message });
      }
    },
    [handleTransferAction, shipForm]
  );

  const handleReceive = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setTransferMessage(null);
      try {
        await handleTransferAction("/api/inventory/transfers/receive", {
          transferId: Number(receiveForm.transferId),
          receivedBy: Number(receiveForm.receivedBy),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo recibir la transferencia.";
        setTransferMessage({ tone: "error", message });
      }
    },
    [handleTransferAction, receiveForm]
  );

  const handleQuarantineQueue = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setQuarantineMessage(null);

      try {
        const payload = {
          branchId: Number(quarantineQueueForm.branchId),
          productCodeVersionId: Number(quarantineQueueForm.productCodeVersionId),
          qty: Number(quarantineQueueForm.qty || "0"),
          reason: quarantineQueueForm.reason.trim() || undefined,
          createdBy: quarantineQueueForm.createdBy ? Number(quarantineQueueForm.createdBy) : undefined,
        };

        const response = (await postJson("/api/inventory/quarantine/queue", payload)) as {
          quarantine: QuarantineEntry;
        };

        setQuarantineEntry(response.quarantine);
        setQuarantineResolveForm((prev) => ({
          ...prev,
          quarantineId: String(response.quarantine.id),
        }));
        setQuarantineMessage({ tone: "success", message: "Producto enviado a cuarentena." });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo enviar a cuarentena.";
        setQuarantineMessage({ tone: "error", message });
      }
    },
    [quarantineQueueForm]
  );

  const handleQuarantineResolve = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setQuarantineMessage(null);

      try {
        const payload = {
          quarantineId: Number(quarantineResolveForm.quarantineId),
          outcome: quarantineResolveForm.outcome,
          resolvedBy: quarantineResolveForm.resolvedBy ? Number(quarantineResolveForm.resolvedBy) : undefined,
        };

        const response = (await postJson("/api/inventory/quarantine/resolve", payload)) as {
          quarantine: QuarantineEntry;
        };

        setQuarantineEntry(response.quarantine);
        setQuarantineMessage({ tone: "success", message: "Cuarentena actualizada." });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo resolver la cuarentena.";
        setQuarantineMessage({ tone: "error", message });
      }
    },
    [quarantineResolveForm]
  );

  const countVarianceTone = useMemo(() => {
    if (!countSession) return "text-muted-foreground";
    const variance = countSession.totals.totalVariance;
    if (variance === 0) return "text-emerald-600";
    return variance > 0 ? "text-amber-600" : "text-rose-600";
  }, [countSession]);

  return (
    <div className="space-y-10 p-6">
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <header className="flex items-center gap-3 border-b border-border px-6 py-4">
          <ClipboardList className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Conteos de Inventario</h1>
            <p className="text-sm text-muted-foreground">
              Inicia sesiones de conteo, registra lecturas y contabiliza los ajustes.
            </p>
          </div>
        </header>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-3">
          <form onSubmit={handleCountSession} className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <PackageSearch className="h-4 w-4" />
              Iniciar sesión
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Sucursal</label>
              <input
                required
                type="number"
                value={countForm.branchId}
                onChange={(event) => setCountForm((prev) => ({ ...prev, branchId: event.target.value }))}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Ámbito</label>
              <select
                value={countForm.scope}
                onChange={(event) => setCountForm((prev) => ({ ...prev, scope: event.target.value }))}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="cycle">Cíclico</option>
                <option value="full">Completo</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Usuario</label>
              <input
                required
                type="number"
                value={countForm.createdBy}
                onChange={(event) => setCountForm((prev) => ({ ...prev, createdBy: event.target.value }))}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Crear sesión
            </button>
          </form>

          <form onSubmit={handleCountLine} className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ClipboardCheck className="h-4 w-4" />
              Registrar lecturas
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Sesión</label>
              <input
                required
                type="number"
                value={countScanForm.sessionId}
                onChange={(event) => setCountScanForm((prev) => ({ ...prev, sessionId: event.target.value }))}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Versión de producto</label>
              <input
                required
                type="number"
                value={countScanForm.productCodeVersionId}
                onChange={(event) =>
                  setCountScanForm((prev) => ({ ...prev, productCodeVersionId: event.target.value }))
                }
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Cantidad</label>
                <input
                  min={0}
                  type="number"
                  value={countScanForm.countedQty}
                  onChange={(event) => setCountScanForm((prev) => ({ ...prev, countedQty: event.target.value }))}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Modo</label>
                <select
                  value={countScanForm.mode}
                  onChange={(event) =>
                    setCountScanForm((prev) => ({ ...prev, mode: event.target.value as "add" | "set" }))
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="add">Sumar</option>
                  <option value="set">Reemplazar</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Registrar línea
            </button>
          </form>

          <form onSubmit={handleCountPost} className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ArrowDownToLine className="h-4 w-4" />
              Contabilizar sesión
            </div>
            <p className="text-sm text-muted-foreground">
              Se ajustarán las existencias y se guardará el asiento del conteo.
            </p>
            <button
              type="submit"
              className="w-full rounded-md border border-primary/60 bg-background px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              Contabilizar conteo
            </button>
          </form>
        </div>

        {countMessage && (
          <div
            className={`border-t px-6 py-4 text-sm ${
              countMessage.tone === "success" ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {countMessage.message}
          </div>
        )}

        {countSession && (
          <div className="border-t border-border px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">
                  Sesión #{countSession.session.id} · {countSession.session.branchName ?? `Sucursal ${countSession.session.branchId}`}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Estado: <span className="font-medium text-foreground">{countSession.session.status}</span>
                </p>
              </div>
              <div className={`text-right text-sm font-semibold ${countVarianceTone}`}>
                Variación total: {formatNumber(countSession.totals.totalVariance)} uds
                <p className="text-xs text-muted-foreground">
                  Esperado: {formatNumber(countSession.totals.expectedQty)} · Contado: {" "}
                  {formatNumber(countSession.totals.countedQty)}
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Código</th>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-right">Esperado</th>
                    <th className="px-3 py-2 text-right">Contado</th>
                    <th className="px-3 py-2 text-right">Variación</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-left">Registrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {countSession.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2 font-mono text-xs">{line.code}</td>
                      <td className="px-3 py-2">{line.name}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(line.expectedQty)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(line.countedQty)}</td>
                      <td
                        className={`px-3 py-2 text-right ${
                          line.variance === 0
                            ? "text-muted-foreground"
                            : line.variance > 0
                            ? "text-amber-600"
                            : "text-rose-600"
                        }`}
                      >
                        {formatNumber(line.variance)}
                      </td>
                      <td className="px-3 py-2 capitalize text-muted-foreground">{line.status}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDateTime(line.createdAt)}</td>
                    </tr>
                  ))}
                  {countSession.lines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">
                        Sin líneas registradas todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <header className="flex items-center gap-3 border-b border-border px-6 py-4">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Transferencias entre sucursales</h2>
            <p className="text-sm text-muted-foreground">
              Crea, aprueba y da seguimiento a movimientos entre tiendas.
            </p>
          </div>
        </header>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-2">
          <form onSubmit={handleTransferCreate} className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Truck className="h-4 w-4" />
              Nueva transferencia
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Origen</label>
                <input
                  required
                  type="number"
                  value={transferForm.fromBranchId}
                  onChange={(event) => setTransferForm((prev) => ({ ...prev, fromBranchId: event.target.value }))}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Destino</label>
                <input
                  required
                  type="number"
                  value={transferForm.toBranchId}
                  onChange={(event) => setTransferForm((prev) => ({ ...prev, toBranchId: event.target.value }))}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Creado por</label>
              <input
                required
                type="number"
                value={transferForm.createdBy}
                onChange={(event) => setTransferForm((prev) => ({ ...prev, createdBy: event.target.value }))}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                <span>Líneas a mover</span>
                <button
                  type="button"
                  onClick={handleAddTransferLine}
                  className="text-primary hover:underline"
                >
                  Agregar
                </button>
              </div>
              {transferLines.map((line, index) => (
                <div key={`${index}-${line.productCodeVersionId}`} className="grid grid-cols-7 items-end gap-2">
                  <div className="col-span-4 space-y-1">
                    <label className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Versión
                    </label>
                    <input
                      required
                      type="number"
                      value={line.productCodeVersionId}
                      onChange={(event) =>
                        setTransferLines((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, productCodeVersionId: event.target.value } : item
                          )
                        )
                      }
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Cantidad
                    </label>
                    <input
                      min={1}
                      type="number"
                      value={line.qty}
                      onChange={(event) =>
                        setTransferLines((prev) =>
                          prev.map((item, idx) => (idx === index ? { ...item, qty: event.target.value } : item))
                        )
                      }
                      className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTransferLine(index)}
                    className="rounded border border-border bg-background px-2 py-2 text-xs text-muted-foreground hover:text-foreground"
                    aria-label="Eliminar línea"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Crear transferencia
            </button>
          </form>

          <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldAlert className="h-4 w-4" />
              Acciones
            </div>

            <form onSubmit={handleApprove} className="grid grid-cols-[2fr,2fr,auto] items-end gap-2 text-sm">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Transferencia</label>
                <input
                  required
                  type="number"
                  value={approveForm.transferId}
                  onChange={(event) => setApproveForm((prev) => ({ ...prev, transferId: event.target.value }))}
                  className="w-full rounded border border-border bg-background px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Aprobado por</label>
                <input
                  required
                  type="number"
                  value={approveForm.approvedBy}
                  onChange={(event) => setApproveForm((prev) => ({ ...prev, approvedBy: event.target.value }))}
                  className="w-full rounded border border-border bg-background px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="rounded bg-primary px-3 py-2 font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Aprobar
              </button>
            </form>

            <form onSubmit={handleShip} className="grid grid-cols-[2fr,2fr,auto] items-end gap-2 text-sm">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Transferencia</label>
                <input
                  required
                  type="number"
                  value={shipForm.transferId}
                  onChange={(event) => setShipForm((prev) => ({ ...prev, transferId: event.target.value }))}
                  className="w-full rounded border border-border bg-background px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Despachado por</label>
                <input
                  required
                  type="number"
                  value={shipForm.shippedBy}
                  onChange={(event) => setShipForm((prev) => ({ ...prev, shippedBy: event.target.value }))}
                  className="w-full rounded border border-border bg-background px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="rounded bg-primary px-3 py-2 font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Despachar
              </button>
            </form>

            <form onSubmit={handleReceive} className="grid grid-cols-[2fr,2fr,auto] items-end gap-2 text-sm">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Transferencia</label>
                <input
                  required
                  type="number"
                  value={receiveForm.transferId}
                  onChange={(event) => setReceiveForm((prev) => ({ ...prev, transferId: event.target.value }))}
                  className="w-full rounded border border-border bg-background px-3 py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Recibido por</label>
                <input
                  required
                  type="number"
                  value={receiveForm.receivedBy}
                  onChange={(event) => setReceiveForm((prev) => ({ ...prev, receivedBy: event.target.value }))}
                  className="w-full rounded border border-border bg-background px-3 py-2"
                />
              </div>
              <button
                type="submit"
                className="rounded bg-primary px-3 py-2 font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Recibir
              </button>
            </form>
          </div>
        </div>

        {transferMessage && (
          <div
            className={`border-t px-6 py-4 text-sm ${
              transferMessage.tone === "success" ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {transferMessage.message}
          </div>
        )}

        {transferDetail && (
          <div className="border-t border-border px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">Transferencia #{transferDetail.transfer.id}</h3>
                <p className="text-sm text-muted-foreground">
                  {transferDetail.transfer.fromBranchName ?? `Origen ${transferDetail.transfer.fromBranchId}`} → {" "}
                  {transferDetail.transfer.toBranchName ?? `Destino ${transferDetail.transfer.toBranchId}`}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold text-foreground">Estado: {transferDetail.transfer.status}</p>
                <p className="text-muted-foreground">
                  Líneas: {transferDetail.summary.totalLines} · Cantidad total: {transferDetail.summary.totalQty}
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Código</th>
                    <th className="px-3 py-2 text-left">Descripción</th>
                    <th className="px-3 py-2 text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transferDetail.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2 font-mono text-xs">{line.code}</td>
                      <td className="px-3 py-2">{line.name}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(line.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <header className="flex items-center gap-3 border-b border-border px-6 py-4">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Cuarentena y control de calidad</h2>
            <p className="text-sm text-muted-foreground">
              Saca productos sospechosos del piso de ventas y regresa los validados.
            </p>
          </div>
        </header>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-2">
          <form onSubmit={handleQuarantineQueue} className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ClipboardList className="h-4 w-4" />
              Enviar a cuarentena
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Sucursal</label>
                <input
                  required
                  type="number"
                  value={quarantineQueueForm.branchId}
                  onChange={(event) =>
                    setQuarantineQueueForm((prev) => ({ ...prev, branchId: event.target.value }))
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Versión</label>
                <input
                  required
                  type="number"
                  value={quarantineQueueForm.productCodeVersionId}
                  onChange={(event) =>
                    setQuarantineQueueForm((prev) => ({ ...prev, productCodeVersionId: event.target.value }))
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Cantidad</label>
                <input
                  min={1}
                  type="number"
                  value={quarantineQueueForm.qty}
                  onChange={(event) => setQuarantineQueueForm((prev) => ({ ...prev, qty: event.target.value }))}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Usuario</label>
                <input
                  type="number"
                  value={quarantineQueueForm.createdBy}
                  onChange={(event) => setQuarantineQueueForm((prev) => ({ ...prev, createdBy: event.target.value }))}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Motivo</label>
              <textarea
                value={quarantineQueueForm.reason}
                onChange={(event) => setQuarantineQueueForm((prev) => ({ ...prev, reason: event.target.value }))}
                className="h-20 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Enviar a cuarentena
            </button>
          </form>

          <form onSubmit={handleQuarantineResolve} className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ClipboardCheck className="h-4 w-4" />
              Resolver cuarentena
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Entrada</label>
              <input
                required
                type="number"
                value={quarantineResolveForm.quarantineId}
                onChange={(event) =>
                  setQuarantineResolveForm((prev) => ({ ...prev, quarantineId: event.target.value }))
                }
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Resultado</label>
                <select
                  value={quarantineResolveForm.outcome}
                  onChange={(event) =>
                    setQuarantineResolveForm((prev) => ({ ...prev, outcome: event.target.value as "return" | "dispose" }))
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="return">Regresar a stock</option>
                  <option value="dispose">Descartar</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Gestionado por</label>
                <input
                  type="number"
                  value={quarantineResolveForm.resolvedBy}
                  onChange={(event) =>
                    setQuarantineResolveForm((prev) => ({ ...prev, resolvedBy: event.target.value }))
                  }
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-md border border-primary/60 bg-background px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              Resolver
            </button>
          </form>
        </div>

        {quarantineMessage && (
          <div
            className={`border-t px-6 py-4 text-sm ${
              quarantineMessage.tone === "success" ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {quarantineMessage.message}
          </div>
        )}

        {quarantineEntry && (
          <div className="border-t border-border px-6 py-6 text-sm">
            <h3 className="text-base font-semibold">
              Entrada #{quarantineEntry.id} · {quarantineEntry.code} - {quarantineEntry.name}
            </h3>
            <p className="text-muted-foreground">
              Sucursal: {quarantineEntry.branchName ?? quarantineEntry.branchId} · Cantidad: {formatNumber(quarantineEntry.qty)} ·
              Estado: <span className="font-medium text-foreground">{quarantineEntry.status}</span> · Resultado:
              <span className="font-medium text-foreground"> {quarantineEntry.outcome ?? "pendiente"}</span>
            </p>
            {quarantineEntry.reason && (
              <p className="mt-2 rounded bg-muted/50 px-4 py-2 text-muted-foreground">{quarantineEntry.reason}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Creado: {formatDateTime(quarantineEntry.createdAt)} · Resuelto: {formatDateTime(quarantineEntry.resolvedAt)}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
