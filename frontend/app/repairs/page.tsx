"use client";

import { useMemo, useState } from "react";

import { RepairsSummary } from "@/components/repairs/repairs-summary";
import { JobKanban } from "@/components/repairs/job-kanban";
import { JobDetail } from "@/components/repairs/job-detail";
import type {
  PaymentMilestoneStatus,
  RepairJob,
  RepairStatus,
  RepairsSummaryMetric,
} from "@/components/repairs/types";
import { formatCurrency, formatStatus } from "@/components/repairs/utils";

const INITIAL_JOBS: RepairJob[] = [
  {
    id: "job-1",
    ticket: "RP-10234",
    type: "repair",
    customer: "Camila Reyes",
    customerCode: "C-10823",
    branch: "Piantini",
    item: "Anillo oro 14K con diamantes",
    issue: "Prongs flojos, limpieza y pulido",
    status: "awaiting_approval",
    promisedAt: "Hoy · 5:00 p. m.",
    rush: true,
    assignedTo: "Laura",
    estimate: 8_500,
    balanceDue: 3_500,
    photos: 6,
    hasWarranty: true,
    materials: [
      { id: "mat-1", name: "Soldadura oro amarillo", quantity: 2, uom: "gr", issued: 1, used: 0.5 },
      { id: "mat-2", name: "Puntas diamante 1.5mm", quantity: 4, uom: "pcs", issued: 2, used: 0 },
    ],
    milestones: [
      { id: "mil-1", label: "Depósito 50%", amount: 4_250, due: "Recibido", status: "collected" },
      { id: "mil-2", label: "Saldo entrega", amount: 4_250, due: "Al recoger", status: "pending" },
    ],
    notes: ["Cliente aprobó rediseño vía WhatsApp."],
    activity: [
      {
        id: "act-1",
        timestamp: "12 jun · 11:05 a. m.",
        actor: "Laura",
        message: "Se completó diagnóstico y se envió estimado RD$8,500.",
      },
      {
        id: "act-2",
        timestamp: "12 jun · 9:40 a. m.",
        actor: "Recepción",
        message: "Pieza recibida con fotos y evaluación de prongs.",
      },
    ],
  },
  {
    id: "job-2",
    ticket: "FB-22018",
    type: "fabrication",
    customer: "Edgar Morales",
    customerCode: "C-10202",
    branch: "Santo Domingo Oeste",
    item: "Cadena personalizada iniciales",
    issue: "Fabricación con molde nuevo",
    status: "in_progress",
    promisedAt: "14 jun · 4:00 p. m.",
    rush: false,
    assignedTo: "Gabriel",
    estimate: 18_900,
    balanceDue: 9_450,
    photos: 4,
    hasWarranty: true,
    materials: [
      { id: "mat-3", name: "Oro 14K", quantity: 12, uom: "gr", issued: 8, used: 6 },
      { id: "mat-4", name: "Cadena tipo cubana", quantity: 1, uom: "pieza", issued: 1, used: 1 },
    ],
    milestones: [
      { id: "mil-3", label: "Diseño aprobado", amount: 0, due: "11 jun", status: "collected" },
      { id: "mil-4", label: "50% producción", amount: 9_450, due: "Hoy", status: "collected" },
      { id: "mil-5", label: "Saldo entrega", amount: 9_450, due: "Entrega", status: "pending" },
    ],
    notes: ["Cliente pidió grabar fecha en el cierre."],
    activity: [
      {
        id: "act-3",
        timestamp: "12 jun · 10:20 a. m.",
        actor: "Gabriel",
        message: "Molde terminado y listo para fundición.",
      },
      {
        id: "act-4",
        timestamp: "11 jun · 4:45 p. m.",
        actor: "Diseño",
        message: "Cliente aprobó render final.",
      },
    ],
  },
  {
    id: "job-3",
    ticket: "RP-10212",
    type: "repair",
    customer: "Ivonne Cabrera",
    customerCode: "C-10118",
    branch: "Santiago",
    item: "Reloj Omega",
    issue: "Servicio completo + cambio empaques",
    status: "quality_control",
    promisedAt: "13 jun · 1:30 p. m.",
    rush: false,
    assignedTo: "Moisés",
    estimate: 12_400,
    balanceDue: 0,
    photos: 8,
    hasWarranty: false,
    materials: [
      { id: "mat-5", name: "Kit empaques", quantity: 1, uom: "set", issued: 1, used: 1 },
      { id: "mat-6", name: "Aceite movimiento", quantity: 1, uom: "serv", issued: 1, used: 1 },
    ],
    milestones: [
      { id: "mil-6", label: "Pago completo", amount: 12_400, due: "Recibido", status: "collected" },
    ],
    notes: ["Enviar video final al cliente antes de cerrar."],
    activity: [
      {
        id: "act-5",
        timestamp: "12 jun · 8:15 a. m.",
        actor: "Moisés",
        message: "Cierre de caja hermética en prueba presión.",
      },
      {
        id: "act-6",
        timestamp: "11 jun · 3:05 p. m.",
        actor: "Moisés",
        message: "Cambio de empaques completado.",
      },
    ],
  },
  {
    id: "job-4",
    ticket: "RP-10240",
    type: "repair",
    customer: "Luis Ángel Bautista",
    customerCode: "C-10990",
    branch: "San Cristóbal",
    item: "Pulsera plata con baño oro",
    issue: "Reposición baño y reparación broche",
    status: "diagnosing",
    promisedAt: "14 jun · 11:00 a. m.",
    rush: false,
    assignedTo: undefined,
    estimate: 4_800,
    balanceDue: 4_800,
    photos: 3,
    hasWarranty: false,
    materials: [
      { id: "mat-7", name: "Baño oro 18K", quantity: 1, uom: "serv", issued: 0, used: 0 },
    ],
    milestones: [
      { id: "mil-7", label: "Depósito requerido", amount: 2_400, due: "Pendiente", status: "pending" },
      { id: "mil-8", label: "Saldo", amount: 2_400, due: "Entrega", status: "pending" },
    ],
    notes: [],
    activity: [
      {
        id: "act-7",
        timestamp: "12 jun · 12:20 p. m.",
        actor: "Recepción",
        message: "Pieza ingresada, requiere autorización manual por historial.",
      },
    ],
  },
  {
    id: "job-5",
    ticket: "RP-10205",
    type: "repair",
    customer: "Rosa Salcedo",
    customerCode: "C-10018",
    branch: "Piantini",
    item: "Aretes oro blanco",
    issue: "Cambio de postes y rhodium",
    status: "ready",
    promisedAt: "Disponible · Notificar",
    rush: false,
    assignedTo: "Laura",
    estimate: 3_200,
    balanceDue: 3_200,
    photos: 5,
    hasWarranty: true,
    materials: [
      { id: "mat-9", name: "Postes oro blanco", quantity: 2, uom: "pcs", issued: 2, used: 2 },
      { id: "mat-10", name: "Baño rodio", quantity: 1, uom: "serv", issued: 1, used: 1 },
    ],
    milestones: [
      { id: "mil-9", label: "Pago contra entrega", amount: 3_200, due: "Entrega", status: "pending" },
    ],
    notes: ["Cliente prefiere notificación por SMS."],
    activity: [
      {
        id: "act-8",
        timestamp: "11 jun · 6:45 p. m.",
        actor: "Laura",
        message: "QA finalizado, pendiente llamar cliente.",
      },
    ],
  },
];

