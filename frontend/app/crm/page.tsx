"use client";

import { useMemo, useState } from "react";

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
  Message,
  MessageThread,
} from "@/components/crm/types";
import { formatCurrency } from "@/components/crm/utils";

const SUMMARY_METRICS: CrmSummaryMetric[] = [
  {
    label: "Clientes activos",
    value: "18,420",
    accent: "text-sky-600 dark:text-sky-300",
    change: { direction: "up", label: "+184 vs. mes pasado" },
  },
  {
    label: "Leads calientes",
    value: "312",
    accent: "text-emerald-600 dark:text-emerald-300",
    change: { direction: "up", label: "+14% conversion" },
  },
  {
    label: "Watchlist",
    value: "28",
    accent: "text-amber-600 dark:text-amber-300",
    change: { direction: "down", label: "-6 casos" },
  },
  {
    label: "Valor vida promedio",
    value: formatCurrency(68_500),
    change: { direction: "up", label: "+RD$4.2K" },
  },
];

const CUSTOMERS: CustomerRecord[] = [
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
    avatar: "CR",
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
    avatar: "EM",
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
    avatar: "IC",
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
    avatar: "LB",
  },
];

const PROFILES: Record<string, CustomerProfileDetails> = {
  "cus-1": {
    customer: {
      ...CUSTOMERS[0],
      phone: "+1 809-555-1842",
      email: "camila.reyes@email.com",
      address: "Av. Winston Churchill #45, Santo Domingo",
      doc: { type: "Cédula", number: "402-4567890-1", expires: "05/2027" },
      since: "2019",
      riskLevel: "low",
      kycStatus: "verified",
    },
    summary: [
      { label: "Préstamos activos", value: "2", hint: "RD$18,200 balance" },
      { label: "Compras retail", value: "26 tickets", hint: "Última hace 4 días" },
      { label: "Layaways", value: "1", hint: "Cumple al día" },
      { label: "Notas recientes", value: "Visita VIP", hint: "Busca upgrade reloj" },
    ],
    activity: [
      {
        id: "act-1",
        timestamp: "12 jun · 10:45 a. m.",
        type: "sale",
        title: "Venta POS R-20480",
        description: "Compró reloj Tag Heuer con upgrade plan protección",
        amount: 58_900,
        status: "Ticket cerrado",
      },
      {
        id: "act-2",
        timestamp: "08 jun · 2:30 p. m.",
        type: "message",
        title: "WhatsApp enviado",
        description: "Confirmación de pago automático de layaway",
        status: "Leído",
      },
      {
        id: "act-3",
        timestamp: "04 jun · 9:10 a. m.",
        type: "loan",
        title: "Renovación préstamo LP-5530",
        description: "Interés RD$2,850 capturado vía tarjeta Azul",
        amount: 2_850,
        status: "Procesado",
      },
      {
        id: "act-4",
        timestamp: "28 may · 4:55 p. m.",
        type: "note",
        title: "Nota de servicio",
        description: "Solicitó evaluación de prenda para InstaPawn",
        status: "Pendiente respuesta",
      },
    ],
  },
  "cus-2": {
    customer: {
      ...CUSTOMERS[1],
      phone: "+1 829-555-2040",
      email: "edgar.morales@email.com",
      address: "Av. 27 de Febrero #100",
      doc: { type: "Cédula", number: "001-0099988-4", expires: "08/2025" },
      since: "2021",
      riskLevel: "medium",
      kycStatus: "verified",
    },
    summary: [
      { label: "Layaways activos", value: "2", hint: "RD$12,900 balance" },
      { label: "Visitas mensuales", value: "3", hint: "Foco electrónico" },
      { label: "Notas recientes", value: "Promesa pago", hint: "Confirmar depósito" },
      { label: "Interacciones", value: "5", hint: "SMS + Llamada" },
    ],
    activity: [
      {
        id: "act-5",
        timestamp: "10 jun · 5:12 p. m.",
        type: "layaway",
        title: "Pago layaway LA-3320",
        description: "RD$5,400 recibido vía transferencia",
        amount: 5_400,
        status: "Aplicado",
      },
      {
        id: "act-6",
        timestamp: "03 jun · 11:05 a. m.",
        type: "message",
        title: "SMS recordatorio",
        description: "Se envió enlace de pago restante",
        status: "Entregado",
      },
    ],
  },
  "cus-3": {
    customer: {
      ...CUSTOMERS[2],
      phone: "+1 809-555-0022",
      email: "ivonne.cabrera@email.com",
      address: "Av. Las Carreras, Santiago",
      doc: { type: "Pasaporte", number: "P4033345", expires: "11/2026" },
      since: "2017",
      riskLevel: "low",
      kycStatus: "verified",
    },
    summary: [
      { label: "Renovaciones", value: "4", hint: "RD$42K principal" },
      { label: "Compras retail", value: "18 tickets", hint: "Joyas premium" },
      { label: "Mensajes", value: "2", hint: "Email + WhatsApp" },
      { label: "Notas recientes", value: "Interés en upgrade", hint: "Enviar catálogo" },
    ],
    activity: [
      {
        id: "act-7",
        timestamp: "09 jun · 3:40 p. m.",
        type: "loan",
        title: "Renovación préstamo LP-7781",
        description: "Pagó interés RD$3,950",
        amount: 3_950,
      },
      {
        id: "act-8",
        timestamp: "28 may · 8:30 p. m.",
        type: "message",
        title: "Email promoción",
        description: "Se abrió newsletter relojes suizos",
        status: "Abierto",
      },
    ],
  },
  "cus-4": {
    customer: {
      ...CUSTOMERS[3],
      phone: "+1 829-555-8831",
      email: "",
      address: "Calle Duarte #12, San Cristóbal",
      doc: { type: "Cédula", number: "001-0001187-1", expires: "03/2024" },
      since: "2020",
      riskLevel: "high",
      kycStatus: "pending",
    },
    summary: [
      { label: "Alertas", value: "3", hint: "Pagos en atraso" },
      { label: "Notas", value: "Visita con supervisor", hint: "Programar reunión" },
      { label: "Segmentos", value: "Riesgo", hint: "Llamada manual" },
      { label: "Historial layaway", value: "2", hint: "1 cancelado" },
    ],
    activity: [
      {
        id: "act-9",
        timestamp: "24 may · 6:10 p. m.",
        type: "message",
        title: "Llamada manual",
        description: "Se coordinó pago atrasado RD$8,200",
        status: "Pendiente confirmación",
      },
      {
        id: "act-10",
        timestamp: "16 may · 4:25 p. m.",
        type: "note",
        title: "Nota de riesgo",
        description: "Agregar verificación adicional en próximos préstamos",
      },
    ],
  },
};

