import type { CustomerProfileDetails } from "./types";
import { formatCurrency, formatPoints } from "./utils";

export function CustomerProfile({ profile }: { profile: CustomerProfileDetails }) {
  const { customer, summary, activity } = profile;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50 to-white p-5 text-slate-700 shadow-sm dark:border-slate-800/70 dark:from-slate-950/40 dark:to-slate-950/60 dark:text-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/10 text-lg font-semibold text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">
              {customer.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{customer.fullName}</h3>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                  {customer.tier}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                  Cliente desde {customer.since}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Prefiere contacto por {customer.preferredChannel} · Última visita {customer.lastVisit} · Sucursal {customer.branch}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-right text-sm text-slate-600 dark:text-slate-300">
            <div>
              <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">Valor vida</span>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">
                {formatCurrency(customer.lifetimeValue)}
              </div>
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">Puntos</span>
              <div className="text-lg font-semibold text-sky-600 dark:text-sky-300">
                {formatPoints(customer.loyaltyPoints)}
              </div>
            </div>
            {customer.riskLevel ? (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-500 dark:text-slate-500">Riesgo:</span>
                <span
                  className={
                    customer.riskLevel === "high"
                      ? "text-rose-500 dark:text-rose-300"
                      : customer.riskLevel === "medium"
                      ? "text-amber-500 dark:text-amber-300"
                      : "text-emerald-600 dark:text-emerald-300"
                  }
                >
                  {customer.riskLevel === "high"
                    ? "Alto"
                    : customer.riskLevel === "medium"
                    ? "Medio"
                    : "Bajo"}
                </span>
              </div>
            ) : null}
            <span className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">
              KYC {customer.kycStatus === "verified" ? "verificado" : customer.kycStatus === "pending" ? "pendiente" : "expirado"}
            </span>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Contacto</div>
            <p>
              <span className="font-medium text-slate-700 dark:text-slate-200">Tel:</span> {customer.phone}
            </p>
            {customer.email ? (
              <p>
                <span className="font-medium text-slate-700 dark:text-slate-200">Email:</span> {customer.email}
              </p>
            ) : null}
            {customer.address ? (
              <p>
                <span className="font-medium text-slate-700 dark:text-slate-200">Dirección:</span> {customer.address}
              </p>
            ) : null}
          </div>
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Documento</div>
            <p>
              <span className="font-medium text-slate-700 dark:text-slate-200">{customer.doc.type}:</span> {customer.doc.number}
            </p>
            {customer.doc.expires ? <p>Vence: {customer.doc.expires}</p> : null}
            <p>
              <span className="font-medium text-slate-700 dark:text-slate-200">Tags:</span> {customer.tags?.join(", ") ?? "N/A"}
            </p>
          </div>
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Balances</div>
            <p>Pendiente: {formatCurrency(customer.openBalances)}</p>
            <p>
              Segmentos activos: <span className="font-medium">{customer.segments.join(", ")}</span>
            </p>
            <p>Última nota: {summary.find((item) => item.label === "Notas recientes")?.hint ?? "Sin notas"}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summary.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/30 dark:text-slate-300"
            >
              <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{item.label}</div>
              <div className="text-base font-semibold text-slate-900 dark:text-white">{item.value}</div>
              {item.hint ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Actividad reciente</div>
        <ol className="space-y-4">
          {activity.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                      {item.type}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{item.timestamp}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                </div>
                <div className="text-right text-sm text-slate-600 dark:text-slate-300">
                  {item.amount !== undefined ? (
                    <div className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(item.amount)}</div>
                  ) : null}
                  {item.status ? (
                    <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{item.status}</span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