const TECHNICIANS = ["Laura", "Gabriel", "Moisés", "Nayelis", "Juan"];

export default function RepairsPage() {
  const [jobs, setJobs] = useState(INITIAL_JOBS);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(INITIAL_JOBS[0]?.id);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [rushOnly, setRushOnly] = useState(false);
  const [activityLog, setActivityLog] = useState<string[]>([]);

  const logAction = (message: string) => {
    setActivityLog((entries) => [message, ...entries].slice(0, 6));
  };

  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => {
        if (branchFilter !== "all" && job.branch !== branchFilter) {
          return false;
        }
        if (rushOnly && !job.rush) {
          return false;
        }
        return job.status !== "delivered";
      }),
    [jobs, branchFilter, rushOnly],
  );

  const summaryMetrics: RepairsSummaryMetric[] = useMemo(() => {
    const backlog = jobs.filter((job) => job.status !== "delivered").length;
    const approvals = jobs.filter((job) => job.status === "awaiting_approval").length;
    const ready = jobs.filter((job) => job.status === "ready").length;
    const quality = jobs.filter((job) => job.status === "quality_control").length;
    const totalValue = jobs.reduce((sum, job) => sum + job.estimate, 0);
    return [
      {
        label: "Backlog activo",
        value: `${backlog} trabajos`,
        change: { direction: backlog > 4 ? "up" : "flat", label: backlog > 4 ? "+1 hoy" : "Sin cambio" },
      },
      {
        label: "Listos para pickup",
        value: `${ready} listos`,
        accent: "text-emerald-600 dark:text-emerald-300",
        change: { direction: ready ? "up" : "flat", label: ready ? `+${ready} notificar` : "Pendientes" },
      },
      {
        label: "En aprobación",
        value: `${approvals} esperando`,
        accent: "text-amber-600 dark:text-amber-300",
        change: { direction: approvals ? "up" : "flat", label: approvals ? "Contactar clientes" : "Todo al día" },
      },
      {
        label: "Valor estimado",
        value: formatCurrency(totalValue),
        accent: "text-sky-600 dark:text-sky-300",
        change: { direction: quality ? "up" : "flat", label: `${quality} en QA` },
      },
    ];
  }, [jobs]);

  const branches = useMemo(() => Array.from(new Set(jobs.map((job) => job.branch))), [jobs]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId), [jobs, selectedJobId]);

  const upsertJob = (id: string, updater: (job: RepairJob) => RepairJob) => {
    setJobs((current) => current.map((job) => (job.id === id ? updater(job) : job)));
  };

  const appendJobActivity = (job: RepairJob, message: string): RepairJob => {
    const timestamp = new Date().toLocaleString("es-DO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      ...job,
      activity: [
        { id: `act-${Date.now()}`, timestamp, actor: "Sistema taller", message },
        ...job.activity,
      ],
    };
  };

  const handleAdvanceJob = (id: string, next: RepairStatus | null) => {
    if (!next) return;
    upsertJob(id, (job) => ({ ...appendJobActivity(job, `Avanzó a ${formatStatus(next)}.`), status: next }));
    setSelectedJobId(id);
    logAction(`Ticket ${id} pasó a ${formatStatus(next)}`);
  };

  const handleReassignJob = (id: string) => {
    upsertJob(id, (job) => {
      const currentIndex = TECHNICIANS.indexOf(job.assignedTo ?? "");
      const nextTech = TECHNICIANS[(currentIndex + 1 + TECHNICIANS.length) % TECHNICIANS.length];
      return appendJobActivity({ ...job, assignedTo: nextTech }, `Reasignado a ${nextTech}.`);
    });
    logAction(`Ticket ${id} reasignado`);
  };

  const handleUpdateStatus = (id: string, status: RepairStatus) => {
    upsertJob(id, (job) => {
      if (job.status === status) return job;
      return { ...appendJobActivity(job, `Estado actualizado manualmente a ${formatStatus(status)}.`), status };
    });
    logAction(`Estado de ${id} cambiado a ${formatStatus(status)}`);
  };

  const handleIssueMaterial = (jobId: string, materialId: string) => {
    upsertJob(jobId, (job) => {
      const materials = job.materials.map((material) => {
        if (material.id !== materialId) return material;
        const nextIssued = Math.min(material.quantity, material.issued + 1);
        return { ...material, issued: nextIssued };
      });
      return appendJobActivity({ ...job, materials }, "Material emitido desde inventario.");
    });
    logAction(`Material actualizado para ${jobId}`);
  };

  const handleReturnMaterial = (jobId: string, materialId: string) => {
    upsertJob(jobId, (job) => {
      const materials = job.materials.map((material) => {
        if (material.id !== materialId) return material;
        const nextUsed = Math.min(material.issued, material.used + 1);
        return { ...material, used: nextUsed };
      });
      return appendJobActivity({ ...job, materials }, "Consumo de material registrado.");
    });
    logAction(`Consumo registrado en ${jobId}`);
  };

  const handleToggleMilestone = (jobId: string, milestoneId: string, status: PaymentMilestoneStatus) => {
    upsertJob(jobId, (job) => {
      const milestones = job.milestones.map((milestone) =>
        milestone.id === milestoneId ? { ...milestone, status } : milestone,
      );
      return appendJobActivity({ ...job, milestones }, `Hito de pago marcado como ${status}.`);
    });
    logAction(`Milestone ${milestoneId} actualizado`);
  };

  const handleAddNote = (jobId: string, note: string) => {
    upsertJob(jobId, (job) => appendJobActivity({ ...job, notes: [note, ...job.notes] }, "Nota agregada."));
    logAction(`Nota añadida a ${jobId}`);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Repairs & Fabrications</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Coordina tickets de taller, materiales y cobros para entregar piezas impecables.
        </p>
      </div>

      <RepairsSummary metrics={summaryMetrics} />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-gradient-to-r from-white via-white to-slate-50 p-4 text-sm text-slate-600 shadow-sm dark:border-slate-800/70 dark:from-slate-950/60 dark:via-slate-950/40 dark:to-slate-900/60 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Sucursal</span>
          <select
            className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
          >
            <option value="all">Todas</option>
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900"
            checked={rushOnly}
            onChange={(event) => setRushOnly(event.target.checked)}
          />
          Solo rush
        </label>
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          {filteredJobs.length} trabajos en vista
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr,1fr]">
        <JobKanban
          jobs={filteredJobs}
          selectedId={selectedJobId}
          onSelect={setSelectedJobId}
          onAdvance={handleAdvanceJob}
          onReassign={handleReassignJob}
        />
        <JobDetail
          job={selectedJob}
          onUpdateStatus={handleUpdateStatus}
          onIssueMaterial={handleIssueMaterial}
          onReturnMaterial={handleReturnMaterial}
          onToggleMilestone={handleToggleMilestone}
          onAddNote={handleAddNote}
        />
      </div>

      {activityLog.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-r from-white via-white to-slate-50 p-4 text-sm text-slate-600 shadow-sm dark:border-slate-800/70 dark:from-slate-950/60 dark:via-slate-950/40 dark:to-slate-900/60 dark:text-slate-300">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">
              Bitácora global
            </p>
            <ul className="space-y-1 text-xs">
              {activityLog.map((entry, index) => (
                <li key={`${entry}-${index}`} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-sky-300" />
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