const THREADS: MessageThread[] = [
  {
    id: "thread-1",
    customerId: "cus-1",
    channel: "whatsapp",
    preview: "Perfecto, paso mañana a retirar el anillo pulido.",
    updatedAt: "10:48 a. m.",
    unread: false,
    agent: "Gabriela",
    lastMessageAuthor: "customer",
  },
  {
    id: "thread-2",
    customerId: "cus-1",
    channel: "sms",
    preview: "Recordatorio de pago RD$5,850 programado",
    updatedAt: "Ayer",
    unread: true,
    agent: "Auto",
    lastMessageAuthor: "system",
  },
  {
    id: "thread-3",
    customerId: "cus-2",
    channel: "sms",
    preview: "Confirmo el pago pendiente mañana en la tarde.",
    updatedAt: "09:05 a. m.",
    unread: false,
    agent: "Erika",
    lastMessageAuthor: "customer",
  },
  {
    id: "thread-4",
    customerId: "cus-3",
    channel: "email",
    preview: "Gracias por el catálogo, revisaré con calma las opciones.",
    updatedAt: "08 jun",
    unread: false,
    agent: "Marketing",
    lastMessageAuthor: "customer",
  },
  {
    id: "thread-5",
    customerId: "cus-4",
    channel: "sms",
    preview: "Se dejó voicemail solicitando confirmar plan de pago.",
    updatedAt: "Ayer",
    unread: false,
    agent: "Riesgos",
    lastMessageAuthor: "agent",
  },
];

