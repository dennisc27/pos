import { CrmSummary } from "@/components/crm/crm-summary";
import { CrmCard } from "@/components/crm/crm-card";
import { CustomerList } from "@/components/crm/customer-list";
import { CustomerProfile } from "@/components/crm/customer-profile";
import { MessagesCenter } from "@/components/crm/messages-center";
import { LoyaltyLedger } from "@/components/crm/loyalty-ledger";
import type {
  Conversation,
  CrmSummaryMetric,
  CustomerProfileDetails,
  CustomerRecord,
  EngagementPlay,
  LoyaltyLedgerEntry,
  MessageThread
} from "@/components/crm/types";
import { formatCurrency } from "@/components/crm/utils";

const summaryMetrics: CrmSummaryMetric[] = [
  {
    label: "Clientes activos",
    value: "18,420",
    accent: "text-sky-600 dark:text-sky-300",
    change: { direction: "up", label: "+184 vs. mes pasado" }
  },
  {
    label: "Leads calientes",
    value: "312",
    accent: "text-emerald-600 dark:text-emerald-300",
    change: { direction: "up", label: "+14% conversion" }
  },
  {
    label: "Watchlist",
    value: "28",
    accent: "text-amber-600 dark:text-amber-300",
    change: { direction: "down", label: "-6 casos" }
  },
  {
    label: "Valor vida promedio",
    value: formatCurrency(68_500),
    change: { direction: "up", label: "+RD$4.2K" }
  }
];

const customers: CustomerRecord[] = [
  {
    id: "cus-1",
    fullName: "Camila Reyes",
    code: "C-10823",
    tier: "VIP",
    status: "vip",
    lastVisit: "12 jun · POS",
    branch: "Piantini",
    lifetimeValue: 248_500,
    openBalances: 18_200,
    loyaltyPoints: 12_850,
    preferredChannel: "WhatsApp",
    segments: ["VIP", "Alta joyería"],
    tags: ["Autopay", "InstaPawn"],
    avatar: "CR"
  },
  {
    id: "cus-2",
    fullName: "Edgar Morales",
    code: "C-10202",
    tier: "Preferente",
    status: "standard",
    lastVisit: "10 jun · Layaway",
    branch: "Santo Domingo Oeste",
    lifetimeValue: 98_400,
    openBalances: 12_900,
    loyaltyPoints: 6_120,
    preferredChannel: "SMS",
    segments: ["Electrónica", "Layaway"],
    tags: ["Promesa pago"],
    avatar: "EM"
  },
  {
    id: "cus-3",
    fullName: "Ivonne Cabrera",
    code: "C-10118",
    tier: "VIP",
    status: "vip",
    lastVisit: "09 jun · Loans",
    branch: "Santiago",
    lifetimeValue: 312_900,
    openBalances: 0,
    loyaltyPoints: 18_950,
    preferredChannel: "Email",
    segments: ["Renovaciones", "Joyas"],
    tags: ["Referidos"],
    avatar: "IC"
  },
  {
    id: "cus-4",
    fullName: "Luis Ángel Bautista",
    code: "C-10990",
    tier: "Observación",
    status: "watch",
    lastVisit: "24 may · Layaway",
    branch: "San Cristóbal",
    lifetimeValue: 46_700,
    openBalances: 32_400,
    loyaltyPoints: 1_450,
    preferredChannel: "Llamada",
    segments: ["Riesgo", "Morosidad"],
    tags: ["Recordatorio manual"],
    avatar: "LB"
  }
];

const selectedCustomer: CustomerProfileDetails = {
  customer: {
    ...customers[0],
    phone: "+1 809-555-1842",
    email: "camila.reyes@email.com",
    address: "Av. Winston Churchill #45, Santo Domingo",
    doc: { type: "Cédula", number: "402-4567890-1", expires: "05/2027" },
    since: "2019",
    riskLevel: "low",
    kycStatus: "verified"
  },
  summary: [
    { label: "Préstamos activos", value: "2", hint: "RD$18,200 balance" },
    { label: "Compras retail", value: "26 tickets", hint: "Última hace 4 días" },
    { label: "Layaways", value: "1", hint: "Cumple al día" },
    { label: "Notas recientes", value: "Visita VIP", hint: "Busca upgrade reloj" }
  ],
  activity: [
    {
      id: "act-1",
      timestamp: "12 jun · 10:45 a. m.",
      type: "sale",
      title: "Venta POS R-20480",
      description: "Compró reloj Tag Heuer con upgrade plan protección",
      amount: 58_900,
      status: "Ticket cerrado"
    },
    {
      id: "act-2",
      timestamp: "08 jun · 2:30 p. m.",
      type: "message",
      title: "WhatsApp enviado",
      description: "Confirmación de pago automático de layaway",
      status: "Leído"
    },
    {
      id: "act-3",
      timestamp: "04 jun · 9:10 a. m.",
      type: "loan",
      title: "Renovación préstamo LP-5530",
      description: "Interés RD$2,850 capturado vía tarjeta Azul",
      amount: 2_850,
      status: "Procesado"
    },
    {
      id: "act-4",
      timestamp: "28 may · 4:55 p. m.",
      type: "note",
      title: "Nota de servicio",
      description: "Solicitó evaluación de prenda para InstaPawn",
      status: "Pendiente respuesta"
    }
  ]
};

