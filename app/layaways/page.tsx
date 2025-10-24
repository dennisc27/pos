import { LayawaySummary } from "@/components/layaways/layaway-summary";
import { LayawayQueue } from "@/components/layaways/layaway-queue";
import { PaymentForecast } from "@/components/layaways/payment-forecast";
import { EngagementCenter } from "@/components/layaways/engagement-center";
import type {
  EngagementReminder,
  LayawayPlan,
  LayawaySummaryMetric,
  PaymentScheduleItem,
  UpsellInsight
} from "@/components/layaways/types";
import { formatCurrency } from "@/components/layaways/utils";

const summaryMetrics: LayawaySummaryMetric[] = [
  {
    label: "Activos",
    value: "326 planes",
    accent: "text-emerald-600 dark:text-emerald-300",
    change: { direction: "up", label: "+12 vs. semana pasada" }
  },
  {
    label: "Inventario comprometido",
    value: formatCurrency(14_280_000),
    change: { direction: "up", label: "+RD$420K" }
  },
  {
    label: "Cuotas vencidas",
    value: formatCurrency(182_450),
    accent: "text-amber-600 dark:text-amber-300",
    change: { direction: "down", label: "-6% mora" }
  },
  {
    label: "Planes completados",
    value: "28 este mes",
    accent: "text-sky-600 dark:text-sky-300",
    change: { direction: "up", label: "+18% vs. mayo" }
  }
];

const activePlans: LayawayPlan[] = [
  {
    id: "lay-1",
    planNumber: "LA-5480",
    customer: "Camila Reyes",
    item: "Anillo compromiso 18K · 1.0ct",
    branch: "Santo Domingo Centro",
    total: 64_500,
    balance: 35_800,
    deposit: 15_000,
    nextPaymentDate: "20 jun · 4:00 p. m.",
    nextPaymentAmount: 5_850,
    status: "active",
    autopay: true,
    lastPayment: "05 jun",
    contactPreference: "WhatsApp",
    risk: "low"
  },
  {
    id: "lay-2",
    planNumber: "LA-5476",
    customer: "Edgar Morales",
    item: "PlayStation 5 + 2 mandos",
    branch: "Santo Domingo Oeste",
    total: 48_900,
    balance: 21_400,
    deposit: 9_500,
    nextPaymentDate: "22 jun · 6:30 p. m.",
    nextPaymentAmount: 4_950,
    status: "active",
    autopay: false,
    lastPayment: "02 jun",
    contactPreference: "SMS",
    risk: "medium",
    promiseToPay: "21 jun"
  },
  {
    id: "lay-3",
    planNumber: "LA-5464",
    customer: "Ivonne Cabrera",
    item: "MacBook Air 15\" M3",
    branch: "Santiago",
    total: 98_500,
    balance: 58_900,
    deposit: 20_000,
    nextPaymentDate: "24 jun · 11:00 a. m.",
    nextPaymentAmount: 7_250,
    status: "active",
    autopay: true,
    lastPayment: "09 jun",
    contactPreference: "Email",
    risk: "low"
  },
  {
    id: "lay-4",
    planNumber: "LA-5450",
    customer: "Samuel Hernández",
    item: "Set herramientas Milwaukee",
    branch: "La Romana",
    total: 34_200,
    balance: 12_800,
    deposit: 6_500,
    nextPaymentDate: "25 jun · 5:00 p. m.",
    nextPaymentAmount: 3_200,
    status: "active",
    autopay: false,
    lastPayment: "10 jun",
    contactPreference: "Call",
    risk: "medium"
  }
];

const overduePlans: LayawayPlan[] = [
  {
    id: "over-1",
    planNumber: "LA-5312",
    customer: "Yulissa Fernández",
    item: "Collar esmeralda 14K",
    branch: "Santo Domingo Centro",
    total: 72_800,
    balance: 21_750,
    deposit: 18_000,
    nextPaymentDate: "Vencido · 15 jun",
    nextPaymentAmount: 6_250,
    status: "overdue",
    autopay: false,
    lastPayment: "28 may",
    contactPreference: "WhatsApp",
    risk: "high",
    promiseToPay: "Hoy 6:00 p. m."
  },
  {
    id: "over-2",
    planNumber: "LA-5298",
    customer: "Luis Ángel Bautista",
    item: "Televisor Samsung 75\"",
    branch: "San Cristóbal",
    total: 89_900,
    balance: 32_400,
    deposit: 12_500,
    nextPaymentDate: "Vencido · 12 jun",
    nextPaymentAmount: 5_900,
    status: "overdue",
    autopay: false,
    lastPayment: "24 may",
    contactPreference: "Call",
    risk: "high"
  },
  {
    id: "over-3",
    planNumber: "LA-5287",
    customer: "María López",
    item: "Set aros diamante 0.75ct",
    branch: "Santiago",
    total: 58_400,
    balance: 14_600,
    deposit: 16_000,
    nextPaymentDate: "Vencido · 10 jun",
    nextPaymentAmount: 4_200,
    status: "overdue",
    autopay: true,
    lastPayment: "16 may",
    contactPreference: "SMS",
    risk: "medium",
    promiseToPay: "20 jun"
  }
];

