export type TrendDirection = "up" | "down";

export type CrmSummaryMetric = {
  label: string;
  value: string;
  accent?: string;
  change?: {
    direction: TrendDirection;
    label: string;
  };
};

export type CustomerRecord = {
  id: string;
  fullName: string;
  avatar?: string;
  code: string;
  tier: string;
  status: "vip" | "standard" | "watch" | "restricted";
  lastVisit: string;
  branch: string;
  lifetimeValue: number;
  openBalances: number;
  loyaltyPoints: number;
  preferredChannel: string;
  segments: string[];
  tags?: string[];
};

export type CustomerActivity = {
  id: string;
  timestamp: string;
  type: "loan" | "sale" | "layaway" | "message" | "note" | "alert";
  title: string;
  description: string;
  amount?: number;
  status?: string;
};

export type IdentityDocument = {
  type: string;
  number: string;
  expires?: string;
};

export type CustomerProfileDetails = {
  customer: CustomerRecord & {
    phone: string;
    email?: string;
    address?: string;
    doc: IdentityDocument;
    since: string;
    riskLevel?: "low" | "medium" | "high";
    kycStatus: "verified" | "pending" | "expired";
  };
  summary: Array<{
    label: string;
    value: string;
    hint?: string;
  }>;
  activity: CustomerActivity[];
};

export type MessageThread = {
  id: string;
  customerId: string;
  channel: "whatsapp" | "sms" | "email";
  preview: string;
  updatedAt: string;
  unread?: boolean;
  agent?: string;
  lastMessageAuthor: "customer" | "agent" | "system";
};

export type Message = {
  id: string;
  author: "customer" | "agent" | "system";
  body: string;
  timestamp: string;
  channel: MessageThread["channel"];
  status?: "sent" | "delivered" | "read" | "failed";
  attachments?: Array<{
    type: "image" | "pdf" | "audio";
    name: string;
  }>;
};

export type Conversation = {
  thread: MessageThread;
  messages: Message[];
};

export type LoyaltyLedgerEntry = {
  id: string;
  date: string;
  description: string;
  points: number;
  balance: number;
  source: "sale" | "layaway" | "loan" | "adjustment" | "campaign";
};

export type EngagementPlay = {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  channel: "sms" | "whatsapp" | "email" | "call";
  due: string;
  owner: string;
};
