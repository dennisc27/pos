/**
 * Channel Status Badge Component
 * Reusable status indicator for ecommerce channels
 */

import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

type ChannelStatus = "connected" | "disconnected" | "error";

interface ChannelStatusBadgeProps {
  status: ChannelStatus;
  className?: string;
}

const statusConfig: Record<ChannelStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  connected: {
    label: "Connected",
    icon: CheckCircle2,
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  disconnected: {
    label: "Disconnected",
    icon: XCircle,
    className: "border-slate-400/60 bg-slate-200/60 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-300",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    className: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

export function ChannelStatusBadge({ status, className = "" }: ChannelStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.disconnected;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${config.className} ${className}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

