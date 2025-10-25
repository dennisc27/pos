import { useMemo } from "react";

import { ArrowRight, Hammer, ShieldCheck, TimerReset } from "lucide-react";

import { RepairsCard } from "./repairs-card";
import type { RepairJob, RepairStatus } from "./types";
import { formatCurrency } from "./utils";

const statusOrder: RepairStatus[] = [
  "diagnosing",
  "awaiting_approval",
  "in_progress",
  "quality_control",
  "ready",
  "delivered",
];

const statusLabels: Record<RepairStatus, string> = {
  diagnosing: "Diagnóstico",
  awaiting_approval: "Esperando aprobación",
  in_progress: "En proceso",
  quality_control: "Calidad",
  ready: "Listo para pickup",
  delivered: "Entregado",
};

const statusAccent: Record<RepairStatus, string> = {
  diagnosing: "border-slate-300 dark:border-slate-700",
  awaiting_approval: "border-amber-400/70 dark:border-amber-500/60",
  in_progress: "border-sky-400/70 dark:border-sky-500/60",
  quality_control: "border-violet-400/70 dark:border-violet-500/60",
  ready: "border-emerald-400/70 dark:border-emerald-500/60",
  delivered: "border-slate-200/70 dark:border-slate-800/70",
};

const nextStatus: Record<RepairStatus, RepairStatus | null> = {
  diagnosing: "awaiting_approval",
  awaiting_approval: "in_progress",
  in_progress: "quality_control",
  quality_control: "ready",
  ready: "delivered",
  delivered: null,
};

export function JobKanban({
  jobs,
  selectedId,
  onSelect,
  onAdvance,
  onReassign,
}: {
  jobs: RepairJob[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onAdvance?: (id: string, next: RepairStatus | null) => void;
  onReassign?: (id: string) => void;
}) {
  const lanes = useMemo(() => {
    return statusOrder.map((status) => ({
      status,
      jobs: jobs.filter((job) => job.status === status),
    }));
  }, [jobs]);

  return (
    <RepairsCard
      title="Órdenes en taller"
      subtitle="Gestiona tickets desde diagnóstico hasta entrega"
      action={<span>{jobs.length} trabajos activos</span>}
      className="xl:col-span-2"
    >
      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {lanes.map((lane) => (
          <div key={lane.status} className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-300/80 p-3 dark:border-slate-700/80">
            <header className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>{statusLabels[lane.status]}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                {lane.jobs.length}
              </span>
            </header>
            <div className="flex flex-col gap-3">
              {lane.jobs.map((job) => {
                const isSelected = job.id === selectedId;
                const next = nextStatus[job.status];
                return (
                  <article
                    key={job.id}
                    className={`space-y-2 rounded-lg border bg-white/80 p-3 text-sm shadow-sm transition-colors dark:bg-slate-900/60 ${
                      isSelected
                        ? "border-sky-500/80 shadow-sky-100 dark:border-sky-500/60"
                        : `${statusAccent[job.status]} bg-gradient-to-b from-white to-slate-50 dark:from-slate-950/50 dark:to-slate-950/70`
                    }`}
                    onClick={() => onSelect?.(job.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{job.ticket}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{job.customer}</p>
                      </div>
                      {job.rush ? (
                        <span className="rounded-full border border-rose-400/60 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-300">
                          Rush
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{job.item}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Promesa {job.promisedAt}</span>
                      <span>Asignado {job.assignedTo ?? "—"}</span>
                      <span>{formatCurrency(job.balanceDue)} pendiente</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <button
                        className="flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:hover:border-slate-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          onReassign?.(job.id);
                        }}
                      >
                        <Hammer className="h-3.5 w-3.5" />
                        Reasignar
                      </button>
                      <button
                        className="flex items-center gap-1 rounded-full border border-sky-400/70 px-2.5 py-1 text-sky-600 transition hover:border-sky-500/70 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-500/60 dark:text-sky-300"
                        onClick={(event) => {
                          event.stopPropagation();
                          onAdvance?.(job.id, next);
                        }}
                        disabled={!next}
                      >
                        {next ? (
                          <>
                            Avanzar
                            <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5" /> Entregado
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
              {lane.jobs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300/70 bg-slate-50 p-3 text-center text-xs text-slate-400 dark:border-slate-700/70 dark:bg-slate-900/40 dark:text-slate-600">
                  <TimerReset className="mx-auto mb-2 h-4 w-4" />
                  <p>Sin trabajos en esta etapa</p>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </RepairsCard>
  );
}
