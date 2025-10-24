import type { CustomerRecord } from "./types";
import { formatCurrency, formatPoints } from "./utils";

const statusColors: Record<CustomerRecord["status"], string> = {
  vip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  standard: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-200",
  watch: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
  restricted: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
};

export function CustomerList({
  customers,
  selectedId
}: {
  customers: CustomerRecord[];
  selectedId: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{customers.length} clientes</span>
        <button className="rounded-full border border-slate-300/70 px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 dark:border-slate-600/70 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white">
          Nuevo cliente
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {customers.map((customer) => {
          const isActive = customer.id === selectedId;
          return (
            <button
              key={customer.id}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                isActive
                  ? "border-sky-500 bg-sky-50 shadow-sm dark:border-sky-400/80 dark:bg-sky-500/10"
                  : "border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800/70 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600 dark:bg-slate-700 dark:text-white">
                    {customer.avatar ?? customer.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {customer.fullName}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[customer.status]}`}>
                        {customer.status === "vip"
                          ? "VIP"
                          : customer.status === "standard"
                          ? "Cliente"
                          : customer.status === "watch"
                          ? "Observación"
                          : "Restringido"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Última visita · {customer.lastVisit} · {customer.branch}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-600 dark:text-slate-300">
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(customer.lifetimeValue)}
                  </div>
                  <div className="text-[11px]">{formatPoints(customer.loyaltyPoints)} pts</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800/70">
                  {customer.preferredChannel}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800/70">
                  Código {customer.code}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800/70">
                  Segmentos: {customer.segments.join(", ")}
                </span>
                {customer.tags?.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800/70">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
