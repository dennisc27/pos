import type { CollateralMixItem, RiskBand } from "./types";
import { LoansCard } from "./loans-card";
import { formatPercent, trendColor } from "./utils";

export function CollateralMix({
  mix,
  riskBands
}: {
  mix: CollateralMixItem[];
  riskBands: RiskBand[];
}) {
  return (
    <LoansCard
      title="Distribución de garantías"
      subtitle="Diversificación de colaterales activos y bandas de riesgo"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          {mix.map((item) => (
            <div key={item.category} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium text-slate-200">{item.category}</span>
                <span className={`text-[11px] font-medium ${trendColor(item.trend)}`}>
                  {item.trend === "up" ? "▲" : item.trend === "down" ? "▼" : "■"} {item.detail}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400/80 via-sky-500/80 to-sky-400/80"
                  style={{ width: formatPercent(item.percentage) }}
                />
              </div>
              <p className="text-xs text-slate-400">{formatPercent(item.percentage)}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bandas de riesgo</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {riskBands.map((band) => (
              <div key={band.label} className="space-y-1 rounded-xl border border-slate-800/60 bg-slate-950/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{band.label}</p>
                <p className="text-lg font-semibold text-white">{band.count}</p>
                <p className="text-[11px] text-slate-400">{band.descriptor}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoansCard>
  );
}
