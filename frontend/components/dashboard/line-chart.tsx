"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type TrendPoint = {
  label: string;
  sales: number;
  pawns: number;
  layaways: number;
};

export function PerformanceLineChart({
  daily,
  monthly
}: {
  daily: TrendPoint[];
  monthly: TrendPoint[];
}) {
  const [range, setRange] = useState<"daily" | "monthly">("daily");
  const series = range === "daily" ? daily : monthly;

  const { maxValue, lines } = useMemo(() => {
    const max = Math.max(
      ...series.flatMap((point) => [point.sales, point.pawns, point.layaways]),
      1
    );

    const chartHeight = 200;
    const chartWidth = 640;
    const step = series.length > 1 ? chartWidth / (series.length - 1) : chartWidth;

    const toPath = (key: keyof TrendPoint) =>
      series
        .map((point, index) => {
          const x = index * step;
          const y = chartHeight - (point[key] / max) * chartHeight;
          return `${index === 0 ? "M" : "L"}${x},${y}`;
        })
        .join(" ");

    return {
      maxValue: max,
      lines: {
        sales: toPath("sales"),
        pawns: toPath("pawns"),
        layaways: toPath("layaways"),
        width: chartWidth,
        height: chartHeight
      }
    };
  }, [series]);

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => index / tickCount);
  const labelFrequency = Math.max(1, Math.ceil(series.length / 12));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex overflow-hidden rounded-full border border-slate-200/80 bg-white/80 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
          {(
            [
              { key: "daily" as const, label: "Last 30 days" },
              { key: "monthly" as const, label: "By month (last year)" }
            ] satisfies { key: "daily" | "monthly"; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition",
                range === key
                  ? "bg-emerald-500 text-white shadow-inner"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-300/80">
          View sales, pawns, and layaways together by period.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50 p-4 shadow-inner ring-1 ring-slate-200/60 dark:border-slate-800/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:ring-slate-800/70">
        <div className="absolute inset-0 opacity-40 blur-3xl" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-200 via-sky-200 to-indigo-200 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950" />
        </div>
        <div className="relative space-y-3">
          <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-600 dark:text-slate-200">
            <LegendDot color="stroke-emerald-500" label="Sales" />
            <LegendDot color="stroke-amber-500" label="Pawns" />
            <LegendDot color="stroke-sky-500" label="Layaways" />
          </div>
          <div className="relative h-[240px] w-full overflow-x-auto">
            <svg viewBox={`0 0 ${lines.width} ${lines.height}`} className="h-full w-full min-w-[320px]">
              <defs>
                <linearGradient id="salesGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="pawnsGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgb(245 158 11)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="rgb(245 158 11)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="layawaysGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgb(56 189 248)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="rgb(56 189 248)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {ticks.map((tick, index) => {
                const y = lines.height - tick * lines.height;
                const value = Math.round(maxValue * tick);
                return (
                  <g key={index}>
                    <line x1={0} x2={lines.width} y1={y} y2={y} className="stroke-slate-200 dark:stroke-slate-800" />
                    <text
                      x={-8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] dark:fill-slate-500"
                    >
                      {value.toLocaleString()}
                    </text>
                  </g>
                );
              })}

              <LinePath d={lines.sales} color="stroke-emerald-500" fill="url(#salesGradient)" height={lines.height} />
              <LinePath d={lines.pawns} color="stroke-amber-500" fill="url(#pawnsGradient)" height={lines.height} />
              <LinePath d={lines.layaways} color="stroke-sky-500" fill="url(#layawaysGradient)" height={lines.height} />

              {series.map((point, index) => {
                const step = series.length > 1 ? lines.width / (series.length - 1) : lines.width;
                const x = index * step;
                const showLabel = series.length <= 12 || index === series.length - 1 || index % labelFrequency === 0;

                if (!showLabel) return null;

                return (
                  <text
                    key={point.label}
                    x={x}
                    y={lines.height + 14}
                    className="fill-slate-400 text-[10px]"
                    textAnchor="middle"
                  >
                    {point.label}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900/70 dark:ring-slate-800/70">
      <span className={cn("h-2 w-2 rounded-full", color)} aria-hidden />
      {label}
    </span>
  );
}

function LinePath({ d, color, fill, height }: { d: string; color: string; fill: string; height: number }) {
  return (
    <g>
      <path d={`${d} V${height} H0 Z`} className={cn(color, "fill-transparent stroke-[2.4]")} fill={fill} />
      <path d={d} className={cn(color, "fill-none stroke-[2.4] drop-shadow-sm")} />
    </g>
  );
}