const CONVERSATION_MESSAGES: Record<string, Message[]> = {
  "thread-1": [
    {
      id: "msg-1",
      author: "agent",
      body: "Hola Camila, ya tenemos tu reloj listo con el cambio de correa y pulido premium.",
      timestamp: "10:32 a. m.",
      channel: "whatsapp",
      status: "delivered",
    },
    {
      id: "msg-2",
      author: "customer",
      body: "Perfecto, ¿puedo pasar mañana al mediodía?",
      timestamp: "10:40 a. m.",
      channel: "whatsapp",
      status: "read",
    },
    {
      id: "msg-3",
      author: "agent",
      body: "Claro, te agendo para las 12:15 p. m. y te enviaré el recordatorio.",
      timestamp: "10:42 a. m.",
      channel: "whatsapp",
      status: "delivered",
    },
    {
      id: "msg-4",
      author: "customer",
      body: "Gracias! ¿Puedes incluir el comprobante del servicio en PDF?",
      timestamp: "10:45 a. m.",
      channel: "whatsapp",
    },
    {
      id: "msg-5",
      author: "agent",
      body: "Adjunto el comprobante y te esperamos mañana. Cualquier cambio nos avisas por aquí.",
      timestamp: "10:48 a. m.",
      channel: "whatsapp",
      attachments: [{ type: "pdf", name: "Comprobante-servicio.pdf" }],
    },
  ],
  "thread-2": [
    {
      id: "msg-6",
      author: "system",
      body: "Recuerda tu pago RD$5,850 vence mañana. Puedes pagar en línea aquí: https://pagos.example",
      timestamp: "Ayer 6:30 p. m.",
      channel: "sms",
      status: "delivered",
    },
  ],
  "thread-3": [
    {
      id: "msg-7",
      author: "customer",
      body: "Confirmo el pago pendiente mañana en la tarde.",
      timestamp: "09:05 a. m.",
      channel: "sms",
    },
  ],
  "thread-4": [
    {
      id: "msg-8",
      author: "customer",
      body: "Gracias por el catálogo, revisaré con calma las opciones.",
      timestamp: "08 jun",
      channel: "email",
    },
  ],
  "thread-5": [
    {
      id: "msg-9",
      author: "agent",
      body: "Se dejó voicemail solicitando confirmar plan de pago.",
      timestamp: "Ayer",
      channel: "sms",
    },
  ],
};

const INITIAL_LEDGER: LoyaltyLedgerEntry[] = [
  { id: "led-1", date: "12 jun", description: "Venta POS R-20480", points: 890, balance: 12_850, source: "sale" },
  { id: "led-2", date: "05 jun", description: "Pago automático layaway LA-5480", points: 585, balance: 11_960, source: "layaway" },
  { id: "led-3", date: "28 may", description: "Ajuste manual por aniversario VIP", points: 500, balance: 11_375, source: "campaign" },
  { id: "led-4", date: "16 may", description: "Reverso pago tardío", points: -150, balance: 10_875, source: "adjustment" },
];

const INITIAL_PLAYS: EngagementPlay[] = [
  {
    id: "play-1",
    title: "Invitar a programa de upgrade de joyería",
    description: "Enviar catálogo exclusivo con nuevas piezas para clientes VIP con historial de compras en oro.",
    impact: "high",
    channel: "email",
    due: "17 jun",
    owner: "Marketing",
  },
  {
    id: "play-2",
    title: "Programar revisión anual de avalúo",
    description: "Ofrecer evaluación gratuita de piezas empeñadas para ajustar tasación y nuevas líneas de crédito.",
    impact: "medium",
    channel: "call",
    due: "20 jun",
    owner: "Gabriela",
  },
  {
    id: "play-3",
    title: "Recordatorio puntos por vencer",
    description: "Enviar SMS con saldo de puntos próximos a expirar y opciones para canjear en tienda.",
    impact: "low",
    channel: "sms",
    due: "28 jun",
    owner: "CRM Bot",
  },
];

