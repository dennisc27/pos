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
  RiskBand
} from "@/components/loans/types";
import { formatCurrency } from "@/components/loans/utils";

const summaryMetrics: LoanSummaryMetric[] = [
  {
    label: "Activos",
    value: "1,248 préstamos",
    accent: "text-emerald-300",
    change: { direction: "up", label: "+3.1% vs. mes pasado" }
  },
  {
    label: "Principal vigente",
    value: formatCurrency(5_850_000),
    change: { direction: "up", label: "+RD$182K" }
  },
  {
    label: "Vencen hoy",
    value: "32 tickets",
    accent: "text-amber-300"
  },
  {
    label: "En mora",
    value: "18 clientes",
    accent: "text-rose-300",
    change: { direction: "down", label: "-2 casos" }
  }
];

const dueTodayLoans: LoanQueueItem[] = [
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
    status: "due_today"
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
    status: "due_today"
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
    status: "due_today"
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
    status: "due_today"
  }
];

const pastDueLoans: LoanQueueItem[] = [
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
    status: "past_due"
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
    status: "past_due"
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
    status: "past_due"
  }
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
    probability: 0.78
  },
  {
    id: "ren-2",
    customer: "Josefina M.",
    ticket: "P-20398",
    outstanding: 18_500,
    maturity: "en 2 días",
    lastAction: "Llamada contestada",
    channel: "Call",
    probability: 0.64
  },
  {
    id: "ren-3",
    customer: "Wilkin Rosario",
    ticket: "P-20386",
    outstanding: 9_500,
    maturity: "en 3 días",
    lastAction: "SMS rebotado",
    channel: "SMS",
    probability: 0.42
  }
];

const collateralMix: CollateralMixItem[] = [
  {
    category: "Joyería oro",
    percentage: 0.46,
    trend: "up",
    detail: "+4 pts vs. mes anterior"
  },
  {
    category: "Electrónica",
    percentage: 0.28,
    trend: "down",
    detail: "-2 pts"
  },
  {
    category: "Herramientas",
    percentage: 0.12,
    trend: "flat",
    detail: "Sin cambio"
  },
  {
    category: "Vehículos ligeros",
    percentage: 0.09,
    trend: "up",
    detail: "+1 pt"
  },
  {
    category: "Otros",
    percentage: 0.05,
    trend: "flat",
    detail: "Controlado"
  }
];

const riskBands: RiskBand[] = [
  { label: "Verde", count: 912, descriptor: "Clientes al día" },
  { label: "Ámbar", count: 236, descriptor: "Renovación próxima" },
  { label: "Rojo", count: 100, descriptor: "Mora >5 días" }
];

const loanActivity: LoanActivityEvent[] = [
  {
    id: "act-1",
    time: "10:05",
    type: "renewal",
    title: "Renovación aplicada ticket P-20354",
    description: "Cliente pagó intereses RD$4,200 y se extendió 30 días",
    amount: 4_200,
    actor: "María P."
  },
  {
    id: "act-2",
    time: "09:48",
    type: "payment",
    title: "Pago parcial RD$6,500 ticket P-20401",
    description: "Aplicado a intereses y storage fee",
    amount: 6_500,
    actor: "Caja 01"
  },
  {
    id: "act-3",
    time: "09:20",
    type: "notification",
    title: "SMS automático: recordatorio vencimiento",
    description: "Se envió mensaje a 18 clientes con vencimiento hoy",
    actor: "Motor campañas"
  },
  {
    id: "act-4",
    time: "08:55",
    type: "redemption",
    title: "Redención completada ticket P-20322",
    description: "Cliente retiró joyería tras pago total RD$58,700",
    amount: 58_700,
    actor: "Laura G."
  }
];

export default function LoansPage() {
  const dueTodayTotal = dueTodayLoans.reduce((sum, loan) => sum + loan.principal + (loan.accrued ?? 0), 0);
  const pastDueTotal = pastDueLoans.reduce((sum, loan) => sum + loan.principal + (loan.accrued ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <LoanSummary metrics={summaryMetrics} />
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <LoanQueue
          title="Vencen hoy"
          subtitle={`Total ${formatCurrency(dueTodayTotal)}`}
          actionLabel="Enviar recordatorio masivo"
          items={dueTodayLoans}
        />
        <RenewalTargets candidates={renewalCandidates} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <LoanQueue
          title="Cartera en mora"
          subtitle={`Recuperación pendiente ${formatCurrency(pastDueTotal)}`}
          actionLabel="Generar plan de cobranza"
          items={pastDueLoans}
        />
        <CollateralMix mix={collateralMix} riskBands={riskBands} />
      </div>
      <LoanActivity events={loanActivity} />
    </div>
  );
}
