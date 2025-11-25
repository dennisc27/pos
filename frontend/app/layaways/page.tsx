"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";

import { LayawaySummary } from "@/components/layaways/layaway-summary";
import { LayawayQueue } from "@/components/layaways/layaway-queue";
import type {
  EngagementReminder,
  LayawayPlan,
  LayawaySummaryMetric,
} from "@/components/layaways/types";
import { formatContactTimestamp, formatCurrency } from "@/components/layaways/utils";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type DashboardSummary = {
  activeCount: number;
  overdueCount: number;
  completedToday: number;
  cancelledToday: number;
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

  const formatted = formatDateTimeForDisplay(value);
  return formatted === "—" ? value : formatted;
}

function formatShortDateLabel(value: string | null) {
  if (!value) {
    return "—";
  }

  const formatted = formatDateForDisplay(value);
  return formatted === "—" ? value : formatted;
}

function formatReminderTimestamp(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const now = new Date();
  const sameDay = now.toDateString() === parsed.toDateString();
  const timePart = parsed.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) {
    return `Hoy · ${timePart}`;
  }

  const datePart = formatDateForDisplay(parsed);
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

type LayawayFilters = {
  search: string;
  branch: string;
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
    const matchesRisk = filters.risk === "all" || plan.risk === filters.risk;

    return matchesSearch && matchesBranch && matchesRisk;
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


export default function LayawaysPage() {
  const [activePlans, setActivePlans] = useState<LayawayPlan[]>([]);
  const [overduePlans, setOverduePlans] = useState<LayawayPlan[]>([]);
  const [selectedActive, setSelectedActive] = useState<string[]>([]);
  const [selectedOverdue, setSelectedOverdue] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<LayawayFilters>({
    search: "",
    branch: "all",
    risk: "all",
  });
  const [overdueFilters, setOverdueFilters] = useState<LayawayFilters>({
    search: "",
    branch: "all",
    risk: "all",
  });
  const [reminders, setReminders] = useState<EngagementReminder[]>([]);
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
      const reminderItems = (payload.reminders ?? []).map(toReminder);

      setActivePlans(active);
      setOverduePlans(overdue);
      setReminders(reminderItems);
      setSummary(payload.summary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el resumen de layaway");
      setActivePlans([]);
      setOverduePlans([]);
      setReminders([]);
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
          label: "Vencidos",
          value: `${overduePlans.length} planes`,
          accent: "text-amber-600 dark:text-amber-300",
          change: { direction: "flat", label: "Cargando..." },
        },
        {
          label: "Abonos hoy (cantidad)",
          value: "0",
          accent: "text-emerald-600 dark:text-emerald-300",
          change: { direction: "flat", label: "Cargando..." },
        },
        {
          label: "Cancelados hoy",
          value: "0",
          accent: "text-slate-600 dark:text-slate-300",
          change: { direction: "flat", label: "Cargando..." },
        },
      ];
    }

    return [
      {
        label: "Activos",
        value: `${summary.activeCount}`,
        accent: "text-emerald-600 dark:text-emerald-300",
        change: {
          direction: "flat",
          label: "planes activos",
        },
      },
      {
        label: "Vencidos",
        value: `${summary.overdueCount}`,
        accent: "text-amber-600 dark:text-amber-300",
        change: {
          direction: summary.overdueOutstandingCents > 0 ? "up" : "flat",
          label: summary.overdueOutstandingCents > 0
            ? formatCurrency(summary.overdueOutstandingCents / 100)
            : "Sin saldo",
        },
      },
      {
        label: "Abonos hoy (cantidad)",
        value: `${summary.paymentsTodayCount}`,
        accent: "text-emerald-600 dark:text-emerald-300",
        change: {
          direction: summary.paymentsTodayCount > 0 ? "up" : "flat",
          label: summary.paymentsTodayCount > 0
            ? formatCurrency(summary.paymentsTodayCents / 100)
            : "Sin abonos",
        },
      },
      {
        label: "Cancelados hoy",
        value: `${summary.cancelledToday ?? 0}`,
        accent: "text-slate-600 dark:text-slate-300",
        change: {
          direction: (summary.cancelledToday ?? 0) > 0 ? "up" : "flat",
          label: (summary.cancelledToday ?? 0) > 0 ? "Cancelaciones" : "Sin cancelaciones",
        },
      },
    ];
  }, [summary, activePlans.length, overduePlans.length]);


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


  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Layaways</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Controla los planes de apartado activos y gestiona los clientes en mora.
          </p>
        </div>
        <Link
          href="/layaways/search"
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/20"
        >
          <Search className="h-4 w-4" />
          Buscar
        </Link>
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

      <LayawayQueue
        title="Planes activos"
        subtitle="Prioriza cuotas próximas a vencer y confirma promesas de pago"
        plans={filteredActive}
        actionLabel="Enviar recordatorio"
        actionDisabled={!selectedActive.length}
        onAction={() => handleBulkReminder("active")}
        selectedIds={selectedActive}
        onToggleSelect={(id) => handleToggleSelection("active", id)}
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

      <LayawayQueue
        title="En mora y riesgo de cancelación"
        subtitle="Contacta a los clientes con más de 5 días de atraso"
        plans={filteredOverdue}
        actionLabel="Recordatorio de cobranza"
        actionDisabled={!selectedOverdue.length}
        onAction={() => handleBulkReminder("overdue")}
        selectedIds={selectedOverdue}
        onToggleSelect={(id) => handleToggleSelection("overdue", id)}
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

      <div className="flex items-center justify-end gap-4 rounded-2xl border border-slate-200/70 bg-white/70 px-6 py-4 text-xs text-slate-500 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-400">
        <span>
          Recordatorios activos: <strong className="text-slate-700 dark:text-slate-200">{reminders.length}</strong>
        </span>
      </div>
    </div>
  );
}
