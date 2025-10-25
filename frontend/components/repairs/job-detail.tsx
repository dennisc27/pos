import { useState } from "react";

import { ClipboardList, Send } from "lucide-react";

import { RepairsCard } from "./repairs-card";
import type { PaymentMilestoneStatus, RepairJob, RepairStatus } from "./types";
import { formatCurrency, formatStatus } from "./utils";

const milestoneLabels: Record<PaymentMilestoneStatus, string> = {
  pending: "Pendiente",
  collected: "Cobrado",
  waived: "Exonerado",
};

const statusOptions: RepairStatus[] = [
  "diagnosing",
  "awaiting_approval",
  "in_progress",
  "quality_control",
  "ready",
  "delivered",
];

export function JobDetail({
  job,
  onUpdateStatus,
  onIssueMaterial,
  onReturnMaterial,
  onToggleMilestone,
  onAddNote,
}: {
  job?: RepairJob;
  onUpdateStatus?: (id: string, status: RepairStatus) => void;
  onIssueMaterial?: (jobId: string, materialId: string) => void;
  onReturnMaterial?: (jobId: string, materialId: string) => void;
  onToggleMilestone?: (jobId: string, milestoneId: string, next: PaymentMilestoneStatus) => void;
  onAddNote?: (jobId: string, note: string) => void;
}) {
  const [noteDraft, setNoteDraft] = useState("");

  if (!job) {
    return (
      <RepairsCard
        title="Detalle de trabajo"
        subtitle="Selecciona una orden para revisar costos, materiales y actividades"
      >
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300/70 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-400">
          <ClipboardList className="h-6 w-6" />
          <p>No hay trabajo seleccionado.</p>
          <p>Elige una orden en el tablero para visualizar su estado.</p>
        </div>
      </RepairsCard>
    );
  }

  return (
    <RepairsCard
      title={`Ticket ${job.ticket}`}
      subtitle={`${job.type === "repair" ? "Reparación" : "Fabricación"} · ${job.branch}`}
      action={<span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{formatStatus(job.status)}</span>}
    >
      <div className="space-y-6">
        <section className="grid gap-4 rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 text-sm shadow-sm dark:border-slate-800/70 dark:from-slate-950/60 dark:to-slate-950/80">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{job.customer}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {job.customerCode} · Promesa {job.promisedAt}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{job.issue}</p>
            </div>
            <div className="flex flex-col items-end gap-2 text-right text-xs text-slate-500 dark:text-slate-400">
              <span>Asignado: {job.assignedTo ?? "Pendiente"}</span>
              <span>Fotos cargadas: {job.photos}</span>
              <span>Garantía: {job.hasWarranty ? "Sí" : "No"}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Estimado</p>
              <p className="font-semibold text-slate-900 dark:text-white">{formatCurrency(job.estimate)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Balance</p>
              <p className="font-semibold text-amber-600 dark:text-amber-300">{formatCurrency(job.balanceDue)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <label className="font-semibold">Actualizar estado:</label>
            <select
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              value={job.status}
              onChange={(event) => onUpdateStatus?.(job.id, event.target.value as RepairStatus)}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatStatus(status)}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span>Materiales y mano de obra</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Issue & Return</span>
          </div>
          <div className="space-y-2">
            {job.materials.map((material) => (
              <div
                key={material.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/70 bg-white/80 p-3 text-xs text-slate-600 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/40 dark:text-slate-300"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{material.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {material.issued}/{material.quantity} {material.uom} emitidos · {material.used} usados
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="rounded-full border border-slate-300 px-3 py-1 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:hover:border-slate-600"
                    onClick={() => onIssueMaterial?.(job.id, material.id)}
                  >
                    Emitir
                  </button>
                  <button
                    className="rounded-full border border-emerald-400/70 px-3 py-1 text-emerald-600 transition hover:border-emerald-500/70 hover:text-emerald-700 dark:border-emerald-500/60 dark:text-emerald-300"
                    onClick={() => onReturnMaterial?.(job.id, material.id)}
                  >
                    Registrar uso
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span>Pagos y hitos</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Controla cobros parciales</span>
          </div>
          <div className="space-y-2">
            {job.milestones.map((milestone) => (
              <div
                key={milestone.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/70 bg-white/80 p-3 text-xs text-slate-600 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/40 dark:text-slate-300"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{milestone.label}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {milestone.due} · {formatCurrency(milestone.amount)} · {milestoneLabels[milestone.status]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-slate-300 px-3 py-1 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:hover:border-slate-600"
                    onClick={() => onToggleMilestone?.(job.id, milestone.id, "pending")}
                  >
                    Pendiente
                  </button>
                  <button
                    className="rounded-full border border-emerald-400/70 px-3 py-1 text-emerald-600 transition hover:border-emerald-500/70 hover:text-emerald-700 dark:border-emerald-500/60 dark:text-emerald-300"
                    onClick={() => onToggleMilestone?.(job.id, milestone.id, "collected")}
                  >
                    Cobrado
                  </button>
                  <button
                    className="rounded-full border border-amber-400/70 px-3 py-1 text-amber-600 transition hover:border-amber-500/70 hover:text-amber-700 dark:border-amber-500/60 dark:text-amber-300"
                    onClick={() => onToggleMilestone?.(job.id, milestone.id, "waived")}
                  >
                    Exonerar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <header className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span>Bitácora</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Últimas actualizaciones</span>
          </header>
          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            {job.activity.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-lg border border-slate-200/70 bg-white/80 p-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/40"
              >
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-300" />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <span>{entry.timestamp}</span>
                    <span>·</span>
                    <span>{entry.actor}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-100">{entry.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <header className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span>Notas internas</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Visible para equipo taller</span>
          </header>
          <div className="space-y-2">
            {job.notes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300/70 bg-slate-50 p-3 text-xs text-slate-400 dark:border-slate-700/70 dark:bg-slate-900/40 dark:text-slate-500">
                Sin notas registradas.
              </p>
            ) : (
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                {job.notes.map((note, index) => (
                  <li key={`${note}-${index}`} className="rounded-lg border border-slate-200/70 bg-white/80 p-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/40">
                    {note}
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2 rounded-lg border border-slate-200/70 bg-white/80 p-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/40">
              <textarea
                className="w-full rounded-lg border border-slate-300 bg-transparent p-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                rows={3}
                placeholder="Agregar nota de seguimiento..."
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
              />
              <div className="flex items-center justify-end gap-2 text-xs">
                <button
                  className="rounded-full border border-slate-300 px-3 py-1 text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300"
                  onClick={() => setNoteDraft("")}
                  type="button"
                >
                  Limpiar
                </button>
                <button
                  className="flex items-center gap-2 rounded-full border border-sky-400/70 px-4 py-1 text-sky-600 transition hover:border-sky-500/70 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-500/60 dark:text-sky-300"
                  type="button"
                  onClick={() => {
                    if (!noteDraft.trim()) return;
                    onAddNote?.(job.id, noteDraft.trim());
                    setNoteDraft("");
                  }}
                  disabled={!noteDraft.trim()}
                >
                  <Send className="h-3.5 w-3.5" /> Guardar
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </RepairsCard>
  );
}
