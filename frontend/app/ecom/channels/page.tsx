"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  CheckCircle2,
  DatabaseZap,
  Globe,
  Link2,
  Loader2,
  RefreshCcw,
  Server,
  Settings,
  ShieldCheck,
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const providerOptions = [
  { value: "shopify", label: "Shopify" },
  { value: "woocommerce", label: "WooCommerce" },
  { value: "amazon", label: "Amazon" },
  { value: "ebay", label: "eBay" },
  { value: "custom", label: "Custom" },
] as const;

const statusTone: Record<string, string> = {
  connected: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/40",
  disconnected: "bg-slate-500/10 text-slate-300 border border-slate-500/40",
  error: "bg-rose-500/10 text-rose-400 border border-rose-500/40",
};

const defaultConfigTemplates: Record<string, string> = {
  shopify: '{\n  "apiKey": "",\n  "password": "",\n  "storeDomain": "your-shop.myshopify.com"\n}',
  woocommerce: '{\n  "siteUrl": "https://example.com",\n  "consumerKey": "",\n  "consumerSecret": ""\n}',
  amazon: '{\n  "sellerId": "",\n  "region": "na",\n  "authToken": ""\n}',
  ebay: '{\n  "clientId": "",\n  "clientSecret": ""\n}',
  custom: '{\n  "endpoint": "https://api.example.com/hooks",\n  "token": ""\n}',
};

type StatusMessage = { tone: "success" | "error"; message: string } | null;

type Channel = {
  id: number;
  name: string;
  provider: string;
  status: string;
  config: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
};

type ChannelLog = {
  id: number;
  channelId?: number;
  event: string;
  payload: unknown;
  createdAt: string | null;
  source?: 'system' | 'webhook';
};

type ChannelsResponse = {
  channels: Channel[];
  recentLogs: ChannelLog[];
};

