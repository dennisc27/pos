/**
 * Webhook Event Viewer Component
 * Displays webhook payloads with filtering
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, Filter, Search } from "lucide-react";

interface WebhookEvent {
  id: number;
  channelId: number;
  eventType: string;
  payload: unknown;
  processed: boolean;
  errorMessage?: string | null;
  createdAt: string;
}

interface WebhookEventViewerProps {
  events: WebhookEvent[];
  onFilterChange?: (filters: { eventType?: string; processed?: boolean }) => void;
  className?: string;
}

function formatPayload(payload: unknown): string {
  if (payload == null) return "—";
  if (typeof payload === "string") return payload;
  return JSON.stringify(payload, null, 2);
}

export function WebhookEventViewer({ events, onFilterChange, className = "" }: WebhookEventViewerProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [processedFilter, setProcessedFilter] = useState<boolean | null>(null);

  const toggleEvent = (eventId: number) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  const filteredEvents = events.filter((event) => {
    if (eventTypeFilter && !event.eventType.toLowerCase().includes(eventTypeFilter.toLowerCase())) {
      return false;
    }
    if (processedFilter !== null && event.processed !== processedFilter) {
      return false;
    }
    return true;
  });

  const uniqueEventTypes = Array.from(new Set(events.map((e) => e.eventType)));

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by event type..."
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value);
              onFilterChange?.({ eventType: e.target.value || undefined, processed: processedFilter ?? undefined });
            }}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={processedFilter === null ? "all" : processedFilter ? "processed" : "unprocessed"}
            onChange={(e) => {
              const value = e.target.value === "all" ? null : e.target.value === "processed";
              setProcessedFilter(value);
              onFilterChange?.({ eventType: eventTypeFilter || undefined, processed: value ?? undefined });
            }}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All</option>
            <option value="processed">Processed</option>
            <option value="unprocessed">Unprocessed</option>
          </select>
        </div>
        <div className="text-xs text-muted-foreground">
          Showing {filteredEvents.length} of {events.length} events
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
            No webhook events found
          </div>
        ) : (
          filteredEvents.map((event) => {
            const isExpanded = expandedEvents.has(event.id);
            return (
              <div
                key={event.id}
                className="rounded-lg border border-border bg-card p-3 shadow-sm"
              >
                <div
                  className="flex cursor-pointer items-center justify-between"
                  onClick={() => toggleEvent(event.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{event.eventType}</span>
                        {event.processed ? (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                            Processed
                          </span>
                        ) : (
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                            Pending
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {event.errorMessage && (
                    <span className="rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-700 dark:text-rose-300">
                      Error
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    {event.errorMessage && (
                      <div className="rounded-md bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                        <strong>Error:</strong> {event.errorMessage}
                      </div>
                    )}
                    <div>
                      <p className="mb-1 text-xs font-medium text-foreground">Payload:</p>
                      <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 text-xs">
                        {formatPayload(event.payload)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

