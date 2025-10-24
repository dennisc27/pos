"use client";

import { useMemo, useState } from "react";

import { LoanSummary } from "@/components/loans/loan-summary";
import { LoanQueue } from "@/components/loans/loan-queue";
import { RenewalTargets } from "@/components/loans/renewal-targets";
import { CollateralMix } from "@/components/loans/collateral-mix";
import { LoanActivity } from "@/components/loans/loan-activity";
import type {
  LoanActivityEvent,
  LoanQueueItem,
  LoanSummaryMetric,
  RenewalCandidate,
  CollateralMixItem,
  RiskBand,
} from "@/components/loans/types";
import { formatContactTimestamp, formatCurrency } from "@/components/loans/utils";

const summaryBaselines = {
  active: 1248,
  principal: 5_850_000,
  dueToday: 32,
  delinquent: 18,
};

const INITIAL_DUE_LOANS: LoanQueueItem[] = [
  {
    id: "due-1",
    ticket: "P-20451",
    customer: "Marta Cabrera",
    collateral: "Anillo solitario 14K · 1.2ct",
    branch: "Santo Domingo Centro",
    principal: 32_500,
    accrued: 1_800,
    dueDate: "2024-06-18",
    dueDescriptor: "Hoy 4:00 p. m.",
    risk: "medium",
    contactPreference: "WhatsApp",
    status: "due_today",
    lastContactAt: "2024-06-17T17:30:00-04:00",
    lastContactChannel: "WhatsApp",
    contactNotes: "Confirmó visita vespertina",
  },
  {
    id: "due-2",
    ticket: "P-20446",
    customer: "Luis Peña",
    collateral: "MacBook Pro 13\"",
    branch: "La Romana",
    principal: 48_500,
    accrued: 2_450,
    dueDate: "2024-06-18",
    dueDescriptor: "Hoy 6:00 p. m.",
    risk: "low",
    contactPreference: "SMS",
    status: "due_today",
    lastContactAt: "2024-06-18T08:15:00-04:00",
    lastContactChannel: "SMS",
    contactNotes: "Recordatorio enviado",
  },
  {
    id: "due-3",
    ticket: "P-20437",
    customer: "Altagracia R.",
    collateral: "Reloj Rolex Datejust",
    branch: "Santiago",
    principal: 165_000,
    accrued: 9_200,
    dueDate: "2024-06-18",
    dueDescriptor: "Hoy 12:00 m.",
    risk: "high",
    contactPreference: "Call",
    status: "due_today",
    promiseToPay: "18 jun · 5:00 p. m.",
  },
  {
    id: "due-4",
    ticket: "P-20422",
    customer: "Pedro Santos",
    collateral: "Herramientas Milwaukee set",
    branch: "Santo Domingo Oeste",
    principal: 14_500,
    accrued: 650,
    dueDate: "2024-06-18",
    dueDescriptor: "Hoy 3:30 p. m.",
    risk: "medium",
    contactPreference: "SMS",
    status: "due_today",
  },
];

const INITIAL_PAST_DUE_LOANS: LoanQueueItem[] = [
  {
    id: "pd-1",
    ticket: "P-20388",
    customer: "Franklin de Jesús",
    collateral: "Cadena cubana 18K",
    branch: "Santo Domingo Centro",
    principal: 58_500,
    accrued: 5_100,
    dueDate: "2024-06-12",
    dueDescriptor: "6 días atraso",
    risk: "high",
    contactPreference: "Call",
    status: "past_due",
    lastContactAt: "2024-06-17T12:05:00-04:00",
    lastContactChannel: "Call",
    contactNotes: "Prometió pasar hoy",
    promiseToPay: "18 jun · 6:30 p. m.",
  },
  {
    id: "pd-2",
    ticket: "P-20361",
    customer: "Carla Núñez",
    collateral: "iPhone 15 Pro Max",
    branch: "San Cristóbal",
    principal: 42_000,
    accrued: 3_600,
    dueDate: "2024-06-10",
    dueDescriptor: "8 días atraso",
    risk: "medium",
    contactPreference: "WhatsApp",
    status: "past_due",
    lastContactAt: "2024-06-16T18:40:00-04:00",
    lastContactChannel: "WhatsApp",
    contactNotes: "Solicitó extensión",
  },
  {
    id: "pd-3",
    ticket: "P-20329",
    customer: "Rafael G.",
    collateral: "Motocicleta Honda 125cc",
    branch: "La Romana",
    principal: 76_500,
    accrued: 6_800,
    dueDate: "2024-06-05",
    dueDescriptor: "13 días atraso",
    risk: "high",
    contactPreference: "Call",
    status: "past_due",
    promiseToPay: "20 jun",
  },
];

