/**
 * Order Timeline Component
 * Visualizes order status history
 */

import { CheckCircle2, Clock, Package, Truck, XCircle } from "lucide-react";

type OrderStatus = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";
type FulfillmentStatus = "unfulfilled" | "picking" | "packed" | "shipped";

interface TimelineEvent {
  status: OrderStatus;
  fulfillmentStatus?: FulfillmentStatus;
  timestamp: string;
  note?: string;
}

interface OrderTimelineProps {
  status: OrderStatus;
  fulfillmentStatus?: FulfillmentStatus;
  createdAt: string;
  updatedAt: string;
  events?: TimelineEvent[];
  className?: string;
}

const statusConfig: Record<OrderStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "text-amber-600 dark:text-amber-400",
  },
  paid: {
    label: "Paid",
    icon: CheckCircle2,
    className: "text-blue-600 dark:text-blue-400",
  },
  fulfilled: {
    label: "Fulfilled",
    icon: Package,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "text-rose-600 dark:text-rose-400",
  },
  refunded: {
    label: "Refunded",
    icon: XCircle,
    className: "text-slate-600 dark:text-slate-400",
  },
};

const fulfillmentConfig: Record<FulfillmentStatus, { label: string; icon: typeof Package }> = {
  unfulfilled: {
    label: "Unfulfilled",
    icon: Package,
  },
  picking: {
    label: "Picking",
    icon: Package,
  },
  packed: {
    label: "Packed",
    icon: Package,
  },
  shipped: {
    label: "Shipped",
    icon: Truck,
  },
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export function OrderTimeline({
  status,
  fulfillmentStatus,
  createdAt,
  updatedAt,
  events = [],
  className = "",
}: OrderTimelineProps) {
  // Build timeline from events or infer from current status
  const timeline: TimelineEvent[] = events.length > 0
    ? events
    : [
        { status: "pending", timestamp: createdAt },
        ...(status !== "pending" ? [{ status, timestamp: updatedAt }] : []),
      ];

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="text-sm font-semibold text-foreground">Order Timeline</h3>
      <div className="space-y-2">
        {timeline.map((event, index) => {
          const config = statusConfig[event.status];
          const Icon = config.icon;
          const isLast = index === timeline.length - 1;

          return (
            <div key={index} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`rounded-full border-2 p-1.5 ${isLast ? config.className : "border-slate-300 dark:border-slate-600"}`}
                >
                  <Icon className={`h-3 w-3 ${isLast ? "" : "text-slate-400"}`} />
                </div>
                {!isLast && (
                  <div className="h-8 w-0.5 bg-slate-200 dark:bg-slate-700" />
                )}
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isLast ? config.className : "text-slate-600 dark:text-slate-400"}`}>
                    {config.label}
                  </span>
                  {event.fulfillmentStatus && (
                    <span className="text-xs text-muted-foreground">
                      ({fulfillmentConfig[event.fulfillmentStatus].label})
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatTimestamp(event.timestamp)}
                </p>
                {event.note && (
                  <p className="mt-1 text-xs text-muted-foreground">{event.note}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

