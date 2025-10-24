"use client";

import { useMemo, useState } from "react";

import { LayawaySummary } from "@/components/layaways/layaway-summary";
import { LayawayQueue } from "@/components/layaways/layaway-queue";
import { PaymentForecast } from "@/components/layaways/payment-forecast";
import { EngagementCenter } from "@/components/layaways/engagement-center";
import type {
  EngagementReminder,
  LayawayPlan,
  LayawaySummaryMetric,
  PaymentScheduleItem,
  UpsellInsight,
} from "@/components/layaways/types";
import { formatContactTimestamp, formatCurrency, formatPercent } from "@/components/layaways/utils";

const summaryBaselines = {
  activePlans: 326,
  committedInventory: 14_280_000,
  overdueInstallments: 182_450,
  completedThisMonth: 28,
};

const INITIAL_ACTIVE_PLANS: LayawayPlan[] = [
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
    risk: "low",
    lastContactAt: "2024-06-17T09:45:00-04:00",
    lastContactChannel: "WhatsApp",
    contactNotes: "Confirmó cobro automático",
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
    promiseToPay: "21 jun",
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
    risk: "low",
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
    risk: "medium",
  },
];

const INITIAL_OVERDUE_PLANS: LayawayPlan[] = [
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
    promiseToPay: "Hoy 6:00 p. m.",
    lastContactAt: "2024-06-17T16:15:00-04:00",
    lastContactChannel: "WhatsApp",
    contactNotes: "Promesa confirmada",
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
    risk: "high",
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
    promiseToPay: "20 jun",
  },
];

const INITIAL_SCHEDULE: PaymentScheduleItem[] = [
  {
    id: "sched-1",
    dueDate: "19 jun",
    customer: "José Montero",
    planNumber: "LA-5478",
    amount: 3_450,
    channel: "auto",
    status: "processing",
    notes: "Tarjeta AZUL terminación 4021",
  },
  {
    id: "sched-2",
    dueDate: "20 jun",
    customer: "Camila Reyes",
    planNumber: "LA-5480",
    amount: 5_850,
    channel: "auto",
    status: "scheduled",
    notes: "Se notificó recordatorio 24 h",
  },
  {
    id: "sched-3",
    dueDate: "21 jun",
    customer: "Edgar Morales",
    planNumber: "LA-5476",
    amount: 4_950,
    channel: "cash",
    status: "scheduled",
    notes: "Prometió pasar por sucursal Oeste",
  },
  {
    id: "sched-4",
    dueDate: "22 jun",
    customer: "Génesis Tejada",
    planNumber: "LA-5462",
    amount: 2_750,
    channel: "transfer",
    status: "completed",
    notes: "Transferencia Banco Popular confirmada",
  },
];

const INITIAL_REMINDERS: EngagementReminder[] = [
  {
    id: "rem-1",
    planNumber: "LA-5298",
    customer: "Luis Ángel Bautista",
    message:
      "Tu cuota RD$5,900 está vencida. Responde este WhatsApp para coordinar pago y evitar cancelación.",
    channel: "WhatsApp",
    scheduledFor: "Hoy · 2:00 p. m.",
    status: "scheduled",
  },
  {
    id: "rem-2",
    planNumber: "LA-5476",
    customer: "Edgar Morales",
    message:
      "Recordatorio de cuota RD$4,950. Tenemos pick-up express disponible mañana hasta las 8 p. m.",
    channel: "SMS",
    scheduledFor: "Hoy · 5:30 p. m.",
    status: "queued",
  },
  {
    id: "rem-3",
    planNumber: "LA-5480",
    customer: "Camila Reyes",
    message:
      "Confirmamos AutoCobro mañana. Puedes ver tu recibo digital desde el portal de clientes.",
    channel: "Email",
    scheduledFor: "19 jun · 8:00 a. m.",
    status: "sent",
  },
];

const INITIAL_INSIGHTS: UpsellInsight[] = [
  {
    id: "ins-1",
    title: "Activa autopago para los planes con mora recurrente",
    description:
      "9 clientes en mora 2+ veces aún pagan en efectivo. Incentiva AutoCobro con 5% de descuento en cuota final.",
    impact: "high",
  },
  {
    id: "ins-2",
    title: "Ofrece cross-sell a clientes con plan completado",
    description:
      "28 planes cerrados este mes: envía cupón de 10% en ventas al contado o upgrade de garantía extendida.",
    impact: "medium",
  },
  {
    id: "ins-3",
    title: "Optimiza inventario reservado",
    description:
      "RD$1.2M en joyería comprometida >45 días. Coordina reposición en vitrinas secundarias para evitar rotación lenta.",
    impact: "medium",
  },
];

type LayawayFilters = {
  search: string;
  branch: string;
  autopay: "all" | "auto" | "manual";
  risk: "all" | "low" | "medium" | "high";
};