const messageThreads: MessageThread[] = [
  {
    id: "thread-1",
    customerId: customers[0].id,
    channel: "whatsapp",
    preview: "Perfecto, paso mañana a retirar el anillo pulido.",
    updatedAt: "10:48 a. m.",
    unread: false,
    agent: "Gabriela",
    lastMessageAuthor: "customer"
  },
  {
    id: "thread-2",
    customerId: customers[0].id,
    channel: "sms",
    preview: "Recordatorio de pago RD$5,850 programado",
    updatedAt: "Ayer",
    unread: true,
    agent: "Auto",
    lastMessageAuthor: "system"
  },
  {
    id: "thread-3",
    customerId: customers[0].id,
    channel: "email",
    preview: "Resumen mensual de puntos y promociones exclusivas",
    updatedAt: "08 jun",
    unread: false,
    agent: "Marketing",
    lastMessageAuthor: "agent"
  }
];

const activeConversation: Conversation = {
  thread: messageThreads[0],
  messages: [
    {
      id: "msg-1",
      author: "agent",
      body: "Hola Camila, ya tenemos tu reloj listo con el cambio de correa y pulido premium.",
      timestamp: "10:32 a. m.",
      channel: "whatsapp",
      status: "entregado"
    },
    {
      id: "msg-2",
      author: "customer",
      body: "Perfecto, ¿puedo pasar mañana al mediodía?",
      timestamp: "10:40 a. m.",
      channel: "whatsapp",
      status: "leído"
    },
    {
      id: "msg-3",
      author: "agent",
      body: "Claro, te agendo para las 12:15 p. m. y te enviaré el recordatorio.",
      timestamp: "10:42 a. m.",
      channel: "whatsapp",
      status: "entregado"
    },
    {
      id: "msg-4",
      author: "customer",
      body: "Gracias! ¿Puedes incluir el comprobante del servicio en PDF?",
      timestamp: "10:45 a. m.",
      channel: "whatsapp"
    },
    {
      id: "msg-5",
      author: "agent",
      body: "Adjunto el comprobante y te esperamos mañana. Cualquier cambio nos avisas por aquí.",
      timestamp: "10:48 a. m.",
      channel: "whatsapp",
      attachments: [{ type: "pdf", name: "Comprobante-servicio.pdf" }]
    }
  ]
};

const loyaltyLedger: LoyaltyLedgerEntry[] = [
  {
    id: "led-1",
    date: "12 jun",
    description: "Venta POS R-20480",
    points: 890,
    balance: 12_850,
    source: "sale"
  },
  {
    id: "led-2",
    date: "05 jun",
    description: "Pago automático layaway LA-5480",
    points: 585,
    balance: 11_960,
    source: "layaway"
  },
  {
    id: "led-3",
    date: "28 may",
    description: "Ajuste manual por aniversario VIP",
    points: 500,
    balance: 11_375,
    source: "campaign"
  },
  {
    id: "led-4",
    date: "16 may",
    description: "Reverso pago tardío",
    points: -150,
    balance: 10_875,
    source: "adjustment"
  }
];

const engagementPlays: EngagementPlay[] = [
  {
    id: "play-1",
    title: "Invitar a programa de upgrade de joyería",
    description: "Enviar catálogo exclusivo con nuevas piezas para clientes VIP con historial de compras en oro.",
    impact: "high",
    channel: "email",
    due: "17 jun",
    owner: "Marketing"
  },
  {
    id: "play-2",
    title: "Programar revisión anual de avalúo",
    description: "Ofrecer evaluación gratuita de piezas empeñadas para ajustar tasación y nuevas líneas de crédito.",
    impact: "medium",
    channel: "call",
    due: "20 jun",
    owner: "Gabriela"
  },
  {
    id: "play-3",
    title: "Recordatorio puntos por vencer",
    description: "Enviar SMS con saldo de puntos próximos a expirar y opciones para canjear en tienda.",
    impact: "low",
    channel: "sms",
    due: "28 jun",
    owner: "CRM Bot"
  }
];

export default function CrmPage() {
  return (
    <main className="flex flex-col gap-6">
      <CrmSummary metrics={summaryMetrics} />
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <CrmCard title="Clientes" subtitle="Historial omnicanal" action="Filtrar · Exportar">
          <CustomerList customers={customers} selectedId={selectedCustomer.customer.id} />
        </CrmCard>
        <CrmCard title="Perfil" subtitle="Resumen 360° cliente">
          <CustomerProfile profile={selectedCustomer} />
        </CrmCard>
        <div className="flex flex-col gap-6">
          <CrmCard title="Mensajería" subtitle="WhatsApp · SMS · Email">
            <MessagesCenter threads={messageThreads} conversation={activeConversation} />
          </CrmCard>
          <CrmCard title="Lealtad y engagement" subtitle="Puntos, campañas y seguimiento">
            <LoyaltyLedger ledger={loyaltyLedger} plays={engagementPlays} />
          </CrmCard>
        </div>
      </div>
    </main>
  );
}
