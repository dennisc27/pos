export type LoanSummaryMetric = {
  label: string;
  value: string;
  accent?: string;
  change?: {
    direction: "up" | "down";
    label: string;
  };
};

export type LoanQueueItem = {
  id: string;
  ticket: string;
  customer: string;
  collateral: string;
  branch: string;
  principal: number;
  accrued?: number;
  dueDate: string;
  dueDescriptor: string;
  risk: "low" | "medium" | "high";
  contactPreference: "SMS" | "WhatsApp" | "Call";
  status: "due_today" | "past_due";
};

export type RenewalCandidate = {
  id: string;
  customer: string;
  ticket: string;
  outstanding: number;
  maturity: string;
  lastAction: string;
  channel: "SMS" | "WhatsApp" | "Call";
  probability: number;
};

export type LoanActivityEvent = {
  id: string;
  time: string;
  type: "new" | "renewal" | "redemption" | "payment" | "notification";
  title: string;
  description: string;
  amount?: number;
  actor: string;
};

export type CollateralMixItem = {
  category: string;
  percentage: number;
  trend: "up" | "down" | "flat";
  detail: string;
};

export type RiskBand = {
  label: string;
  count: number;
  descriptor: string;
};
