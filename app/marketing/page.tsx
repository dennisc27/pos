import { MarketingSummary } from "@/components/marketing/marketing-summary";
import { MarketingCard } from "@/components/marketing/marketing-card";
import { CampaignPipeline } from "@/components/marketing/campaign-pipeline";
import { TemplateLibrary } from "@/components/marketing/template-library";
import { SegmentWorkbench } from "@/components/marketing/segment-workbench";
import { AutomationCenter } from "@/components/marketing/automation-center";
import { ReviewTracker } from "@/components/marketing/review-tracker";
import type {
  AutomationPlay,
  CampaignRecord,
  MarketingSummaryMetric,
  ReviewRecord,
  SegmentRecord,
  TemplateRecord
} from "@/components/marketing/types";
import { formatCurrency } from "@/components/marketing/utils";

const summaryMetrics: MarketingSummaryMetric[] = [
  {
    label: "Campañas activas",
    value: "8 en marcha",
    accent: "text-sky-600 dark:text-sky-300",
    change: { direction: "up", label: "+2 vs. semana pasada" }
  },
  {
    label: "Mensajes enviados hoy",
    value: "18,450",
    change: { direction: "up", label: "+14% engagement" }
  },
  {
    label: "Ingresos atribuidos 30d",
    value: formatCurrency(3_280_000),
    accent: "text-emerald-600 dark:text-emerald-300",
    change: { direction: "up", label: "+RD$420K" }
  },
  {
    label: "NPS promedio",
    value: "4.7 ⭐️",
    accent: "text-amber-600 dark:text-amber-300",
    change: { direction: "flat", label: "Sin cambio" }
  }
];

const campaigns: CampaignRecord[] = [
  {
    id: "camp-1",
    name: "Recordatorio préstamos vence hoy",
    channel: "whatsapp",
    segment: "Préstamos vencen 24h",
    status: "sending",
    schedule: "Enviando · 10:00 a. m.",
    owner: "Gabriela",
    metrics: {
      sent: 1280,
      delivered: 1214,
      openRate: 0.92,
      replyRate: 0.34,
      revenue: 420_500
    }
  },
  {
    id: "camp-2",
    name: "Flash sale relojes suizos",
    channel: "email",
    segment: "VIP Joyeros",
    status: "completed",
    schedule: "Ayer · 6:30 p. m.",
    owner: "Marketing",
    metrics: {
      sent: 1840,
      delivered: 1772,
      openRate: 0.68,
      clickRate: 0.41,
      revenue: 1_280_000
    }
  },
  {
    id: "camp-3",
    name: "Cumpleaños junio",
    channel: "sms",
    segment: "Clientes cumpleaños 7 días",
    status: "scheduled",
    schedule: "Programada · 7:45 a. m.",
    owner: "Auto",
    metrics: {
      sent: 620,
      delivered: 612,
      replyRate: 0.22
    }
  }
];

const templates: TemplateRecord[] = [
  {
    id: "tpl-1",
    name: "Renovación préstamo sin filas",
    category: "Préstamos",
    channel: "whatsapp",
    lastEdited: "hace 2 h",
    usageCount: 186,
    status: "approved",
    tags: ["renovaciones", "autopay"]
  },
  {
    id: "tpl-2",
    name: "Oferta layaway verano",
    category: "Retail",
    channel: "sms",
    lastEdited: "ayer",
    usageCount: 92,
    status: "pending",
    tags: ["promoción"]
  },
  {
    id: "tpl-3",
    name: "Encuesta servicio",
    category: "Experiencia",
    channel: "email",
    lastEdited: "hace 3 días",
    usageCount: 248,
    status: "approved",
    tags: ["nps", "post-venta"]
  },
  {
    id: "tpl-4",
    name: "Campaña Black Friday",
    category: "Retail",
    channel: "email",
    lastEdited: "hace 5 días",
    usageCount: 12,
    status: "draft",
    tags: ["planificado"]
  }
];

