"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type DashboardSummary = {
  activeCount: number;
  overdueCount: number;
  completedToday: number;
  paymentsTodayCents: number;
  paymentsTodayCount: number;
  outstandingCents: number;
  overdueOutstandingCents: number;
  autopayCount: number;
  autopayRatio: number;
};

type DashboardPlan = {
  id: number;
  orderId: number;
  planNumber: string;
  branchId: number;
  branchName: string;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  dueDate: string | null;
  status: "active" | "overdue" | "completed";
  autopay: boolean;
  risk: "low" | "medium" | "high";
  nextPaymentCents: number;
  contactPreference: "WhatsApp" | "Email" | "Call";
  lastContactAt: string | null;
  lastContactChannel: string | null;
  contactNotes: string | null;
  lastPayment: {
    amountCents: number;
    method: string;
    note: string | null;
    createdAt: string | null;
  } | null;
  itemSummary: string;
};

type DashboardScheduleEntry = {
  id: string;
  layawayId: number;
  planNumber: string;
  customerName: string;
  dueDate: string | null;
  amountCents: number;
  channel: "cash" | "card" | "transfer" | "auto";
  status: "scheduled" | "processing" | "completed" | "overdue";
  notes: string | null;
};

type DashboardReminder = {
  id: string;
  planNumber: string;
  customerName: string;
  message: string;
  channel: "SMS" | "WhatsApp" | "Email";
  status: "scheduled" | "sent" | "queued";
  scheduledFor: string | null;
};

type DashboardInsight = {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
};

type DashboardResponse = {
  generatedAt: string;
  summary: DashboardSummary;
  activePlans: DashboardPlan[];
  overduePlans: DashboardPlan[];
  schedule: DashboardScheduleEntry[];
  reminders: DashboardReminder[];
  insights: DashboardInsight[];
};

function centsToAmount(value: number | null | undefined) {
  return Math.max(0, Number(value ?? 0)) / 100;
}

function formatPlanDateLabel(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const datePart = date.toLocaleDateString("es-DO", { day: "2-digit", month: "short" });
  const timePart = date.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

function formatShortDateLabel(value: string | null) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("es-DO", { day: "2-digit", month: "short" });
}

function formatReminderTimestamp(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const now = new Date();
  const sameDay = now.toDateString() === date.toDateString();
  const timePart = date.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) {
    return `Hoy · ${timePart}`;
  }
  const datePart = date.toLocaleDateString("es-DO", { day: "2-digit", month: "short" });
  return `${datePart} · ${timePart}`;
}

function toLayawayPlan(plan: DashboardPlan): LayawayPlan {
  return {
    id: `lay-${plan.id}`,
    planNumber: plan.planNumber,
    customer: plan.customerName,
    item: plan.itemSummary,
    branch: plan.branchName,
    total: centsToAmount(plan.totalCents),
    balance: centsToAmount(plan.balanceCents),
    deposit: centsToAmount(plan.paidCents),
    nextPaymentDate: formatPlanDateLabel(plan.dueDate),
    nextPaymentAmount: centsToAmount(plan.nextPaymentCents),
    status: plan.status === "completed" ? "completed" : plan.status,
    autopay: plan.autopay,
    lastPayment: plan.lastPayment?.createdAt ? formatShortDateLabel(plan.lastPayment.createdAt) : "—",
    contactPreference:
      plan.contactPreference === "WhatsApp"
        ? "WhatsApp"
        : plan.contactPreference === "Email"
        ? "Email"
        : "Call",
    risk: plan.risk,
    promiseToPay: undefined,
    lastContactAt: plan.lastContactAt ?? undefined,
    lastContactChannel: plan.lastContactChannel ?? undefined,
    contactNotes: plan.contactNotes ?? undefined,
  };
}

function toScheduleItem(entry: DashboardScheduleEntry): PaymentScheduleItem {
  const formattedDate = entry.dueDate ? new Date(entry.dueDate) : null;
  const dateLabel = formattedDate && !Number.isNaN(formattedDate.getTime())
    ? formattedDate.toLocaleDateString("es-DO", { day: "2-digit", month: "short" })
    : entry.dueDate ?? "Sin fecha";

  return {
    id: entry.id,
    dueDate: dateLabel,
    customer: entry.customerName,
    planNumber: entry.planNumber,
    amount: centsToAmount(entry.amountCents),
    channel: entry.channel,
    status: entry.status,
    notes: entry.notes ?? undefined,
  };
}