type ChannelLogsResponse = {
  channel: Channel;
  logs: ChannelLog[];
};

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatEventPayload(payload: unknown) {
  if (payload == null || typeof payload === "string") {
    return payload ?? "";
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch (error) {
    return String(payload);
  }
}

export default function EcommerceChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [recentLogs, setRecentLogs] = useState<ChannelLog[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [channelLogs, setChannelLogs] = useState<ChannelLog[]>([]);
  const [loading, setLoading] = useState({
    fetch: false,
    create: false,
    logs: false,
    test: false,
    sync: false,
  });
  const [status, setStatus] = useState<StatusMessage>(null);
  const [form, setForm] = useState({
    name: "",
    provider: providerOptions[0].value,
    config: defaultConfigTemplates[providerOptions[0].value],
    testConnection: true,
  });

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId) ?? null,
    [channels, selectedChannelId]
  );

  const loadChannels = useCallback(async () => {
    setLoading((state) => ({ ...state, fetch: true }));
    setStatus(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ecom/channels`);
      const data = (await response.json()) as ChannelsResponse;

      if (!response.ok) {
        throw new Error((data as { error?: string })?.error ?? "Unable to load channels");
      }

      setChannels(data.channels ?? []);
      setRecentLogs(data.recentLogs ?? []);

      if (data.channels.length > 0) {
        setSelectedChannelId((current) => current ?? data.channels[0]!.id);
      } else {
        setSelectedChannelId(null);
        setChannelLogs([]);
      }
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Failed to load channels" });
    } finally {
      setLoading((state) => ({ ...state, fetch: false }));
    }
  }, []);

  const loadLogs = useCallback(async (channelId: number) => {
    setLoading((state) => ({ ...state, logs: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/ecom/channels/${channelId}/logs`);
      const data = (await response.json()) as ChannelLogsResponse;
      if (!response.ok) {
        throw new Error((data as { error?: string })?.error ?? "Unable to load logs");
      }

      setChannelLogs(data.logs ?? []);
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Failed to load logs" });
      setChannelLogs([]);
    } finally {
      setLoading((state) => ({ ...state, logs: false }));
    }
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (selectedChannelId != null) {
      loadLogs(selectedChannelId).catch(() => {
        /* handled above */
      });
    }
  }, [selectedChannelId, loadLogs]);

  const handleProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextProvider = event.target.value;
    setForm((state) => ({
      ...state,
      provider: nextProvider,
      config: defaultConfigTemplates[nextProvider] ?? state.config,
    }));
  };

  const handleCreateChannel = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    let parsedConfig: Record<string, unknown> = {};
    try {
      parsedConfig = form.config.trim() ? (JSON.parse(form.config) as Record<string, unknown>) : {};
    } catch (error) {
      setStatus({ tone: "error", message: "El JSON de configuración no es válido" });
      return;
    }

    setLoading((state) => ({ ...state, create: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/ecom/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          provider: form.provider,
          config: parsedConfig,
          testConnection: form.testConnection,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No fue posible crear el canal");
      }

      setStatus({ tone: "success", message: "Canal creado correctamente" });
      setForm({
        name: "",
        provider: form.provider,
        config: defaultConfigTemplates[form.provider] ?? "{}",
        testConnection: true,
      });
      await loadChannels();
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al crear el canal" });
    } finally {
      setLoading((state) => ({ ...state, create: false }));
    }
  };

  const executeChannelAction = async (
    channelId: number,
    endpoint: string,
    stateKey: "test" | "sync",
    successMessage: string
  ) => {
    setStatus(null);
    setLoading((state) => ({ ...state, [stateKey]: true }));

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Operación no completada");
      }

      setStatus({ tone: "success", message: successMessage });
      await loadChannels();
      await loadLogs(channelId);
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Operación fallida" });
    } finally {
      setLoading((state) => ({ ...state, [stateKey]: false }));
    }
  };

  const handleTestConnection = async (channelId: number) => {
    await executeChannelAction(channelId, `/api/ecom/channels/${channelId}/test`, "test", "Prueba ejecutada");
  };

  const handleSyncNow = async (channelId: number) => {
    await executeChannelAction(channelId, `/api/ecom/channels/${channelId}/sync`, "sync", "Sincronización lanzada");
  };

  const statusBadge = (status: string) => {
    const tone = statusTone[status] ?? statusTone.disconnected;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${tone}`}>
        {status === "connected" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sky-400">
          <Globe className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Integraciones</span>
        </div>
        <h1 className="text-3xl font-semibold text-white">E-Commerce · Canales conectados</h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Configura marketplaces, prueba las credenciales y monitorea webhooks entrantes. Las pruebas respetan los
          requisitos mínimos de cada proveedor y registran cada evento en el historial.
        </p>
      </header>

      {status && (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            status.tone === "success" ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200" : "border-rose-500/60 bg-rose-500/10 text-rose-200"
          }`}
        >
          {status.tone === "success" ? <ShieldCheck className="mt-0.5 h-4 w-4" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}
          <span>{status.message}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/40">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Canales configurados</h2>
              <p className="text-xs text-slate-400">Selecciona un canal para ver su historial de webhooks y acciones.</p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              onClick={() => loadChannels()}
              disabled={loading.fetch}
            >
              {loading.fetch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />} Recargar
            </button>
          </div>

          <div className="space-y-3">
            {channels.length === 0 && (
              <div className="rounded-md border border-slate-800 bg-slate-900/70 px-4 py-5 text-center text-sm text-slate-400">
                No hay canales configurados todavía. Completa el formulario para agregar uno nuevo.
              </div>
            )}

            {channels.map((channel) => {
              const isActive = selectedChannelId === channel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setSelectedChannelId(channel.id)}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-sky-500/70 bg-sky-500/10 text-sky-50 shadow-lg shadow-sky-900/40"
                      : "border-slate-800 bg-slate-950/50 text-slate-200 hover:border-slate-700 hover:bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-slate-400" />
                      <span className="font-medium">{channel.name}</span>
                    </div>
                    {statusBadge(channel.status)}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Settings className="h-3 w-3" /> {channel.provider}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <DatabaseZap className="h-3 w-3" /> Última actualización: {formatDate(channel.updatedAt)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/40">
          <h2 className="text-lg font-semibold text-white">Registrar nuevo canal</h2>
          <p className="mt-1 text-xs text-slate-400">Valida credenciales y guarda la configuración cifrada en el backend.</p>

          <form className="mt-4 space-y-4" onSubmit={handleCreateChannel}>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300" htmlFor="channel-name">
                Nombre interno
              </label>
              <input
                id="channel-name"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                placeholder="Shopify - Tienda principal"
                value={form.name}
                onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300" htmlFor="channel-provider">
                Proveedor
              </label>
              <select
                id="channel-provider"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                value={form.provider}
                onChange={handleProviderChange}
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300" htmlFor="channel-config">
                Configuración JSON
              </label>
              <textarea
                id="channel-config"
                className="min-h-[160px] w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
                value={form.config}
                onChange={(event) => setForm((state) => ({ ...state, config: event.target.value }))}
              />
              <p className="text-[11px] text-slate-500">Nunca se exponen los secretos en el navegador.</p>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={form.testConnection}
                onChange={(event) => setForm((state) => ({ ...state, testConnection: event.target.checked }))}
                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950"
              />
              Probar conexión inmediatamente
            </label>

            <button
              type="submit"
              disabled={loading.create}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading.create ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Registrar canal
            </button>
          </form>
        </section>
      </div>

      {selectedChannel && (
        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Historial de eventos</h2>
                <p className="text-xs text-slate-400">
                  Webhooks y acciones recientes para <span className="font-semibold text-slate-200">{selectedChannel.name}</span>.
                </p>
              </div>
              <span className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                Última sincronización: {formatDate(selectedChannel.updatedAt)}
              </span>
            </div>

            <div className="space-y-3 overflow-hidden">
              {loading.logs && (
                <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando eventos…
                </div>
              )}

              {!loading.logs && channelLogs.length === 0 && (
                <div className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-4 text-sm text-slate-400">
                  No hay eventos registrados aún. Ejecuta una prueba o sincronización para generar actividad.
                </div>
              )}

              {!loading.logs &&
                channelLogs.map((log) => (
                  <div key={log.id} className="rounded-md border border-slate-800 bg-slate-950/60 px-4 py-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200">{log.event}</span>
                        {log.source && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                              log.source === "webhook"
                                ? "bg-emerald-500/10 text-emerald-300"
                                : "bg-slate-500/20 text-slate-200"
                            }`}
                          >
                            {log.source === "webhook" ? "webhook" : "sistema"}
                          </span>
                        )}
                      </div>
                      <span>{formatDate(log.createdAt)}</span>
                    </div>
                    {log.payload && (
                      <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950/80 p-3 text-[11px] leading-relaxed text-slate-300">
                        {formatEventPayload(log.payload)}
                      </pre>
                    )}
                  </div>
                ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-base font-semibold text-white">Acciones rápidas</h3>
              <p className="text-xs text-slate-400">
                Ejecuta una prueba de credenciales o inicia una sincronización completa.
              </p>
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  onClick={() => handleTestConnection(selectedChannel.id)}
                  disabled={loading.test}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading.test ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Probar conexión
                </button>
                <button
                  type="button"
                  onClick={() => handleSyncNow(selectedChannel.id)}
                  disabled={loading.sync}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading.sync ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Sincronizar ahora
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-base font-semibold text-white">Actividad global</h3>
              <p className="text-xs text-slate-400">Últimos eventos recibidos en todos los canales.</p>
              <div className="mt-3 space-y-3 text-xs text-slate-300">
                {recentLogs.length === 0 && <p className="text-slate-500">Sin actividad registrada.</p>}
                {recentLogs.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="rounded-md border border-slate-800/60 bg-slate-950/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200">{entry.event}</span>
                        {entry.source && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                              entry.source === "webhook"
                                ? "bg-emerald-500/10 text-emerald-300"
                                : "bg-slate-500/20 text-slate-200"
                            }`}
                          >
                            {entry.source === "webhook" ? "webhook" : "sistema"}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500">{formatDate(entry.createdAt)}</span>
                    </div>
                    {entry.payload && (
                      <pre className="mt-1 overflow-x-auto text-[10px] leading-snug text-slate-400">
                        {formatEventPayload(entry.payload)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
