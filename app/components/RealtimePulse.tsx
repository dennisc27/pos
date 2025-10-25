interface RealtimeEvent {
  id: string;
  time: string;
  actor: string;
  action: string;
  context: string;
  accent?: "success" | "warning" | "danger" | "default";
}

const accentClassMap: Record<NonNullable<RealtimeEvent["accent"]>, string> = {
  success: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning",
  danger: "bg-danger/20 text-danger",
  default: "bg-brand/20 text-brand-light"
};

export function RealtimePulse({ events }: { events: RealtimeEvent[] }) {
  return (
    <section className="glass-panel grid-card-shadow flex flex-col gap-4 rounded-3xl p-6">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Realtime Pulse</h3>
          <p className="text-sm text-slate-400">
            Live feed of front counter, pawn, and service events across branches.
          </p>
        </div>
        <span className="h-2 w-2 animate-pulse rounded-full bg-success shadow-[0_0_10px_2px_rgba(34,197,94,0.65)]" />
      </header>
      <ol className="space-y-3">
        {events.map((event) => (
          <li
            key={event.id}
            className="flex items-start gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-3"
          >
            <span
              className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                accentClassMap[event.accent ?? "default"]
              }`}
            >
              ●
            </span>
            <div className="flex-1">
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-white">{event.actor}</span> {event.action}
                <span className="text-slate-500"> {event.context}</span>
              </p>
              <p className="text-xs text-slate-500">{event.time}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
