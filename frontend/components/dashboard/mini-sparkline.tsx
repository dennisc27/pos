"use client";

import { useMemo } from "react";

type MiniSparklineProps = {
  values: number[];
  color?: string;
  height?: number;
  width?: number;
};

export function MiniSparkline({ values, color = "#10b981", height = 40, width = 120 }: MiniSparklineProps) {
  const path = useMemo(() => {
    if (values.length === 0) return "";
    
    const maxValue = Math.max(...values.filter(v => !isNaN(v) && isFinite(v)), 1);
    const minValue = Math.min(...values.filter(v => !isNaN(v) && isFinite(v)), 0);
    const range = maxValue - minValue || 1;
    
    const padding = 4;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;
    const stepX = values.length > 1 ? innerWidth / (values.length - 1) : 0;
    
    const points = values.map((value, index) => {
      const x = padding + stepX * index;
      const normalized = (value - minValue) / range;
      const y = padding + innerHeight - (normalized * innerHeight);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    
    return points.join(" ");
  }, [values, width, height]);

  if (values.length === 0 || values.every(v => v === 0)) {
    return (
      <div className="flex items-center justify-center text-xs text-slate-400" style={{ width, height }}>
        <span>No data</span>
      </div>
    );
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
      {/* Fill area */}
      {values.length > 0 && (
        <path
          d={`${path} L${width - 4},${height - 4} L4,${height - 4} Z`}
          fill={color}
          opacity={0.1}
        />
      )}
    </svg>
  );
}

