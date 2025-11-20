"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AlertTriangle, Archive, Boxes, Clock3, Factory, Loader2, PackageSearch } from "lucide-react";

import { formatCurrencyFromCents, formatDateTimeForDisplay } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type DashboardMetrics = {
  totalStockValueCents: number;
  activeCountSessions: number;
  branchesWithStock: number;
  lowStockSkus: number;
};

type LowStockItem = {
  productCodeVersionId: number;
  productCodeId: number;
  code: string;
  name: string;
  branchId: number | null;
  branchName: string | null;
  qtyOnHand: number;
  qtyReserved: number;
  availableQty: number;
};

type MovementEntry = {
  id: number;
  reason: string;
  qtyChange: number;
  createdAt: string | null;
  code: string;
  name: string;
  branchId: number | null;
  branchName: string | null;
};

type CountSession = {
  id: number;
  branchId: number | null;
  branchName: string | null;
  scope: string;
  status: string;
  snapshotAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type DashboardPayload = {
  metrics: DashboardMetrics;
  lowStock: LowStockItem[];
  movementsToday: MovementEntry[];
  countSessions: CountSession[];
};

type MetricCardProps = {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "default" | "warning";
};

function MetricCard({ label, value, icon, tone = "default" }: MetricCardProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm ${
        tone === "warning"
          ? "border-amber-200 bg-amber-50/60 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100"
          : "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
      }`}
    >
      <div className="rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-100">{icon}</div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
        <span className="text-xl font-bold">{value}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = useMemo(() => {
    if (["open", "draft", "in_progress"].includes(status)) return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100";
    if (["review"].includes(status)) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100";
    if (["posted", "closed"].includes(status)) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100";
    if (["cancelled"].includes(status)) return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-100";
    return "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200";
  }, [status]);

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}

export default function InventoryOpsDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/inventory/ops/dashboard`);
        const payload = (await response.json().catch(() => ({}))) as Partial<DashboardPayload> & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo cargar el tablero de inventario.");
        }

        setData({
          metrics: payload.metrics ?? {
            totalStockValueCents: 0,
            activeCountSessions: 0,
            branchesWithStock: 0,
            lowStockSkus: 0,
          },
          lowStock: payload.lowStock ?? [],
          movementsToday: payload.movementsToday ?? [],
          countSessions: payload.countSessions ?? [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar el tablero de inventario.");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">OPS dashboard</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Estado operacional de inventario: valor, alertas de stock, movimientos del día y conteos activos.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando tablero...
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      ) : data ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Valor total de stock"
              value={formatCurrencyFromCents(data.metrics.totalStockValueCents)}
              icon={<Archive className="h-5 w-5" />}
            />
            <MetricCard
              label="Conteos activos"
              value={`${data.metrics.activeCountSessions}`}
              icon={<Clock3 className="h-5 w-5" />}
            />
            <MetricCard
              label="Sucursales con stock"
              value={`${data.metrics.branchesWithStock}`}
              icon={<Factory className="h-5 w-5" />}
            />
            <MetricCard
              label="Alertas de stock"
              value={`${data.metrics.lowStockSkus}`}
              icon={<PackageSearch className="h-5 w-5" />}
              tone={data.metrics.lowStockSkus > 0 ? "warning" : "default"}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Alertas de stock bajo</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Productos con disponibilidad agotada o en cero.</p>
                </div>
                <Boxes className="h-5 w-5 text-amber-500" />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3">Sucursal</th>
                      <th className="px-4 py-3 text-right">Disponible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {data.lowStock.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                          Sin alertas de stock bajo.
                        </td>
                      </tr>
                    ) : (
                      data.lowStock.map((item) => (
                        <tr key={`${item.productCodeVersionId}-${item.branchId}`} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/60">
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{item.code}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.name}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {item.branchName ?? (item.branchId ? `Sucursal #${item.branchId}` : "—")}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-300">
                            {item.availableQty} ({item.qtyOnHand} en stock, {item.qtyReserved} reservados)
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Movimientos de hoy</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Entradas y salidas registradas en el libro de stock.</p>
                </div>
                <Archive className="h-5 w-5 text-slate-500" />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Hora</th>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3">Motivo</th>
                      <th className="px-4 py-3 text-right">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {data.movementsToday.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                          Sin movimientos hoy.
                        </td>
                      </tr>
                    ) : (
                      data.movementsToday.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {formatDateTimeForDisplay(entry.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                            <div className="font-semibold">{entry.code}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{entry.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {entry.branchName ?? (entry.branchId ? `Sucursal #${entry.branchId}` : "—")}
                            </div>
                          </td>
                          <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-200">{entry.reason.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">{entry.qtyChange}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Historial de conteos</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">Sesiones de conteo abiertas, en revisión o ya publicadas.</p>
              </div>
              <Clock3 className="h-5 w-5 text-slate-500" />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Sesión</th>
                    <th className="px-4 py-3">Alcance</th>
                    <th className="px-4 py-3">Sucursal</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Creado</th>
                    <th className="px-4 py-3">Última act.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {data.countSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                        Sin sesiones de conteo registradas.
                      </td>
                    </tr>
                  ) : (
                    data.countSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">#{session.id}</td>
                        <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-200">{session.scope.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {session.branchName ?? (session.branchId ? `Sucursal #${session.branchId}` : "—")}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={session.status} /></td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {formatDateTimeForDisplay(session.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {formatDateTimeForDisplay(session.updatedAt ?? session.snapshotAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
