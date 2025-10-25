export type TrendDirection = "up" | "down" | "flat";

export interface CashSummaryMetric {
  label: string;
  value: string;
  accent?: string;
  change?: {
    direction: TrendDirection;
    label: string;
  };
}

export interface ShiftTask {
  label: string;
  completed: boolean;
}

export interface ShiftSnapshot {
  id: string;
  branch: string;
  register: string;
  clerk: string;
  openedAt: string;
  status: "open" | "closing" | "balanced";
  expected: number;
  counted?: number;
  variance?: number;
  lastMovement: string;
  nextAction?: string;
  tasks: ShiftTask[];
}

export interface DrawerStatus {
  id: string;
  register: string;
  branch: string;
  expected: number;
  counted: number;
  variance: number;
  lastCount: string;
  status: "ok" | "attention" | "review";
}

export type CashMovementType =
  | "sale_cash"
  | "refund_cash"
  | "drop"
  | "paid_in"
  | "paid_out"
  | "adjustment";

export interface CashMovement {
  id: string;
  time: string;
  branch: string;
  user: string;
  type: CashMovementType;
  description: string;
  amount: number;
  reference?: string;
}

export interface SafeDropItem {
  id: string;
  dropNumber: string;
  branch: string;
  amount: number;
  bagId: string;
  status: "queued" | "sealed" | "in_transit" | "received";
  scheduledPickup: string;
  escort: string;
  notes?: string;
}
