"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type SeriesDefinition = {
  name: string;
  color: string;
  stroke: string;
  daily: number[];
  monthly: number[];
};

type MultiSeriesLineChartProps = {
  title: string;
  subtitle: string;
  labels: {
    daily: string[];
    monthly: string[];
  };
  series: SeriesDefinition[];
};

const chartDimensions = {
  width: 520,
  height: 220,
  paddingX: 28,
  paddingY: 24
};

function formatNumber(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
}

function createPath(values: number[], maxValue: number) {
  const { width, height, paddingX, paddingY } = chartDimensions;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const step = values.length > 1 ? innerWidth / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = paddingX + step * index;
      const clamped = Math.max(0, value);
      const y = paddingY + innerHeight - (clamped / Math.max(maxValue, 1)) * innerHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function sparkLineShadow(values: number[], maxValue: number) {
  const { width, height, paddingX, paddingY } = chartDimensions;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const step = values.length > 1 ? innerWidth / (values.length - 1) : 0;
  const topLine = values
    .map((value, index) => {
      const x = paddingX + step * index;
      const clamped = Math.max(0, value);
      const y = paddingY + innerHeight - (clamped / Math.max(maxValue, 1)) * innerHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const bottomLine = `L${paddingX + step * (values.length - 1)},${height - paddingY} L${paddingX},${height - paddingY} Z`;
  return `${topLine} ${bottomLine}`;
}

export function MultiSeriesLineChart({ title, subtitle, labels, series }: MultiSeriesLineChartProps) {
  const [timeframe, setTimeframe] = useState<"daily" | "monthly">("daily");

  const activeSeries = useMemo(
    () =>
      series.map((item) => ({
        name: item.name,
        color: item.color,
        stroke: item.stroke,
        values: timeframe === "daily" ? item.daily : item.monthly
      })),
    [series, timeframe]
  );

  const activeLabels = timeframe === "daily" ? labels.daily : labels.monthly;
  const maxValue = Math.max(...activeSeries.flatMap((s) => s.values), 1);

  const xTicks = activeLabels.length > 8 ? 6 : Math.max(3, activeLabels.length);
  const tickIndices = Array.from({ length: xTicks }, (_, index) =>
    Math.min(activeLabels.length - 1, Math.round((index / (xTicks - 1)) * (activeLabels.length - 1)))
  );

  return (
    <div className="rounded-3xl bg-white/60 p-4 shadow-inner ring-1 ring-slate-200/70 dark:bg-slate-900/70 dark:ring-slate-800/70">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{subtitle}</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{title}</p>
        </div>
        <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
          {(["daily", "monthly"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTimeframe(option)}
              className={cn(
                "rounded-full px-3 py-1 transition",
                timeframe === option
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-300/80 dark:hover:text-white"
              )}
            >
              {option === "daily" ? "Last 30 days" : "Last 12 months"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <div className="w-full overflow-hidden rounded-2xl bg-gradient-to-b from-slate-50 to-white p-4 ring-1 ring-slate-200/70 dark:from-slate-900 dark:to-slate-900/70 dark:ring-slate-800/60">
          <svg viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`} className="w-full" role="img">
            <title>{`${title} ${timeframe === "daily" ? "last 30 days" : "last 12 months"}`}</title>
            <defs>
              {activeSeries.map((serie) => (
                <linearGradient id={`${serie.name}-fill`} key={`${serie.name}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={serie.stroke} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={serie.stroke} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <rect
              x={chartDimensions.paddingX}
              y={chartDimensions.paddingY}
              width={chartDimensions.width - chartDimensions.paddingX * 2}
              height={chartDimensions.height - chartDimensions.paddingY * 2}
              rx={14}
              className="fill-slate-100/70 stroke-slate-200 dark:fill-slate-900/60 dark:stroke-slate-800"
            />
            {activeSeries.map((serie) => (
              <path
                key={`${serie.name}-shadow`}
                d={sparkLineShadow(serie.values, maxValue)}
                fill={`url(#${serie.name}-fill)`}
                stroke="none"
                className="opacity-80"
              />
            ))}
            {activeSeries.map((serie) => (
              <path
                key={serie.name}
                d={createPath(serie.values, maxValue)}
                fill="none"
                stroke={serie.stroke}
                strokeWidth={3}
                strokeLinecap="round"
              />
            ))}
            {activeSeries.map((serie) => {
              const values = serie.values;
              const lastIndex = values.length - 1;
              const { width, height, paddingX, paddingY } = chartDimensions;
              const innerWidth = width - paddingX * 2;
              const innerHeight = height - paddingY * 2;
              const step = values.length > 1 ? innerWidth / (values.length - 1) : 0;
              const x = paddingX + step * lastIndex;
              const y = paddingY + innerHeight - (Math.max(values[lastIndex], 0) / Math.max(maxValue, 1)) * innerHeight;
              return <circle key={`${serie.name}-dot`} cx={x} cy={y} r={4.5} fill={serie.stroke} className="drop-shadow" />;
            })}
            {tickIndices.map((index) => {
              const { width, height, paddingX, paddingY } = chartDimensions;
              const innerWidth = width - paddingX * 2;
              const step = activeLabels.length > 1 ? innerWidth / (activeLabels.length - 1) : 0;
              const x = paddingX + step * index;
              return (
                <line
                  key={`tick-${index}`}
                  x1={x}
                  y1={height - paddingY}
                  x2={x}
                  y2={height - paddingY + 6}
                  className="stroke-slate-300/80 dark:stroke-slate-700"
                  strokeWidth={1}
                />
              );
            })}
            {tickIndices.map((index) => {
              const { width, height, paddingX, paddingY } = chartDimensions;
              const innerWidth = width - paddingX * 2;
              const step = activeLabels.length > 1 ? innerWidth / (activeLabels.length - 1) : 0;
              const x = paddingX + step * index;
              return (
                <text
                  key={`label-${index}`}
                  x={x}
                  y={height - paddingY + 20}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] dark:fill-slate-400"
                >
                  {activeLabels[index]}
                </text>
              );
            })}
          </svg>
        </div>
        <div className="grid w-full gap-3 text-sm text-slate-700 dark:text-slate-200 lg:w-60">
          {activeSeries.map((serie) => {
            const latest = serie.values[serie.values.length - 1];
            const delta = serie.values.length > 1 ? latest - serie.values[0] : 0;
            const deltaLabel = delta >= 0 ? `+${formatNumber(delta)}` : formatNumber(delta);
            return (
              <div
                key={serie.name}
                className="flex items-center justify-between rounded-2xl bg-white/60 px-3 py-2 ring-1 ring-slate-200/70 dark:bg-slate-900/60 dark:ring-slate-800/70"
              >
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", serie.color)} aria-hidden />
                  <span className="font-medium">{serie.name}</span>
                </div>
                <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatNumber(latest)}</p>
                  <p>{deltaLabel} from start</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