function toReminder(entry: DashboardReminder): EngagementReminder {
  return {
    id: entry.id,
    planNumber: entry.planNumber,
    customer: entry.customerName,
    message: entry.message,
    channel: entry.channel,
    scheduledFor: formatReminderTimestamp(entry.scheduledFor),
    status: entry.status,
  };
}

function toUpsellInsight(entry: DashboardInsight): UpsellInsight {
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    impact: entry.impact,
  };
}

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
  const [activePlans, setActivePlans] = useState<LayawayPlan[]>([]);
  const [overduePlans, setOverduePlans] = useState<LayawayPlan[]>([]);
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
  const [schedule, setSchedule] = useState<PaymentScheduleItem[]>([]);
  const [reminders, setReminders] = useState<EngagementReminder[]>([]);
  const [insights, setInsights] = useState<UpsellInsight[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/layaways/dashboard`, {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<DashboardResponse> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo cargar el resumen de layaway");
      }

      const active = (payload.activePlans ?? []).map(toLayawayPlan);
      const overdue = (payload.overduePlans ?? []).map(toLayawayPlan);
      const scheduleItems = (payload.schedule ?? []).map(toScheduleItem);
      const reminderItems = (payload.reminders ?? []).map(toReminder);
      const insightItems = (payload.insights ?? []).map(toUpsellInsight);

      setActivePlans(active);
      setOverduePlans(overdue);
      setSchedule(scheduleItems);
      setReminders(reminderItems);
      setInsights(insightItems);
      setSummary(payload.summary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el resumen de layaway");
      setActivePlans([]);
      setOverduePlans([]);
      setSchedule([]);
      setReminders([]);
      setInsights([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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

  const summaryMetrics: LayawaySummaryMetric[] = useMemo(() => {
    if (!summary) {
      return [
        {
          label: "Activos",
          value: `${activePlans.length} planes`,
          accent: "text-emerald-600 dark:text-emerald-300",
          change: { direction: "flat", label: "Cargando..." },
        },
        {
          label: "Vencidos (cantidad)",
          value: `${overduePlans.length} planes`,
          accent: "text-amber-600 dark:text-amber-300",
          change: { direction: "flat", label: "Cargando..." },
        },
        {
          label: "Saldados hoy",
          value: "0 planes",
          accent: "text-sky-600 dark:text-sky-300",
          change: { direction: "flat", label: "Cargando..." },
        },
        {
          label: "Abonos hoy",
          value: formatCurrency(0),
          accent: "text-emerald-600 dark:text-emerald-300",
          change: { direction: "flat", label: "Cargando..." },
        },
      ];
    }

    return [
      {
        label: "Activos",
        value: `${summary.activeCount} planes`,
        accent: "text-emerald-600 dark:text-emerald-300",
        change: {
          direction: summary.autopayCount > 0 ? "up" : "flat",
          label: `${summary.autopayCount} con AutoCobro`,
        },
      },
      {
        label: "Vencidos (cantidad)",
        value: `${summary.overdueCount} planes`,
        accent: "text-amber-600 dark:text-amber-300",
        change: {
          direction: summary.overdueOutstandingCents > 0 ? "up" : "flat",
          label: summary.overdueOutstandingCents > 0
            ? formatCurrency(summary.overdueOutstandingCents / 100)
            : "Sin saldo",
        },
      },
      {
        label: "Saldados hoy",
        value: `${summary.completedToday} planes`,
        accent: "text-sky-600 dark:text-sky-300",
        change: {
          direction: summary.completedToday > 0 ? "up" : "flat",
          label: summary.completedToday > 0 ? "Cobros confirmados" : "Aún sin cierres",
        },
      },
      {
        label: "Abonos hoy",
        value: formatCurrency(summary.paymentsTodayCents / 100),
        accent: "text-emerald-600 dark:text-emerald-300",
        change: {
          direction: summary.paymentsTodayCount > 0 ? "up" : "flat",
          label: `${summary.paymentsTodayCount} transacción(es)`,
        },
      },
    ];
  }, [summary, activePlans.length, overduePlans.length]);

  const autopayPenetration = useMemo(() => {
    if (schedule.length) {
      const auto = schedule.filter((item) => item.channel === "auto").length;
      return auto / schedule.length;
    }
    return summary?.autopayRatio ?? 0;
  }, [schedule, summary]);

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

      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          Cargando datos de layaway...
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/50 dark:bg-transparent dark:text-rose-200"
          >
            Reintentar
          </button>
        </div>
      ) : null}

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
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setActiveFilters((filters) => ({ ...filters, search: "" }));
                  }
                }}
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
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setOverdueFilters((filters) => ({ ...filters, search: "" }));
                  }
                }}
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
