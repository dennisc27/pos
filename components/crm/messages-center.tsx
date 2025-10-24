import { MessageCircle, Send, Smartphone, Voicemail } from "lucide-react";
import type { Conversation, MessageThread } from "./types";

const channelIcons = {
  whatsapp: Smartphone,
  sms: MessageCircle,
  email: Voicemail
};

export function MessagesCenter({
  threads,
  conversation
}: {
  threads: MessageThread[];
  conversation: Conversation;
}) {
  const ActiveIcon = channelIcons[conversation.thread.channel];

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <aside className="flex w-full flex-col gap-2 lg:w-48">
        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Conversaciones</div>
        <div className="flex flex-col gap-2">
          {threads.map((thread) => {
            const Icon = channelIcons[thread.channel];
            const isActive = thread.id === conversation.thread.id;
            return (
              <button
                key={thread.id}
                className={`flex flex-col gap-1 rounded-2xl border px-3 py-2 text-left text-xs transition ${
                  isActive
                    ? "border-sky-500 bg-sky-50 text-slate-900 shadow-sm dark:border-sky-400/80 dark:bg-sky-500/10 dark:text-slate-100"
                    : "border-slate-200/70 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800/70 dark:bg-slate-900/40 dark:text-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide">
                    <Icon className="h-3 w-3" /> {thread.channel}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{thread.updatedAt}</span>
                </div>
                <p className="line-clamp-2 text-[11px]">{thread.preview}</p>
                {thread.unread ? (
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-300">{thread.unread ? "Nuevo" : ""}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>
      <section className="flex flex-1 flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/30">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300">
              <ActiveIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{conversation.thread.channel.toUpperCase()}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Asignado a {conversation.thread.agent ?? "Equipo CRM"}</p>
            </div>
          </div>
          <button className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white">
            Ver historial completo
          </button>
        </header>
        <div className="flex flex-col gap-3">
          {conversation.messages.map((message) => (
            <article
              key={message.id}
              className={`flex flex-col gap-1 rounded-2xl border px-3 py-2 text-xs shadow-sm ${
                message.author === "agent"
                  ? "self-end border-sky-200 bg-sky-50 text-slate-700 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-slate-100"
                  : message.author === "customer"
                  ? "self-start border-slate-200/70 bg-white text-slate-700 dark:border-slate-800/70 dark:bg-slate-900/50 dark:text-slate-200"
                  : "self-center border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {message.author === "agent"
                    ? conversation.thread.agent ?? "Agente"
                    : message.author === "customer"
                    ? "Cliente"
                    : "Sistema"}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{message.timestamp}</span>
              </div>
              <p className="text-[12px] leading-5 text-slate-700 dark:text-slate-200">{message.body}</p>
              {message.attachments?.length ? (
                <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                  {message.attachments.map((attachment) => (
                    <span
                      key={attachment.name}
                      className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800/70"
                    >
                      {attachment.type.toUpperCase()} · {attachment.name}
                    </span>
                  ))}
                </div>
              ) : null}
              {message.status ? (
                <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">{message.status}</span>
              ) : null}
            </article>
          ))}
        </div>
        <form className="mt-2 flex items-center gap-2 rounded-full border border-slate-200/70 bg-slate-50 px-3 py-2 text-xs text-slate-600 shadow-sm transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-200 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:focus-within:border-sky-500/70 dark:focus-within:ring-sky-500/30">
          <input
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            placeholder="Escribe una respuesta y presiona Enter"
          />
          <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-white shadow hover:bg-sky-600">
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </section>
    </div>
  );
}