const segments: SegmentRecord[] = [
  {
    id: "seg-1",
    name: "VIP Alta Joyería",
    size: 428,
    growth: { direction: "up", label: "+38 este mes" },
    traits: ["Ticket > RD$80K", "Renovaciones puntuales", "Prefiere WhatsApp"],
    lastSync: "hoy 09:15"
  },
  {
    id: "seg-2",
    name: "Dormidos 90 días",
    size: 1_820,
    growth: { direction: "down", label: "-64 reactivados" },
    traits: ["Sin visitas 3 meses", "Historial layaway", "SMS opt-in"],
    lastSync: "hoy 08:40"
  },
  {
    id: "seg-3",
    name: "Renovación crítica",
    size: 612,
    growth: { direction: "flat", label: "Estable" },
    traits: ["Loan vence < 3d", "Monto > RD$15K", "Autopay"],
    lastSync: "ayer 19:20"
  }
];

const automations: AutomationPlay[] = [
  {
    id: "auto-1",
    trigger: "Loan vence en 72h",
    description: "Secuencia WhatsApp + SMS con botón pagar ahora y oferta de extensión.",
    channel: "whatsapp",
    status: "active",
    lastRun: "hoy 08:55",
    nextRun: "en 30 min",
    audience: "712 contactos"
  },
  {
    id: "auto-2",
    trigger: "Primer layaway creado",
    description: "Email onboarding con tips de pago, recordatorios automáticos y cross-sell.",
    channel: "email",
    status: "testing",
    lastRun: "ayer 17:10",
    nextRun: "mañana 09:00",
    audience: "Nuevo layaway"
  },
  {
    id: "auto-3",
    trigger: "Encuesta post venta",
    description: "SMS + WhatsApp invitando a calificar servicio 24h después de la compra.",
    channel: "sms",
    status: "paused",
    lastRun: "06 jun · 6:20 p. m.",
    nextRun: "Esperando reactivación",
    audience: "Todos POS"
  }
];

const reviews: ReviewRecord[] = [
  {
    id: "rev-1",
    source: "google",
    rating: 5,
    customer: "Camila Reyes",
    snippet: "Excelente atención y seguimiento, renové mi préstamo en minutos.",
    receivedAt: "Hoy · 9:12 a. m.",
    status: "responded",
    channel: "whatsapp"
  },
  {
    id: "rev-2",
    source: "facebook",
    rating: 4,
    customer: "Edgar Morales",
    snippet: "El recordatorio de layaway llegó a tiempo, solo mejoraría tiempos de cola.",
    receivedAt: "Ayer · 7:45 p. m.",
    status: "new",
    channel: "email"
  },
  {
    id: "rev-3",
    source: "survey",
    rating: 3,
    customer: "Luis Ángel Bautista",
    snippet: "Buen trato, pero el mensaje automático no resolvió mi caso, tuve que llamar.",
    receivedAt: "Ayer · 11:05 a. m.",
    status: "flagged",
    channel: "sms"
  }
];

export default function MarketingPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Marketing & Engagement</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Coordina campañas, automatizaciones y reputación para mantener activos los clientes del programa.
        </p>
      </div>

      <MarketingSummary metrics={summaryMetrics} />

      <div className="grid gap-6 xl:grid-cols-3">
        <MarketingCard
          title="Campañas en ejecución"
          subtitle="Estado en tiempo real de los envíos masivos"
          action="Ver historial"
          className="xl:col-span-2"
        >
          <CampaignPipeline campaigns={campaigns} />
        </MarketingCard>

        <MarketingCard
          title="Biblioteca de plantillas"
          subtitle="Mensajes aprobados por canal"
          action="Gestionar plantillas"
        >
          <TemplateLibrary templates={templates} />
        </MarketingCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <MarketingCard
          title="Segmentos dinámicos"
          subtitle="Audiencias inteligentes para activar campañas"
          action="Construir segmento"
        >
          <SegmentWorkbench segments={segments} />
        </MarketingCard>

        <MarketingCard
          title="Automatizaciones"
          subtitle="Journeys críticos configurados"
          action="Ver recorridos"
          className="xl:col-span-2"
        >
          <AutomationCenter automations={automations} />
        </MarketingCard>
      </div>

      <MarketingCard
        title="Pulso de reseñas"
        subtitle="Seguimiento a reputación y respuestas"
        action="Abrir panel NPS"
      >
        <ReviewTracker reviews={reviews} />
      </MarketingCard>
    </div>
  );
}