const renewalCandidates: RenewalCandidate[] = [
  {
    id: "ren-1",
    customer: "Génesis Tejada",
    ticket: "P-20410",
    outstanding: 21_500,
    maturity: "mañana",
    lastAction: "WhatsApp enviado ayer",
    channel: "WhatsApp",
    probability: 0.78,
  },
  {
    id: "ren-2",
    customer: "Josefina M.",
    ticket: "P-20398",
    outstanding: 18_500,
    maturity: "en 2 días",
    lastAction: "Llamada contestada",
    channel: "Call",
    probability: 0.64,
  },
  {
    id: "ren-3",
    customer: "Wilkin Rosario",
    ticket: "P-20386",
    outstanding: 9_500,
    maturity: "en 3 días",
    lastAction: "SMS rebotado",
    channel: "SMS",
    probability: 0.42,
  },
];

const collateralMix: CollateralMixItem[] = [
  {
    category: "Joyería oro",
    percentage: 0.46,
    trend: "up",
    detail: "+4 pts vs. mes anterior",
  },
  {
    category: "Electrónica",
    percentage: 0.28,
    trend: "down",
    detail: "-2 pts",
  },
  {
    category: "Herramientas",
    percentage: 0.12,
    trend: "flat",
    detail: "Sin cambio",
  },
  {
    category: "Vehículos ligeros",
    percentage: 0.09,
    trend: "up",
    detail: "+1 pt",
  },
  {
    category: "Otros",
    percentage: 0.05,
    trend: "flat",
    detail: "Controlado",
  },
];

const riskBands: RiskBand[] = [
  { label: "Verde", count: 912, descriptor: "Clientes al día" },
  { label: "Ámbar", count: 236, descriptor: "Renovación próxima" },
  { label: "Rojo", count: 100, descriptor: "Mora >5 días" },
];

const INITIAL_ACTIVITY: LoanActivityEvent[] = [
  {
    id: "act-1",
    time: "10:05",
    type: "renewal",
    title: "Renovación aplicada ticket P-20354",
    description: "Cliente pagó intereses RD$4,200 y se extendió 30 días",
    amount: 4_200,
    actor: "María P.",
  },
  {
    id: "act-2",
    time: "09:48",
    type: "payment",
    title: "Pago parcial RD$6,500 ticket P-20401",
    description: "Aplicado a intereses y storage fee",
    amount: 6_500,
    actor: "Caja 01",
  },
  {
    id: "act-3",
    time: "09:20",
    type: "notification",
    title: "SMS automático: recordatorio vencimiento",
    description: "Se envió mensaje a 18 clientes con vencimiento hoy",
    actor: "Motor campañas",
  },
  {
    id: "act-4",
    time: "08:55",
    type: "redemption",
    title: "Redención completada ticket P-20322",
    description: "Cliente retiró joyería tras pago total RD$58,700",
    amount: 58_700,
    actor: "Laura G.",
  },
];

type LoanFilters = {
  search: string;
  branch: string;
  risk: "all" | "low" | "medium" | "high";
  contact: "all" | "SMS" | "WhatsApp" | "Call";
};

function filterLoans(loans: LoanQueueItem[], filters: LoanFilters) {
  return loans.filter((loan) => {
    const matchesSearch = filters.search
      ? [loan.ticket, loan.customer, loan.collateral]
          .join(" ")
          .toLowerCase()
          .includes(filters.search.toLowerCase())
      : true;
    const matchesBranch = filters.branch === "all" || loan.branch === filters.branch;
    const matchesRisk = filters.risk === "all" || loan.risk === filters.risk;
    const matchesContact = filters.contact === "all" || loan.contactPreference === filters.contact;

    return matchesSearch && matchesBranch && matchesRisk && matchesContact;
  });
}

function createActivity(event: Omit<LoanActivityEvent, "id">): LoanActivityEvent {
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...event,
  };
}

