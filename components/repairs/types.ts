export type RepairStatus =
  | "diagnosing"
  | "awaiting_approval"
  | "in_progress"
  | "quality_control"
  | "ready"
  | "delivered";

export type MaterialLine = {
  id: string;
  name: string;
  quantity: number;
  uom: string;
  issued: number;
  used: number;
};

export type PaymentMilestoneStatus = "pending" | "collected" | "waived";

export type PaymentMilestone = {
  id: string;
  label: string;
  amount: number;
  due: string;
  status: PaymentMilestoneStatus;
};

export type JobActivity = {
  id: string;
  timestamp: string;
  actor: string;
  message: string;
};

export type RepairJob = {
  id: string;
  ticket: string;
  type: "repair" | "fabrication";
  customer: string;
  customerCode: string;
  branch: string;
  item: string;
  issue: string;
  status: RepairStatus;
  promisedAt: string;
  rush: boolean;
  assignedTo?: string;
  estimate: number;
  balanceDue: number;
  photos: number;
  hasWarranty: boolean;
  materials: MaterialLine[];
  milestones: PaymentMilestone[];
  notes: string[];
  activity: JobActivity[];
};

export type RepairsSummaryMetric = {
  label: string;
  value: string;
  accent?: string;
  change?: {
    direction: "up" | "down" | "flat";
    label: string;
  };
};
