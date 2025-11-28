/**
 * Sync Status Indicator Component
 * Shows last sync time and status for listings/channels
 */

import { CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";

type SyncStatus = "pending" | "synced" | "error";

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  lastSyncedAt?: string | null;
  className?: string;
}

const statusConfig: Record<SyncStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "text-amber-600 dark:text-amber-400",
  },
  synced: {
    label: "Synced",
    icon: CheckCircle2,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    className: "text-rose-600 dark:text-rose-400",
  },
};

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "Never";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function SyncStatusIndicator({ status, lastSyncedAt, className = "" }: SyncStatusIndicatorProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 text-xs ${config.className} ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="font-medium">{config.label}</span>
      {lastSyncedAt && (
        <span className="text-muted-foreground">
          • {formatRelativeTime(lastSyncedAt)}
        </span>
      )}
    </div>
  );
}

/**
 * Sync Status Indicator with Loading State
 */
export function SyncStatusIndicatorWithLoading({ 
  status, 
  lastSyncedAt, 
  isSyncing = false,
  className = "" 
}: SyncStatusIndicatorProps & { isSyncing?: boolean }) {
  if (isSyncing) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 ${className}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="font-medium">Syncing...</span>
      </div>
    );
  }

  return <SyncStatusIndicator status={status} lastSyncedAt={lastSyncedAt} className={className} />;
}