function nextActivityTime() {
  return new Date().toLocaleTimeString("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LoansPage() {
  const [dueLoans, setDueLoans] = useState(INITIAL_DUE_LOANS);
  const [pastDueLoans, setPastDueLoans] = useState(INITIAL_PAST_DUE_LOANS);
  const [selectedDue, setSelectedDue] = useState<string[]>([]);
  const [selectedPastDue, setSelectedPastDue] = useState<string[]>([]);
  const [dueFilters, setDueFilters] = useState<LoanFilters>({
    search: "",
    branch: "all",
    risk: "all",
    contact: "all",
  });
  const [pastDueFilters, setPastDueFilters] = useState<LoanFilters>({
    search: "",
    branch: "all",
    risk: "all",
    contact: "all",
  });
  const [activity, setActivity] = useState(INITIAL_ACTIVITY);

  const branches = useMemo(() => {
    const unique = new Set([...dueLoans, ...pastDueLoans].map((loan) => loan.branch));
    return ["all", ...Array.from(unique).sort()];
  }, [dueLoans, pastDueLoans]);

  const filteredDue = useMemo(() => filterLoans(dueLoans, dueFilters), [dueLoans, dueFilters]);
  const filteredPastDue = useMemo(
    () => filterLoans(pastDueLoans, pastDueFilters),
    [pastDueLoans, pastDueFilters],
  );

  const dueTodayTotal = filteredDue.reduce((sum, loan) => sum + loan.principal + (loan.accrued ?? 0), 0);
  const pastDueTotal = filteredPastDue.reduce((sum, loan) => sum + loan.principal + (loan.accrued ?? 0), 0);

  const summaryMetrics: LoanSummaryMetric[] = [
    {
      label: "Nuevos hoy",
      value: `${summaryBaselines.active + dueLoans.length + pastDueLoans.length - (INITIAL_DUE_LOANS.length + INITIAL_PAST_DUE_LOANS.length)} préstamos`,
      accent: "text-emerald-600 dark:text-emerald-300",
      change: { direction: "up", label: "+3.1% vs. mes pasado" },
    },
    {
      label: "Monto hoy",
      value: formatCurrency(summaryBaselines.principal + dueLoans.reduce((sum, loan) => sum + loan.principal, 0) + pastDueLoans.reduce((sum, loan) => sum + loan.principal, 0) -
        (INITIAL_DUE_LOANS.reduce((sum, loan) => sum + loan.principal, 0) + INITIAL_PAST_DUE_LOANS.reduce((sum, loan) => sum + loan.principal, 0))),
      change: { direction: "up", label: "+RD$182K" },
    },
    {
      label: "Renovaciones hoy",
      value: `${filteredDue.length} tickets`,
      accent: "text-amber-600 dark:text-amber-300",
    },
    {
      label: "En mora",
      value: `${filteredPastDue.length} clientes`,
      accent: "text-rose-500 dark:text-rose-300",
      change: { direction: "down", label: "-2 casos" },
    },
  ];

  const appendActivity = (event: Omit<LoanActivityEvent, "id">) => {
    setActivity((current) => [createActivity(event), ...current].slice(0, 12));
  };

  const updateLoan = (
    queue: "due" | "past",
    id: string,
    updater: (loan: LoanQueueItem) => LoanQueueItem,
  ) => {
    if (queue === "due") {
      setDueLoans((items) => items.map((loan) => (loan.id === id ? updater(loan) : loan)));
    } else {
      setPastDueLoans((items) => items.map((loan) => (loan.id === id ? updater(loan) : loan)));
    }
  };

  const handleLogContact = (queue: "due" | "past", loan: LoanQueueItem, notes?: string) => {
    const timestamp = new Date().toISOString();
    const contactNotes = notes?.trim() || `Gestión registrada ${formatContactTimestamp(timestamp)}`;

    updateLoan(queue, loan.id, (current) => ({
      ...current,
      lastContactAt: timestamp,
      lastContactChannel: loan.contactPreference,
      contactNotes,
    }));

    appendActivity({
      time: nextActivityTime(),
      type: "notification",
      title: `Seguimiento ${loan.ticket}`,
      description: `${loan.contactPreference} a ${loan.customer}: ${contactNotes}`,
      actor: "Gestión cartera",
    });
  };

  const handleBulkReminder = (queue: "due" | "past") => {
    const selected = queue === "due" ? selectedDue : selectedPastDue;
    if (!selected.length) return;

    const now = new Date();
    selected.forEach((id) => {
      const targetLoan = (queue === "due" ? dueLoans : pastDueLoans).find((loan) => loan.id === id);
      if (!targetLoan) return;
      const note = `Recordatorio masivo ${now.toLocaleTimeString("es-DO", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
      handleLogContact(queue, targetLoan, note);
    });

    appendActivity({
      time: nextActivityTime(),
      type: "notification",
      title: `Recordatorio enviado (${selected.length})`,
      description: `Se disparó campaña ${queue === "due" ? "vencen hoy" : "mora"}`,
      actor: "Motor campañas",
    });

    if (queue === "due") {
      setSelectedDue([]);
    } else {
      setSelectedPastDue([]);
    }
  };

  const handleToggleSelection = (queue: "due" | "past", id: string) => {
    if (queue === "due") {
      setSelectedDue((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      );
    } else {
      setSelectedPastDue((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      );
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      <LoanSummary metrics={summaryMetrics} />
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <LoanQueue
          title="Vencen hoy"
          subtitle={`Total ${formatCurrency(dueTodayTotal)}`}
          actionLabel="Enviar recordatorio masivo"
          actionDisabled={!selectedDue.length}
          onAction={() => handleBulkReminder("due")}
          items={filteredDue}
          selectedIds={selectedDue}
          onToggleSelect={(id) => handleToggleSelection("due", id)}
          onLogContact={(loan) => handleLogContact("due", loan)}
          toolbar={
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                value={dueFilters.search}
                onChange={(event) => setDueFilters((filters) => ({ ...filters, search: event.target.value }))}
                placeholder="Buscar ticket, cliente o garantía"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <div className="flex flex-wrap gap-2">
                <select
                  value={dueFilters.branch}
                  onChange={(event) => setDueFilters((filters) => ({ ...filters, branch: event.target.value }))}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch === "all" ? "Todas las sucursales" : branch}
                    </option>
                  ))}
                </select>
                <select
                  value={dueFilters.risk}
                  onChange={(event) =>
                    setDueFilters((filters) => ({
                      ...filters,
                      risk: event.target.value as LoanFilters["risk"],
                    }))
                  }
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="all">Todos los riesgos</option>
                  <option value="low">Bajo riesgo</option>
                  <option value="medium">Riesgo medio</option>
                  <option value="high">Riesgo alto</option>
                </select>
                <select
                  value={dueFilters.contact}
                  onChange={(event) =>
                    setDueFilters((filters) => ({
                      ...filters,
                      contact: event.target.value as LoanFilters["contact"],
                    }))
                  }
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="all">Todos los canales</option>
                  <option value="SMS">SMS</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Call">Llamadas</option>
                </select>
              </div>
            </div>
          }
          footer={
            selectedDue.length ? (
              <p className="px-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {selectedDue.length} préstamos seleccionados para seguimiento.
              </p>
            ) : null
          }
        />
        <RenewalTargets candidates={renewalCandidates} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <LoanQueue
          title="Cartera en mora"
          subtitle={`Recuperación pendiente ${formatCurrency(pastDueTotal)}`}
          actionLabel="Registrar campaña de cobranza"
          actionDisabled={!selectedPastDue.length}
          onAction={() => handleBulkReminder("past")}
          items={filteredPastDue}
          selectedIds={selectedPastDue}
          onToggleSelect={(id) => handleToggleSelection("past", id)}
          onLogContact={(loan) => handleLogContact("past", loan)}
          toolbar={
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                value={pastDueFilters.search}
                onChange={(event) =>
                  setPastDueFilters((filters) => ({ ...filters, search: event.target.value }))
                }
                placeholder="Buscar ticket, cliente o garantía"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <div className="flex flex-wrap gap-2">
                <select
                  value={pastDueFilters.branch}
                  onChange={(event) =>
                    setPastDueFilters((filters) => ({ ...filters, branch: event.target.value }))
                  }
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch === "all" ? "Todas las sucursales" : branch}
                    </option>
                  ))}
                </select>
                <select
                  value={pastDueFilters.risk}
                  onChange={(event) =>
                    setPastDueFilters((filters) => ({
                      ...filters,
                      risk: event.target.value as LoanFilters["risk"],
                    }))
                  }
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="all">Todos los riesgos</option>
                  <option value="low">Bajo riesgo</option>
                  <option value="medium">Riesgo medio</option>
                  <option value="high">Riesgo alto</option>
                </select>
                <select
                  value={pastDueFilters.contact}
                  onChange={(event) =>
                    setPastDueFilters((filters) => ({
                      ...filters,
                      contact: event.target.value as LoanFilters["contact"],
                    }))
                  }
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="all">Todos los canales</option>
                  <option value="SMS">SMS</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Call">Llamadas</option>
                </select>
              </div>
            </div>
          }
          footer={
            selectedPastDue.length ? (
              <p className="px-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {selectedPastDue.length} préstamos listos para gestión de cobranza.
              </p>
            ) : null
          }
        />
        <CollateralMix mix={collateralMix} riskBands={riskBands} />
      </div>
      <LoanActivity events={activity} />
    </div>
  );
}
