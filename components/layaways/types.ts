export type LayawaySummaryMetric = {
  label: string;
  value: string;
  accent?: string;
  change?: {
    direction: "up" | "down" | "flat";
    label: string;
  };
};

export type LayawayPlan = {
  id: string;
  planNumber: string;
  customer: string;
  item: string;
  branch: string;
  total: number;
  balance: number;
  deposit: number;
  nextPaymentDate: string;
  nextPaymentAmount: number;
  status: "active" | "overdue" | "completed";
  autopay: boolean;
  lastPayment: string;
  contactPreference: "SMS" | "WhatsApp" | "Call" | "Email";
  risk: "low" | "medium" | "high";
  promiseToPay?: string;
};

export type PaymentScheduleItem = {
  id: string;
  dueDate: string;
  customer: string;
  planNumber: string;
  amount: number;
  channel: "cash" | "card" | "transfer" | "auto";
  status: "scheduled" | "processing" | "completed" | "overdue";
  notes?: string;
};

export type EngagementReminder = {
  id: string;
  planNumber: string;
  customer: string;
  message: string;
  channel: "SMS" | "WhatsApp" | "Email";
  scheduledFor: string;
  status: "scheduled" | "sent" | "queued";
};

export type UpsellInsight = {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
};