export default function CrmPage() {
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(CUSTOMERS[0].id);
  const [threads, setThreads] = useState<MessageThread[]>(THREADS);
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>(CONVERSATION_MESSAGES);
  const [activeThreadId, setActiveThreadId] = useState(THREADS[0].id);
  const [draft, setDraft] = useState("");
  const [ledgerEntries, setLedgerEntries] = useState<LoyaltyLedgerEntry[]>(INITIAL_LEDGER);
  const [plays, setPlays] = useState<EngagementPlay[]>(INITIAL_PLAYS);
  const [activityLog, setActivityLog] = useState<string[]>([]);

  const logAction = (message: string) => {
    setActivityLog((entries) => [message, ...entries].slice(0, 6));
  };

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return CUSTOMERS;
    return CUSTOMERS.filter((customer) =>
      customer.fullName.toLowerCase().includes(query) ||
      customer.code.toLowerCase().includes(query) ||
      customer.segments.some((segment) => segment.toLowerCase().includes(query)),
    );
  }, [customerSearch]);

  const customerThreads = useMemo(
    () => threads.filter((thread) => thread.customerId === selectedCustomerId),
    [threads, selectedCustomerId],
  );

  const conversation = useMemo(() => {
    const fallbackThread =
      threads.find((thread) => thread.id === activeThreadId) ||
      threads.find((thread) => thread.customerId === selectedCustomerId);
    if (!fallbackThread) {
      return {
        thread: {
          id: `thread-${selectedCustomerId}`,
          customerId: selectedCustomerId,
          channel: "sms",
          preview: "Sin historial previo",
          updatedAt: "Ahora",
          unread: false,
          agent: "CRM",
          lastMessageAuthor: "agent",
        },
        messages: [],
      } satisfies Conversation;
    }
    return {
      thread: fallbackThread,
      messages: messagesMap[fallbackThread.id] ?? [],
    } satisfies Conversation;
  }, [activeThreadId, messagesMap, selectedCustomerId, threads]);

  const selectedProfile = PROFILES[selectedCustomerId] ?? {
    customer: {
      ...CUSTOMERS.find((customer) => customer.id === selectedCustomerId)!,
      phone: "Sin teléfono",
      email: "",
      address: "No registrado",
      doc: { type: "Cédula", number: "", expires: "" },
      since: "2022",
      riskLevel: "medium",
      kycStatus: "pending",
    },
    summary: [],
    activity: [],
  };

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCustomerSearch("");
    const existingThread = threads.find((thread) => thread.customerId === customerId);
    if (existingThread) {
      setActiveThreadId(existingThread.id);
      setThreads((current) =>
        current.map((thread) =>
          thread.id === existingThread.id ? { ...thread, unread: false } : thread,
        ),
      );
    } else {
      const preferred = PROFILES[customerId]?.customer.preferredChannel.toLowerCase();
      const channel: MessageThread["channel"] =
        preferred === "whatsapp" || preferred === "email" ? (preferred as MessageThread["channel"]) : "sms";
      const newThread: MessageThread = {
        id: `thread-${customerId}`,
        customerId,
        channel,
        preview: "Sin historial previo",
        updatedAt: "Ahora",
        unread: false,
        agent: "CRM",
        lastMessageAuthor: "agent",
      };
      setThreads((current) => [newThread, ...current]);
      setMessagesMap((current) => ({ ...current, [newThread.id]: [] }));
      setActiveThreadId(newThread.id);
    }
    setDraft("");
    logAction(`Cliente ${selectedProfile.customer.fullName} seleccionado`);
  };

  const handleSelectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setDraft("");
    setThreads((current) =>
      current.map((thread) => (thread.id === threadId ? { ...thread, unread: false } : thread)),
    );
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
  };

  const handleSendMessage = (message: string) => {
    const thread = threads.find((entry) => entry.id === conversation.thread.id);
    if (!thread) return;
    const now = new Date();
    const timestamp = now.toLocaleTimeString("es-DO", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const newMessage: Message = {
      id: `msg-${now.getTime()}`,
      author: "agent",
      body: message,
      timestamp,
      channel: thread.channel,
      status: "sent",
    };
    setMessagesMap((current) => ({
      ...current,
      [thread.id]: [...(current[thread.id] ?? []), newMessage],
    }));
    setThreads((current) =>
      current.map((entry) =>
        entry.id === thread.id
          ? {
              ...entry,
              preview: message,
              updatedAt: "Ahora",
              unread: false,
              lastMessageAuthor: "agent",
            }
          : entry,
      ),
    );
    setDraft("");
    logAction(
      `Mensaje enviado a ${selectedProfile.customer.fullName} vía ${thread.channel.toUpperCase()}`,
    );
  };

  const handleRedeemPoints = (entryId: string) => {
    const currentBalance = ledgerEntries[0]?.balance ?? selectedProfile.customer.loyaltyPoints;
    const newBalance = Math.max(0, currentBalance - 500);
    const redemption: LoyaltyLedgerEntry = {
      id: `led-${Date.now()}`,
      date: new Date().toLocaleDateString("es-DO", { day: "2-digit", month: "short" }),
      description: `Redención aplicada (ref ${entryId})`,
      points: -500,
      balance: newBalance,
      source: "adjustment",
    };
    setLedgerEntries((entries) => [redemption, ...entries]);
    logAction(`Redimidos 500 pts para ${selectedProfile.customer.fullName}`);
  };

  const handleSchedulePlay = (playId: string) => {
    setPlays((current) =>
      current.map((play) =>
        play.id === playId
          ? { ...play, due: "Programado hoy", owner: "CRM" }
          : play,
      ),
    );
    logAction(`Play ${playId} asignado a seguimiento CRM`);
  };

  const customerToolbar = (
    <div className="rounded-full border border-slate-200/70 bg-white px-3 py-1 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/30">
      <input
        value={customerSearch}
        onChange={(event) => setCustomerSearch(event.target.value)}
        placeholder="Buscar cliente o segmento"
        className="w-44 bg-transparent text-xs text-slate-600 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setCustomerSearch("");
          }
        }}
      />
    </div>
  );

  return (
    <main className="flex flex-col gap-6">
      <CrmSummary metrics={SUMMARY_METRICS} />
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <CrmCard title="Clientes" subtitle="Historial omnicanal" action="Filtrar · Exportar">
          <CustomerList
            customers={filteredCustomers}
            selectedId={selectedCustomerId}
            onSelect={handleSelectCustomer}
            toolbar={customerToolbar}
          />
        </CrmCard>
        <CrmCard title="Perfil" subtitle="Resumen 360° cliente">
          <CustomerProfile profile={selectedProfile} />
        </CrmCard>
        <div className="flex flex-col gap-6">
          <CrmCard title="Mensajería" subtitle="WhatsApp · SMS · Email">
            <MessagesCenter
              threads={customerThreads.length ? customerThreads : threads}
              conversation={conversation}
              draft={draft}
              onSelectThread={handleSelectThread}
              onDraftChange={handleDraftChange}
              onSend={handleSendMessage}
            />
          </CrmCard>
          <CrmCard title="Lealtad y engagement" subtitle="Puntos, campañas y seguimiento">
            <LoyaltyLedger
              ledger={ledgerEntries}
              plays={plays}
              onRedeem={handleRedeemPoints}
              onSchedulePlay={handleSchedulePlay}
            />
          </CrmCard>
          {activityLog.length ? (
            <CrmCard title="Gestiones recientes" subtitle="Actividades manuales registradas">
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                {activityLog.map((entry, index) => (
                  <li key={`${entry}-${index}`} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400 dark:bg-sky-300" />
                    <span>{entry}</span>
                  </li>
                ))}
              </ul>
            </CrmCard>
          ) : null}
        </div>
      </div>
    </main>
  );
}