function filterPlans(plans: LayawayPlan[], filters: LayawayFilters) {
  return plans.filter((plan) => {
    const matchesSearch = filters.search
      ? [plan.planNumber, plan.customer, plan.item]
          .join(" ")
          .toLowerCase()
          .includes(filters.search.toLowerCase())
      : true;
    const matchesBranch = filters.branch === "all" || plan.branch === filters.branch;
    const matchesAutopay =
      filters.autopay === "all" || (filters.autopay === "auto" ? plan.autopay : !plan.autopay);
    const matchesRisk = filters.risk === "all" || plan.risk === filters.risk;

    return matchesSearch && matchesBranch && matchesAutopay && matchesRisk;
  });
}

function createReminderFromPlan(plan: LayawayPlan, message: string): EngagementReminder {
  return {
    id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    planNumber: plan.planNumber,
    customer: plan.customer,
    message,
    channel: plan.contactPreference === "Email" ? "Email" : plan.contactPreference === "Call" ? "SMS" : plan.contactPreference,
    scheduledFor: new Date().toLocaleString("es-DO", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    status: "queued",
  };
}

function createReminderFromInsight(insight: UpsellInsight): EngagementReminder {
  return {
    id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    planNumber: "Campaña",
    customer: insight.title,
    message: insight.description,
    channel: "Email",
    scheduledFor: new Date().toLocaleDateString("es-DO", {
      day: "2-digit",
      month: "short",
    }),
    status: "scheduled",
  };
}

export default function LayawaysPage() {
  const [activePlans, setActivePlans] = useState(INITIAL_ACTIVE_PLANS);
  const [overduePlans, setOverduePlans] = useState(INITIAL_OVERDUE_PLANS);
  const [selectedActive, setSelectedActive] = useState<string[]>([]);
  const [selectedOverdue, setSelectedOverdue] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<LayawayFilters>({
    search: "",
    branch: "all",
    autopay: "all",
    risk: "all",
  });
  const [overdueFilters, setOverdueFilters] = useState<LayawayFilters>({
    search: "",
    branch: "all",
    autopay: "all",
    risk: "all",
  });
  const [schedule, setSchedule] = useState(INITIAL_SCHEDULE);
  const [reminders, setReminders] = useState(INITIAL_REMINDERS);
  const [insights, setInsights] = useState(INITIAL_INSIGHTS);

  const branches = useMemo(() => {
    const unique = new Set([...activePlans, ...overduePlans].map((plan) => plan.branch));
    return ["all", ...Array.from(unique).sort()];
  }, [activePlans, overduePlans]);

  const filteredActive = useMemo(
    () => filterPlans(activePlans, activeFilters),
    [activePlans, activeFilters],
  );
  const filteredOverdue = useMemo(
    () => filterPlans(overduePlans, overdueFilters),
    [overduePlans, overdueFilters],
  );

  const committedInventory = activePlans.reduce((sum, plan) => sum + plan.balance + plan.deposit, 0);
  const overdueBalance = overduePlans.reduce((sum, plan) => sum + plan.nextPaymentAmount, 0);

  const summaryMetrics: LayawaySummaryMetric[] = [
    {
      label: "Activos",
      value: `${summaryBaselines.activePlans + activePlans.length - INITIAL_ACTIVE_PLANS.length} planes`,
      accent: "text-emerald-600 dark:text-emerald-300",
      change: { direction: "up", label: "+12 vs. semana pasada" },
    },
    {
      label: "Inventario comprometido",
      value: formatCurrency(summaryBaselines.committedInventory + committedInventory -
        INITIAL_ACTIVE_PLANS.reduce((sum, plan) => sum + plan.balance + plan.deposit, 0)),
      change: { direction: "up", label: "+RD$420K" },
    },
    {
      label: "Cuotas vencidas",
      value: formatCurrency(summaryBaselines.overdueInstallments + overdueBalance -
        INITIAL_OVERDUE_PLANS.reduce((sum, plan) => sum + plan.nextPaymentAmount, 0)),
      accent: "text-amber-600 dark:text-amber-300",
      change: { direction: "down", label: "-6% mora" },
    },
    {
      label: "Planes completados",
      value: `${summaryBaselines.completedThisMonth} este mes`,
      accent: "text-sky-600 dark:text-sky-300",
      change: { direction: "up", label: "+18% vs. mayo" },
    },
  ];

  const autopayPenetration = useMemo(() => {
    if (!schedule.length) return 0;
    const auto = schedule.filter((item) => item.channel === "auto").length;
    return auto / schedule.length;
  }, [schedule]);

  const handleToggleSelection = (queue: "active" | "overdue", id: string) => {
    if (queue === "active") {
      setSelectedActive((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      );
    } else {
      setSelectedOverdue((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      );
    }
  };

  const updatePlan = (
    queue: "active" | "overdue",
    id: string,
    updater: (plan: LayawayPlan) => LayawayPlan,
  ) => {
    if (queue === "active") {
      setActivePlans((plans) => plans.map((plan) => (plan.id === id ? updater(plan) : plan)));
    } else {
      setOverduePlans((plans) => plans.map((plan) => (plan.id === id ? updater(plan) : plan)));
    }
  };

  const handleToggleAutopay = (queue: "active" | "overdue", plan: LayawayPlan) => {
    const timestamp = new Date().toISOString();
    updatePlan(queue, plan.id, (current) => ({
      ...current,
      autopay: !current.autopay,
      contactNotes: `${!current.autopay ? "AutoCobro activado" : "AutoCobro desactivado"} · ${formatContactTimestamp(
        timestamp,
      )}`,
      lastContactAt: timestamp,
      lastContactChannel: plan.contactPreference,
    }));
  };

  const handleLogContact = (queue: "active" | "overdue", plan: LayawayPlan, notes?: string) => {
    const timestamp = new Date().toISOString();
    updatePlan(queue, plan.id, (current) => ({
      ...current,
      lastContactAt: timestamp,
      lastContactChannel: plan.contactPreference,
      contactNotes: notes?.trim() || `Gestión registrada ${formatContactTimestamp(timestamp)}`,
    }));
  };

  const handleBulkReminder = (queue: "active" | "overdue") => {
    const selected = queue === "active" ? selectedActive : selectedOverdue;
    if (!selected.length) return;

    const plans = queue === "active" ? activePlans : overduePlans;
    const remindersToAdd: EngagementReminder[] = [];
    selected.forEach((id) => {
      const plan = plans.find((item) => item.id === id);
      if (!plan) return;
      const message = `Cuota ${formatCurrency(plan.nextPaymentAmount)} para ${plan.planNumber}.`;
      remindersToAdd.push(createReminderFromPlan(plan, message));
      handleLogContact(queue, plan, `Recordatorio enviado ${plan.contactPreference}`);
    });

    setReminders((current) => [...remindersToAdd, ...current]);
    if (queue === "active") {
      setSelectedActive([]);
    } else {
      setSelectedOverdue([]);
    }
  };

  const handleReminderStatus = (id: string, status: EngagementReminder["status"]) => {
    setReminders((current) =>
      current.map((reminder) => (reminder.id === id ? { ...reminder, status } : reminder)),
    );
  };

  const handleCancelReminder = (id: string) => {
    setReminders((current) => current.filter((reminder) => reminder.id !== id));
  };

  const handleApplyInsight = (insight: UpsellInsight) => {
    setReminders((current) => [createReminderFromInsight(insight), ...current]);
    setInsights((current) => current.filter((item) => item.id !== insight.id));
  };

  const handleScheduleStatus = (
    id: string,
    status: PaymentScheduleItem["status"],
  ) => {
    setSchedule((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              notes:
                status === "completed"
                  ? `Cobrado ${new Date().toLocaleTimeString("es-DO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : item.notes,
            }
          : item,
      ),
    );
  };

  const handleConvertToAuto = (id: string) => {
    const scheduleItem = schedule.find((item) => item.id === id);

    setSchedule((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              channel: "auto",
              notes: "Migrado a AutoCobro",
            }
          : item,
      ),
    );

    if (scheduleItem) {
      setActivePlans((plans) =>
        plans.map((plan) =>
          plan.planNumber === scheduleItem.planNumber ? { ...plan, autopay: true } : plan,
        ),
      );

      setOverduePlans((plans) =>
        plans.map((plan) =>
          plan.planNumber === scheduleItem.planNumber ? { ...plan, autopay: true } : plan,
        ),
      );
    }
  };

  const handleQueueScheduleReminder = (id: string) => {
    const scheduleItem = schedule.find((item) => item.id === id);
    if (!scheduleItem) return;

    if (!scheduleItem.reminderQueued) {
      setSchedule((current) =>
        current.map((item) => (item.id === id ? { ...item, reminderQueued: true } : item)),
      );

      setReminders((current) => [
        {
          id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          planNumber: scheduleItem.planNumber,
          customer: scheduleItem.customer,
          message: `Recordatorio automático para cuota ${formatCurrency(scheduleItem.amount)} (${scheduleItem.channel}).`,
          channel: scheduleItem.channel === "auto" ? "SMS" : "WhatsApp",
          scheduledFor: new Date().toLocaleTimeString("es-DO", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          status: "queued",
        },
        ...current,
      ]);
    }
  };

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
          plans={filteredActive}
          actionLabel="Enviar recordatorio"
          actionDisabled={!selectedActive.length}
          onAction={() => handleBulkReminder("active")}
          selectedIds={selectedActive}
          onToggleSelect={(id) => handleToggleSelection("active", id)}
          onToggleAutopay={(plan) => handleToggleAutopay("active", plan)}
          onLogContact={(plan) => handleLogContact("active", plan)}
          toolbar={
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                value={activeFilters.search}
                onChange={(event) => setActiveFilters((filters) => ({ ...filters, search: event.target.value }))}
                placeholder="Buscar plan, cliente o artículo"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <div className="flex flex-wrap gap-2">
                <select
                  value={activeFilters.branch}
                  onChange={(event) => setActiveFilters((filters) => ({ ...filters, branch: event.target.value }))}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch === "all" ? "Todas las sucursales" : branch}
                    </option>
                  ))}
                </select>
                <select
                  value={activeFilters.autopay}
                  onChange={(event) =>
                    setActiveFilters((filters) => ({
                      ...filters,
                      autopay: event.target.value as LayawayFilters["autopay"],
                    }))
                  }
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="all">Todos los métodos</option>
                  <option value="auto">AutoCobro</option>
                  <option value="manual">Manual</option>
                </select>
                <select
                  value={activeFilters.risk}
                  onChange={(event) =>
                    setActiveFilters((filters) => ({
                      ...filters,
                      risk: event.target.value as LayawayFilters["risk"],
                    }))
                  }
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="all">Todos los riesgos</option>
                  <option value="low">Bajo riesgo</option>
                  <option value="medium">Riesgo medio</option>
                  <option value="high">Riesgo alto</option>
                </select>
              </div>
            </div>
          }
          footer={
            selectedActive.length ? (
              <p className="px-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {selectedActive.length} planes listos para enviar recordatorio.
              </p>
            ) : null
          }
        />
        <PaymentForecast
          items={schedule}
          autopayPenetration={autopayPenetration}
          onUpdateStatus={handleScheduleStatus}
          onConvertToAuto={handleConvertToAuto}
          onQueueReminder={handleQueueScheduleReminder}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1.6fr]">
        <LayawayQueue
          title="En mora y riesgo de cancelación"
          subtitle="Contacta a los clientes con más de 5 días de atraso"
          plans={filteredOverdue}
          actionLabel="Recordatorio de cobranza"
          actionDisabled={!selectedOverdue.length}
          onAction={() => handleBulkReminder("overdue")}
          selectedIds={selectedOverdue}
          onToggleSelect={(id) => handleToggleSelection("overdue", id)}
          onToggleAutopay={(plan) => handleToggleAutopay("overdue", plan)}
          onLogContact={(plan) => handleLogContact("overdue", plan)}
          toolbar={
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                value={overdueFilters.search}
                onChange={(event) =>
                  setOverdueFilters((filters) => ({ ...filters, search: event.target.value }))
                }
                placeholder="Buscar plan, cliente o artículo"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              <div className="flex flex-wrap gap-2">
                <select
                  value={overdueFilters.branch}
                  onChange={(event) =>
                    setOverdueFilters((filters) => ({ ...filters, branch: event.target.value }))
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
                  value={overdueFilters.autopay}
                  onChange={(event) =>
                    setOverdueFilters((filters) => ({
                      ...filters,
                      autopay: event.target.value as LayawayFilters["autopay"],
                    }))
                  }
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="all">Todos los métodos</option>
                  <option value="auto">AutoCobro</option>
                  <option value="manual">Manual</option>
                </select>
                <select
                  value={overdueFilters.risk}
                  onChange={(event) =>
                    setOverdueFilters((filters) => ({
                      ...filters,
                      risk: event.target.value as LayawayFilters["risk"],
                    }))
                  }
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <option value="all">Todos los riesgos</option>
                  <option value="low">Bajo riesgo</option>
                  <option value="medium">Riesgo medio</option>
                  <option value="high">Riesgo alto</option>
                </select>
              </div>
            </div>
          }
          footer={
            selectedOverdue.length ? (
              <p className="px-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {selectedOverdue.length} planes en mora con gestión priorizada.
              </p>
            ) : null
          }
        />
        <EngagementCenter
          reminders={reminders}
          insights={insights}
          onUpdateReminderStatus={handleReminderStatus}
          onCancelReminder={handleCancelReminder}
          onApplyInsight={handleApplyInsight}
        />
      </div>

      <div className="flex items-center justify-end gap-4 rounded-2xl border border-slate-200/70 bg-white/70 px-6 py-4 text-xs text-slate-500 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-400">
        <span className="font-medium text-slate-600 dark:text-slate-200">
          AutoCobro
          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            {formatPercent(autopayPenetration)}
          </span>
        </span>
        <span>
          Recordatorios activos: <strong className="text-slate-700 dark:text-slate-200">{reminders.length}</strong>
        </span>
      </div>
    </div>
  );
}