const paymentSchedule: PaymentScheduleItem[] = [
  {
    id: "sched-1",
    dueDate: "19 jun",
    customer: "José Montero",
    planNumber: "LA-5478",
    amount: 3_450,
    channel: "auto",
    status: "processing",
    notes: "Tarjeta AZUL terminación 4021"
  },
  {
    id: "sched-2",
    dueDate: "20 jun",
    customer: "Camila Reyes",
    planNumber: "LA-5480",
    amount: 5_850,
    channel: "auto",
    status: "scheduled",
    notes: "Se notificó recordatorio 24 h"
  },
  {
    id: "sched-3",
    dueDate: "21 jun",
    customer: "Edgar Morales",
    planNumber: "LA-5476",
    amount: 4_950,
    channel: "cash",
    status: "scheduled",
    notes: "Prometió pasar por sucursal Oeste"
  },
  {
    id: "sched-4",
    dueDate: "22 jun",
    customer: "Génesis Tejada",
    planNumber: "LA-5462",
    amount: 2_750,
    channel: "transfer",
    status: "completed",
    notes: "Transferencia Banco Popular confirmada"
  }
];

const reminders: EngagementReminder[] = [
  {
    id: "rem-1",
    planNumber: "LA-5298",
    customer: "Luis Ángel Bautista",
    message: "Tu cuota RD$5,900 está vencida. Responde este WhatsApp para coordinar pago y evitar cancelación.",
    channel: "WhatsApp",
    scheduledFor: "Hoy · 2:00 p. m.",
    status: "scheduled"
  },
  {
    id: "rem-2",
    planNumber: "LA-5476",
    customer: "Edgar Morales",
    message: "Recordatorio de cuota RD$4,950. Tenemos pick-up express disponible mañana hasta las 8 p. m.",
    channel: "SMS",
    scheduledFor: "Hoy · 5:30 p. m.",
    status: "queued"
  },
  {
    id: "rem-3",
    planNumber: "LA-5480",
    customer: "Camila Reyes",
    message: "Confirmamos AutoCobro mañana. Puedes ver tu recibo digital desde el portal de clientes.",
    channel: "Email",
    scheduledFor: "19 jun · 8:00 a. m.",
    status: "sent"
  }
];

const insights: UpsellInsight[] = [
  {
    id: "ins-1",
    title: "Activa autopago para los planes con mora recurrente",
    description:
      "9 clientes en mora 2+ veces aún pagan en efectivo. Incentiva AutoCobro con 5% de descuento en cuota final.",
    impact: "high"
  },
  {
    id: "ins-2",
    title: "Ofrece cross-sell a clientes con plan completado",
    description:
      "28 planes cerrados este mes: envía cupón de 10% en ventas al contado o upgrade de garantía extendida.",
    impact: "medium"
  },
  {
    id: "ins-3",
    title: "Optimiza inventario reservado",
    description:
      "RD$1.2M en joyería comprometida >45 días. Coordina reposición en vitrinas secundarias para evitar rotación lenta.",
    impact: "medium"
  }
];

export default function LayawaysPage() {
  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Layaways</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Controla los planes de apartado activos, pagos programados y seguimientos automáticos.
        </p>
      </div>

      <LayawaySummary metrics={summaryMetrics} />

      <div className="grid gap-6 xl:grid-cols-[1.8fr_1.2fr]">
        <LayawayQueue
          title="Planes activos"
          subtitle="Prioriza cuotas próximas a vencer y confirma promesas de pago"
          plans={activePlans}
          actionLabel="Nuevo layaway"
        />
        <PaymentForecast items={paymentSchedule} autopayPenetration={0.46} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1.6fr]">
        <LayawayQueue
          title="En mora y riesgo de cancelación"
          subtitle="Contacta a los clientes con más de 5 días de atraso"
          plans={overduePlans}
          actionLabel="Ver moras"
        />
        <EngagementCenter reminders={reminders} insights={insights} />
      </div>
    </div>
  );
}
