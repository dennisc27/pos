export type MarketingSummaryMetric = {
  label: string;
  value: string;
  accent?: string;
  change?: {
    direction: "up" | "down" | "flat";
    label: string;
  };
};

export type CampaignRecord = {
  id: string;
  name: string;
  channel: "sms" | "email" | "whatsapp" | "push";
  segment: string;
  status: "draft" | "scheduled" | "sending" | "completed";
  schedule: string;
  owner: string;
  metrics: {
    sent: number;
    delivered: number;
    openRate?: number;
    clickRate?: number;
    replyRate?: number;
    revenue?: number;
  };
};

export type TemplateRecord = {
  id: string;
  name: string;
  category: string;
  channel: "sms" | "email" | "whatsapp";
  lastEdited: string;
  usageCount: number;
  status: "approved" | "pending" | "draft";
  tags?: string[];
};

export type SegmentRecord = {
  id: string;
  name: string;
  size: number;
  growth: {
    direction: "up" | "down" | "flat";
    label: string;
  };
  traits: string[];
  lastSync: string;
};

export type AutomationPlay = {
  id: string;
  trigger: string;
  description: string;
  channel: "sms" | "email" | "whatsapp" | "push";
  status: "active" | "paused" | "testing";
  lastRun: string;
  nextRun: string;
  audience: string;
};

export type ReviewRecord = {
  id: string;
  source: "google" | "facebook" | "in-store" | "survey";
  rating: number;
  customer: string;
  snippet: string;
  receivedAt: string;
  status: "new" | "responded" | "flagged";
  channel: "email" | "whatsapp" | "sms" | "in-store";
};
