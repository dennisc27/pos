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
  Edit,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { ChannelStatusBadge } from "@/components/ecom/channel-status-badge";
import { SyncStatusIndicator } from "@/components/ecom/sync-status-indicator";
import { WebhookEventViewer } from "@/components/ecom/webhook-event-viewer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const providerOptions = [
  { value: "shopify", label: "Shopify" },
  { value: "woocommerce", label: "WooCommerce" },
  { value: "amazon", label: "Amazon" },
  { value: "ebay", label: "eBay" },
  { value: "custom", label: "Custom" },
] as const;

const statusTone: Record<string, string> = {
  connected: "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  disconnected: "border border-slate-400/60 bg-slate-200/60 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-300",
  error: "border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const panelClassName =
  "rounded-lg border border-border bg-card p-5 shadow-sm transition dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-lg dark:shadow-slate-950/40";
const mutedCardClassName =
  "rounded-md border border-border bg-muted/60 px-4 py-5 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400";
const secondaryButtonClassName =
  "inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";
const secondaryButtonLargeClassName = secondaryButtonClassName.replace('text-xs', 'text-sm');
const inputClassName =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

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
  branchId?: number | null;
  lastSyncAt?: string | null;
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
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [showWebhookViewer, setShowWebhookViewer] = useState(false);
  const [loading, setLoading] = useState({
    fetch: false,
    create: false,
    logs: false,
    webhooks: false,
    test: false,
    sync: false,
    delete: false,
    oauth: false,
  });
  const [status, setStatus] = useState<StatusMessage>(null);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    provider: providerOptions[0].value,
    config: defaultConfigTemplates[providerOptions[0].value],
    branchId: "",
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
      loadWebhookLogs(selectedChannelId).catch(() => {
        /* handled below */
      });
    }
  }, [selectedChannelId, loadLogs]);

  // Polling for real-time sync status updates
  useEffect(() => {
    if (!selectedChannelId) return;

    const pollInterval = setInterval(() => {
      loadChannels().catch(() => {
        /* handled above */
      });
      if (showWebhookViewer) {
        loadWebhookLogs(selectedChannelId).catch(() => {
          /* handled below */
        });
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [selectedChannelId, showWebhookViewer, loadChannels]);

  const loadWebhookLogs = useCallback(async (channelId: number) => {
    setLoading((state) => ({ ...state, webhooks: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/ecom/channels/${channelId}/webhook-logs?limit=100`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to load webhook logs");
      }

      setWebhookLogs(data.logs ?? []);
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Failed to load webhook logs" });
      setWebhookLogs([]);
    } finally {
      setLoading((state) => ({ ...state, webhooks: false }));
    }
  }, []);

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

  const handleOAuthFlow = async (channelId: number) => {
    setStatus(null);
    setLoading((state) => ({ ...state, oauth: true }));

    try {
      // Get OAuth URL
      const response = await fetch(`${API_BASE_URL}/api/ecom/channels/${channelId}/oauth-url`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to get OAuth URL");
      }

      // Open OAuth URL in new window
      const authWindow = window.open(data.authUrl, "eBay OAuth", "width=600,height=700");

      // Listen for OAuth callback (you'd typically use a callback page)
      // For now, we'll show the URL and let user complete manually
      setStatus({
        tone: "success",
        message: "OAuth URL generated. Complete authorization and use the callback endpoint to save tokens.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to initiate OAuth flow",
      });
    } finally {
      setLoading((state) => ({ ...state, oauth: false }));
    }
  };

  const handleEditChannel = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingChannel) return;

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
      const response = await fetch(`${API_BASE_URL}/api/ecom/channels/${editingChannel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          config: parsedConfig,
          branchId: form.branchId ? Number.parseInt(form.branchId, 10) : null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No fue posible actualizar el canal");
      }

      setStatus({ tone: "success", message: "Canal actualizado correctamente" });
      setEditingChannel(null);
      setForm({
        name: "",
        provider: providerOptions[0].value,
        config: defaultConfigTemplates[providerOptions[0].value],
        branchId: "",
        testConnection: true,
      });
      await loadChannels();
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al actualizar el canal" });
    } finally {
      setLoading((state) => ({ ...state, create: false }));
    }
  };

  const handleDeleteChannel = async (channelId: number) => {
    setStatus(null);
    setLoading((state) => ({ ...state, delete: true }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/ecom/channels/${channelId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error ?? "No fue posible eliminar el canal");
      }

      setStatus({ tone: "success", message: "Canal eliminado correctamente" });
      setDeleteConfirm(null);
      if (selectedChannelId === channelId) {
        setSelectedChannelId(null);
      }
      await loadChannels();
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al eliminar el canal" });
    } finally {
      setLoading((state) => ({ ...state, delete: false }));
    }
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
        <div className="flex items-center gap-2 text-primary">
          <Globe className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Integraciones</span>
        </div>
        <h1 className="text-3xl font-semibold text-foreground dark:text-white">E-Commerce · Canales conectados</h1>
        <p className="max-w-3xl text-sm text-muted-foreground dark:text-slate-400">
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
        <section className={panelClassName}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground dark:text-white">Canales configurados</h2>
              <p className="text-xs text-muted-foreground dark:text-slate-400">Selecciona un canal para ver su historial de webhooks y acciones.</p>
            </div>
            <button
              className={secondaryButtonClassName}
              onClick={() => loadChannels()}
              disabled={loading.fetch}
            >
              {loading.fetch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />} Recargar
            </button>
          </div>

          <div className="space-y-3">
            {channels.length === 0 && (
              <div className={`${mutedCardClassName} text-center`}>
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
                      ? "border-primary/70 bg-primary/10 text-primary-foreground shadow-sm dark:border-sky-500/70 dark:bg-sky-500/10 dark:text-sky-50 dark:shadow-lg dark:shadow-sky-900/40"
                      : "border-border bg-card text-foreground hover:bg-muted/80 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-muted-foreground dark:text-slate-400" />
                      <span className="font-medium">{channel.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChannelStatusBadge status={channel.status as "connected" | "disconnected" | "error"} />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingChannel(channel);
                            setForm({
                              name: channel.name,
                              provider: channel.provider,
                              config: JSON.stringify(channel.config, null, 2),
                              branchId: channel.branchId ? String(channel.branchId) : "",
                              testConnection: false,
                            });
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Edit channel"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(channel.id);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-rose-600"
                          title="Delete channel"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Settings className="h-3 w-3" /> {channel.provider}
                    </span>
                    {channel.lastSyncAt && (
                      <SyncStatusIndicator
                        status="synced"
                        lastSyncedAt={channel.lastSyncAt}
                      />
                    )}
                    <span className="inline-flex items-center gap-1">
                      <DatabaseZap className="h-3 w-3" /> Updated: {formatDate(channel.updatedAt)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className={panelClassName}>
          <h2 className="text-lg font-semibold text-foreground dark:text-white">
            {editingChannel ? "Editar canal" : "Registrar nuevo canal"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground dark:text-slate-400">
            {editingChannel
              ? "Actualiza la configuración del canal."
              : "Valida credenciales y guarda la configuración cifrada en el backend."}
          </p>

          <form className="mt-4 space-y-4" onSubmit={editingChannel ? handleEditChannel : handleCreateChannel}>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="channel-name">
                Nombre interno
              </label>
              <input
                id="channel-name"
                className={inputClassName}
                placeholder="Shopify - Tienda principal"
                value={form.name}
                onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="channel-provider">
                Proveedor
              </label>
              <select
                id="channel-provider"
                className={inputClassName}
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
              <label className="text-xs font-medium text-muted-foreground" htmlFor="channel-config">
                Configuración JSON
              </label>
              <textarea
                id="channel-config"
                className="min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                value={form.config}
                onChange={(event) => setForm((state) => ({ ...state, config: event.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground dark:text-slate-500">Nunca se exponen los secretos en el navegador.</p>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.testConnection}
                onChange={(event) => setForm((state) => ({ ...state, testConnection: event.target.checked }))}
                className="h-3.5 w-3.5 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-950"
              />
              Probar conexión inmediatamente
            </label>

            {!editingChannel && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="channel-branch-id">
                  Branch ID (opcional)
                </label>
                <input
                  id="channel-branch-id"
                  type="number"
                  className={inputClassName}
                  placeholder="1"
                  value={form.branchId}
                  onChange={(event) => setForm((state) => ({ ...state, branchId: event.target.value }))}
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading.create}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading.create ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingChannel ? (
                  <Edit className="h-4 w-4" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                {editingChannel ? "Actualizar canal" : "Registrar canal"}
              </button>
              {editingChannel && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingChannel(null);
                    setForm({
                      name: "",
                      provider: providerOptions[0].value,
                      config: defaultConfigTemplates[providerOptions[0].value],
                      branchId: "",
                      testConnection: true,
                    });
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>
      </div>

      {selectedChannel && (
        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className={panelClassName}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground dark:text-white">Historial de eventos</h2>
                <p className="text-xs text-muted-foreground dark:text-slate-400">
                  Webhooks y acciones recientes para <span className="font-semibold text-foreground dark:text-slate-200">{selectedChannel.name}</span>.
                </p>
              </div>
              <span className="rounded-md border border-input bg-muted px-3 py-1 text-xs text-muted-foreground dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                Última sincronización: {formatDate(selectedChannel.updatedAt)}
              </span>
            </div>

            <div className="space-y-3 overflow-hidden">
              {loading.logs && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando eventos…
                </div>
              )}

              {!loading.logs && channelLogs.length === 0 && (
                <div className={`${mutedCardClassName} px-3 py-4`}>
                  No hay eventos registrados aún. Ejecuta una prueba o sincronización para generar actividad.
                </div>
              )}

              {!loading.logs &&
                channelLogs.map((log) => (
                  <div key={log.id} className="rounded-md border border-border bg-muted px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground dark:text-slate-200">{log.event}</span>
                        {log.source && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                              log.source === "webhook"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "bg-muted text-muted-foreground dark:bg-slate-500/20 dark:text-slate-200"
                            }`}
                          >
                            {log.source === "webhook" ? "webhook" : "sistema"}
                          </span>
                        )}
                      </div>
                      <span>{formatDate(log.createdAt)}</span>
                    </div>
                    {log.payload && (
                      <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground dark:bg-slate-950/80 dark:text-slate-300">
                        {formatEventPayload(log.payload)}
                      </pre>
                    )}
                  </div>
                ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className={panelClassName}>
              <h3 className="text-base font-semibold text-foreground dark:text-white">Acciones rápidas</h3>
              <p className="text-xs text-muted-foreground dark:text-slate-400">
                Ejecuta una prueba de credenciales o inicia una sincronización completa.
              </p>
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  onClick={() => handleTestConnection(selectedChannel.id)}
                  disabled={loading.test}
                  className={secondaryButtonLargeClassName}
                >
                  {loading.test ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Probar conexión
                </button>
                {selectedChannel.provider === "ebay" && (
                  <button
                    type="button"
                    onClick={() => handleOAuthFlow(selectedChannel.id)}
                    disabled={loading.oauth}
                    className={secondaryButtonLargeClassName}
                  >
                    {loading.oauth ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}{" "}
                    Iniciar OAuth
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSyncNow(selectedChannel.id)}
                  disabled={loading.sync}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading.sync ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Sincronizar ahora
                </button>
              </div>
            </div>

            <div className={panelClassName}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground dark:text-white">Actividad global</h3>
                  <p className="text-xs text-muted-foreground dark:text-slate-400">Últimos eventos recibidos en todos los canales.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowWebhookViewer(!showWebhookViewer);
                    if (!showWebhookViewer && selectedChannelId) {
                      loadWebhookLogs(selectedChannelId).catch(() => {});
                    }
                  }}
                  className={secondaryButtonClassName}
                >
                  {showWebhookViewer ? "Ocultar" : "Ver"} Webhooks
                </button>
              </div>
              <div className="mt-3 space-y-3 text-xs text-muted-foreground dark:text-slate-300">
                {recentLogs.length === 0 && <p className="text-muted-foreground dark:text-slate-500">Sin actividad registrada.</p>}
                {recentLogs.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="rounded-md border border-border bg-muted px-3 py-2 dark:border-slate-800/60 dark:bg-slate-950/60">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground dark:text-slate-200">{entry.event}</span>
                        {entry.source && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                              entry.source === "webhook"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "bg-muted text-muted-foreground dark:bg-slate-500/20 dark:text-slate-200"
                            }`}
                          >
                            {entry.source === "webhook" ? "webhook" : "sistema"}
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground dark:text-slate-500">{formatDate(entry.createdAt)}</span>
                    </div>
                    {entry.payload && (
                      <pre className="mt-1 overflow-x-auto text-[10px] leading-snug text-muted-foreground dark:text-slate-400">
                        {formatEventPayload(entry.payload)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {showWebhookViewer && (
              <div className={panelClassName}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-foreground dark:text-white">Webhook Events</h3>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedChannelId) {
                        loadWebhookLogs(selectedChannelId).catch(() => {});
                      }
                    }}
                    disabled={loading.webhooks}
                    className={secondaryButtonClassName}
                  >
                    {loading.webhooks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />} Actualizar
                  </button>
                </div>
                {loading.webhooks ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando webhooks…
                  </div>
                ) : (
                  <WebhookEventViewer
                    events={webhookLogs.map((log) => ({
                      id: log.id,
                      channelId: log.channelId,
                      eventType: log.eventType,
                      payload: log.payload,
                      processed: log.processed,
                      errorMessage: log.errorMessage,
                      createdAt: log.createdAt,
                    }))}
                    onFilterChange={(filters) => {
                      // Filter is handled client-side by the component
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">Confirmar eliminación</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              ¿Estás seguro de que deseas eliminar este canal? Esta acción no se puede deshacer.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => handleDeleteChannel(deleteConfirm)}
                disabled={loading.delete}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading.delete ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Eliminar
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={loading.delete}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
