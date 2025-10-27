import Link from "next/link";

import { ArrowRight, PackagePlus, RefreshCcw, RotateCcw, TrendingUp } from "lucide-react";

import { formatCurrencyFromCents } from "@/lib/utils";

type PurchaseMetric = {
  totalCostCents: number;
  totalQuantity: number;
  count: number;
};

type SupplierSummary = {
  supplierName: string;
  totalCostCents: number;
  totalQuantity: number;
  purchaseCount: number;
};

type PurchaseSummary = {
  id: number;
  branchId: number;
  supplierName: string | null;
  supplierInvoice: string | null;
  referenceNo: string | null;
  receivedAt: string | null;
  createdAt: string | null;
  totalCostCents: number;
  totalQuantity: number;
};

type ReturnSummary = {
  id: number;
  purchaseId: number;
  supplierName: string | null;
  totalCostCents: number;
  totalQuantity: number;
  createdAt: string | null;
};

type PurchasesOverviewResponse = {
  metrics: {
    today: PurchaseMetric;
    week: PurchaseMetric;
    month: PurchaseMetric;
  };
  recentPurchases: PurchaseSummary[];
  topSuppliers: SupplierSummary[];
  recentReturns: ReturnSummary[];
  credits: {
    totalOutstandingCents: number;
    creditCount: number;
  };
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export const revalidate = 0;

const numberFormatter = new Intl.NumberFormat("es-DO");

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchPurchasesOverview(): Promise<PurchasesOverviewResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/purchases/overview`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as PurchasesOverviewResponse;
  } catch (error) {
    console.error("Failed to load purchases overview", error);
    return null;
  }
}

function MetricCard({ label, metric }: { label: string; metric: PurchaseMetric }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-lg dark:shadow-slate-950/30">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrencyFromCents(metric.totalCostCents)}</p>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span>{metric.count} recibos</span>
        <span>{numberFormatter.format(metric.totalQuantity)} unidades</span>
      </div>
    </div>
  );
}

export default async function PurchasesOverviewPage() {
  const overview = await fetchPurchasesOverview();

  return (
    <main className="space-y-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <TrendingUp className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Compras a suplidores</span>
        </div>
        <h1 className="text-3xl font-semibold text-foreground dark:text-white">Resumen de abastecimiento</h1>
        <p className="max-w-3xl text-sm text-muted-foreground dark:text-slate-400">
          Analiza el ritmo de recepción, identifica a los suplidores con mayor impacto y accede rápidamente a los flujos de
          nuevas compras o devoluciones.
        </p>
      </header>

      {overview ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Hoy" metric={overview.metrics.today} />
            <MetricCard label="Últimos 7 días" metric={overview.metrics.week} />
            <MetricCard label="Este mes" metric={overview.metrics.month} />
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-lg dark:shadow-slate-950/30">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Créditos a proveedores</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatCurrencyFromCents(overview.credits.totalOutstandingCents)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {overview.credits.creditCount} crédito{overview.credits.creditCount === 1 ? "" : "s"} abiertos
              </p>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-lg dark:shadow-slate-950/30">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground dark:text-white">Recepciones recientes</h2>
                  <p className="text-xs text-muted-foreground dark:text-slate-400">
                    Últimos cinco recibos confirmados con su valor total y cantidades.
                  </p>
                </div>
                <Link
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  href="/purchases/new"
                >
                  <PackagePlus className="h-3.5 w-3.5" /> Nueva recepción
                </Link>
              </div>

              <div className="overflow-hidden rounded-md border border-border dark:border-slate-800">
                <table className="min-w-full divide-y divide-border text-sm dark:divide-slate-800">
                  <thead className="bg-muted dark:bg-slate-950/60">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2">Proveedor</th>
                      <th className="px-3 py-2">Referencia</th>
                      <th className="px-3 py-2">Recibido</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card text-foreground dark:divide-slate-800 dark:bg-transparent dark:text-slate-200">
                    {overview.recentPurchases.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={4}>
                          No hay recepciones recientes.
                        </td>
                      </tr>
                    ) : (
                      overview.recentPurchases.map((purchase) => (
                        <tr key={purchase.id} className="transition hover:bg-muted/70 dark:hover:bg-slate-900/70">
                          <td className="px-3 py-3 align-top">
                            <div className="font-medium text-foreground dark:text-white">
                              {purchase.supplierName ?? "Sin proveedor"}
                            </div>
                            <div className="text-xs text-muted-foreground">#{purchase.id}</div>
                          </td>
                          <td className="px-3 py-3 align-top text-sm text-muted-foreground">
                            {purchase.referenceNo ?? purchase.supplierInvoice ?? "—"}
                          </td>
                          <td className="px-3 py-3 align-top text-sm text-muted-foreground">
                            {formatDate(purchase.receivedAt ?? purchase.createdAt)}
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-foreground">
                            {formatCurrencyFromCents(purchase.totalCostCents)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-lg dark:shadow-slate-950/30">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground dark:text-white">Top suplidores (90 días)</h2>
                    <p className="text-xs text-muted-foreground dark:text-slate-400">
                      Ordenados por valor recibido.
                    </p>
                  </div>
                  <RefreshCcw className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-3">
                  {overview.topSuppliers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay movimientos suficientes para mostrar ranking.</p>
                  ) : (
                    overview.topSuppliers.map((supplier) => (
                      <div key={supplier.supplierName} className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/60 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/70">
                        <div>
                          <p className="font-medium text-foreground dark:text-white">{supplier.supplierName}</p>
                          <p className="text-xs text-muted-foreground">
                            {supplier.purchaseCount} compra{supplier.purchaseCount === 1 ? "" : "s"} · {numberFormatter.format(supplier.totalQuantity)} unidades
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">{formatCurrencyFromCents(supplier.totalCostCents)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-lg dark:shadow-slate-950/30">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground dark:text-white">Devoluciones recientes</h2>
                    <p className="text-xs text-muted-foreground dark:text-slate-400">Créditos y ajustes de proveedores.</p>
                  </div>
                  <Link
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    href="/purchases/returns"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Gestionar devoluciones
                  </Link>
                </div>

                <div className="space-y-3">
                  {overview.recentReturns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No se han registrado devoluciones recientemente.</p>
                  ) : (
                    overview.recentReturns.map((entry) => (
                      <div key={entry.id} className="rounded-md border border-border bg-muted/60 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/70">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground dark:text-white">{entry.supplierName ?? "Sin proveedor"}</p>
                            <p className="text-xs text-muted-foreground">#{entry.id} · {formatDate(entry.createdAt)}</p>
                          </div>
                          <p className="text-sm font-semibold text-foreground">{formatCurrencyFromCents(entry.totalCostCents)}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {numberFormatter.format(entry.totalQuantity)} unidades devueltas
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-lg dark:shadow-slate-950/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground dark:text-white">Acciones rápidas</h2>
                <p className="text-xs text-muted-foreground dark:text-slate-400">Accede directamente a los flujos principales.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Link
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  href="/purchases/new"
                >
                  <PackagePlus className="h-4 w-4" /> Registrar compra
                </Link>
                <Link
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  href="/purchases/returns"
                >
                  <RotateCcw className="h-4 w-4" /> Nueva devolución
                </Link>
                <Link
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 dark:text-white"
                  href="/inventory"
                >
                  <ArrowRight className="h-4 w-4" /> Ver inventario
                </Link>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          <p>No se pudo cargar el resumen de compras en este momento. Intenta nuevamente más tarde.</p>
        </section>
      )}
    </main>
  );
}
