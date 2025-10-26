"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Save,
  Settings2,
  Store,
  Ticket,
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type StatusMessage = { tone: "success" | "error"; message: string } | null;

type MaskedSettingEntry<T> = {
  key: string;
  value: T | null;
  masked: boolean;
};

type SettingsResponse<T> = {
  scope: "global" | "branch" | "user";
  branchId: number | null;
  userId: number | null;
  entries: MaskedSettingEntry<T>[];
  fallback?: MaskedSettingEntry<T>[] | null;
};

type TenderConfig = {
  code: string;
  label: string;
  enabled: boolean;
};

type DrawerConfig = {
  maxOverShortCents: number;
  requirePin: boolean;
  allowBlindOpen: boolean;
};

type ReceiptConfig = {
  header: string;
  footer: string;
  showLogo: boolean;
};

type ProviderForm = {
  values: Record<string, string>;
  masked: boolean;
};

type ProviderKey = "sms" | "whatsapp" | "email";

const providerKeys: Record<ProviderKey, string> = {
  sms: "notifications.sms",
  whatsapp: "notifications.whatsapp",
  email: "notifications.email",
};

type ScopeParams =
  | { scope: "global"; branchId: null; userId: null }
  | { scope: "branch"; branchId: number | null; userId: null }
  | { scope: "user"; branchId: number | null; userId: number | null };

const defaultTenders: TenderConfig[] = [
  { code: "CASH", label: "Efectivo", enabled: true },
  { code: "CARD", label: "Tarjeta", enabled: true },
];

const defaultDrawer: DrawerConfig = {
  maxOverShortCents: 500,
  requirePin: true,
  allowBlindOpen: false,
};

const defaultReceipt: ReceiptConfig = {
  header: "Pawn Command",
  footer: "¡Gracias por su visita!",
  showLogo: true,
};

const providerFieldLabels: Record<ProviderKey, Record<string, string>> = {
  sms: { apiKey: "API key", apiSecret: "API secret" },
  whatsapp: { accountSid: "Account SID", authToken: "Auth token" },
  email: { smtpHost: "SMTP host", smtpUser: "SMTP user", smtpPassword: "SMTP password" },
};

export default function SettingsSystemPage() {
  const [activeScope, setActiveScope] = useState<"global" | "branch" | "user">("global");
  const [branchId, setBranchId] = useState("1");
  const [userId, setUserId] = useState("1");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [tenders, setTenders] = useState<TenderConfig[]>(defaultTenders);
  const [drawerConfig, setDrawerConfig] = useState<DrawerConfig>(defaultDrawer);
  const [receiptConfig, setReceiptConfig] = useState<ReceiptConfig>(defaultReceipt);
  const [providers, setProviders] = useState<Record<ProviderKey, ProviderForm>>({
    sms: { values: { apiKey: "", apiSecret: "" }, masked: false },
    whatsapp: { values: { accountSid: "", authToken: "" }, masked: false },
    email: { values: { smtpHost: "", smtpUser: "", smtpPassword: "" }, masked: false },
  });

  const scopeParams = useMemo<ScopeParams>(() => {
    const parsedBranchId = Number.parseInt(branchId, 10);
    const normalizedBranchId = Number.isFinite(parsedBranchId) && parsedBranchId > 0 ? parsedBranchId : null;
    const parsedUserId = Number.parseInt(userId, 10);
    const normalizedUserId = Number.isFinite(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;

    if (activeScope === "global") {
      return { scope: "global", branchId: null, userId: null };
    }

    if (activeScope === "branch") {
      return { scope: "branch", branchId: normalizedBranchId, userId: null };
    }

    return { scope: "user", branchId: normalizedBranchId, userId: normalizedUserId };
  }, [activeScope, branchId, userId]);

  const scopeValidationError = useMemo(() => {
    if (scopeParams.scope === "branch" || scopeParams.scope === "user") {
      if (scopeParams.branchId == null) {
        return "Debes ingresar una sucursal válida";
      }
    }

    if (scopeParams.scope === "user" && scopeParams.userId == null) {
      return "Debes ingresar un usuario válido";
    }

    return null;
  }, [scopeParams]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      if (scopeValidationError) {
        throw new Error(scopeValidationError);
      }

      const params = new URLSearchParams();
      params.set("scope", scopeParams.scope);
      if (scopeParams.branchId != null) {
        params.set("branchId", String(scopeParams.branchId));
      }
      if (scopeParams.userId != null) {
        params.set("userId", String(scopeParams.userId));
      }

      const response = await fetch(`${API_BASE_URL}/api/settings?${params.toString()}`);
      const data = (await response.json()) as SettingsResponse<unknown>;
      if (!response.ok) {
        throw new Error((data as { error?: string })?.error ?? "No se pudieron obtener las configuraciones");
      }

      const entries = data.entries ?? [];
      applyEntries(entries);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al cargar configuración";
      setStatus({ tone: "error", message });

      if (message !== scopeValidationError) {
        setTenders(defaultTenders);
        setDrawerConfig(defaultDrawer);
        setReceiptConfig(defaultReceipt);
        setProviders({
          sms: { values: { apiKey: "", apiSecret: "" }, masked: false },
          whatsapp: { values: { accountSid: "", authToken: "" }, masked: false },
          email: { values: { smtpHost: "", smtpUser: "", smtpPassword: "" }, masked: false },
        });
      }
    } finally {
      setLoading(false);
    }
  }, [scopeParams, scopeValidationError]);

  useEffect(() => {
    fetchSettings().catch(() => undefined);
  }, [fetchSettings]);

  const applyEntries = (entries: MaskedSettingEntry<unknown>[]) => {
    entries.forEach((entry) => {
      if (entry.key === "pos.tenders" && Array.isArray(entry.value)) {
        setTenders(
          entry.value.map((raw) => ({
            code: typeof raw.code === "string" ? raw.code : "",
            label: typeof raw.label === "string" ? raw.label : "",
            enabled: Boolean((raw as { enabled?: boolean }).enabled),
          }))
        );
      } else if (entry.key === "pos.drawer" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<DrawerConfig>;
        setDrawerConfig({
          maxOverShortCents: Number(raw.maxOverShortCents ?? defaultDrawer.maxOverShortCents),
          requirePin: Boolean(raw.requirePin ?? defaultDrawer.requirePin),
          allowBlindOpen: Boolean(raw.allowBlindOpen ?? defaultDrawer.allowBlindOpen),
        });
      } else if (entry.key === "pos.receipt" && entry.value && typeof entry.value === "object") {
        const raw = entry.value as Partial<ReceiptConfig>;
        setReceiptConfig({
          header: typeof raw.header === "string" ? raw.header : defaultReceipt.header,
          footer: typeof raw.footer === "string" ? raw.footer : defaultReceipt.footer,
          showLogo: Boolean(raw.showLogo ?? defaultReceipt.showLogo),
        });
      } else {
        const providerEntry = (Object.entries(providerKeys) as [ProviderKey, string][])
          .find(([, key]) => key === entry.key);
        if (providerEntry) {
          const [provider] = providerEntry;
          if (entry.masked) {
            setProviders((state) => ({
              ...state,
              [provider]: {
                values: Object.fromEntries(Object.keys(providerFieldLabels[provider]).map((field) => [field, ""])) as Record<string, string>,
                masked: true,
              },
            }));
          } else if (entry.value && typeof entry.value === "object") {
            const raw = entry.value as Record<string, unknown>;
            setProviders((state) => ({
              ...state,
              [provider]: {
                values: Object.fromEntries(
                  Object.keys(providerFieldLabels[provider]).map((field) => [field, typeof raw[field] === "string" ? (raw[field] as string) : ""])
                ) as Record<string, string>,
                masked: false,
              },
            }));
          }
        }
      }
    });
  };

  const updateTender = (index: number, partial: Partial<TenderConfig>) => {
    setTenders((current) =>
      current.map((tender, idx) => (idx === index ? { ...tender, ...partial } : tender))
    );
  };

  const addTender = () => {
    setTenders((current) => [...current, { code: "", label: "", enabled: true }]);
  };

  const removeTender = (index: number) => {
    setTenders((current) => current.filter((_, idx) => idx !== index));
  };

  const updateProviderField = (provider: ProviderKey, field: string, value: string) => {
    setProviders((state) => ({
      ...state,
      [provider]: {
        values: { ...state[provider].values, [field]: value },
        masked: false,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const entries = [
        { key: "pos.tenders", value: tenders },
        { key: "pos.drawer", value: drawerConfig },
        { key: "pos.receipt", value: receiptConfig },
      ];

      (Object.keys(providerKeys) as ProviderKey[]).forEach((provider) => {
        const form = providers[provider];
        const hasContent = Object.values(form.values).some((value) => value.trim() !== "");
        if (hasContent) {
          entries.push({ key: providerKeys[provider], value: form.values });
        }
      });

      if (scopeValidationError) {
        throw new Error(scopeValidationError);
      }

      const payload: Record<string, unknown> = {
        scope: scopeParams.scope,
        entries,
      };
      if (scopeParams.branchId != null) {
        payload.branchId = scopeParams.branchId;
      }
      if (scopeParams.userId != null) {
        payload.userId = scopeParams.userId;
      }

      const response = await fetch(`${API_BASE_URL}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "No se pudo guardar la configuración");
      }

      setStatus({ tone: "success", message: "Configuración guardada correctamente" });
      applyEntries(data.entries ?? []);
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  const handleProviderTest = async (provider: ProviderKey) => {
    const form = providers[provider];
    const requiredFields = Object.keys(providerFieldLabels[provider]);
    const missing = requiredFields.filter((field) => !form.values[field]?.trim());

    if (scopeValidationError) {
      setStatus({ tone: "error", message: scopeValidationError });
      return;
    }

    if (!form.masked && missing.length > 0) {
      setStatus({ tone: "error", message: "Faltan campos requeridos para la prueba" });
      return;
    }

    setStatus(null);

    setSaving(true);
    try {
      const body: Record<string, unknown> = { provider };

      body.scope = scopeParams.scope;

      if (scopeParams.branchId != null) {
        body.branchId = scopeParams.branchId;
      }

      if (scopeParams.userId != null) {
        body.userId = scopeParams.userId;
      }

      if (form.masked && missing.length > 0) {
        body.useStored = true;
      } else {
        body.credentials = form.values;
      }

      const response = await fetch(`${API_BASE_URL}/api/settings/providers/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Prueba fallida");
      }
      setStatus({
        tone: "success",
        message:
          data?.mode === "stored"
            ? `Proveedor ${provider} validado con las credenciales guardadas`
            : `Proveedor ${provider} validado correctamente`,
      });
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Error al probar proveedor" });
    } finally {
      setSaving(false);
    }
  };

  const renderScopeControls = () => {
    if (activeScope === "global") {
      return null;
    }

    return (
      <div className="flex flex-col gap-2 text-sm text-foreground">
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Branch ID</span>
            <input
              className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value.replace(/[^0-9]/g, ""))}
            />
          </label>
          {activeScope === "user" && (
            <label className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">User ID</span>
              <input
                className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={userId}
                onChange={(event) => setUserId(event.target.value.replace(/[^0-9]/g, ""))}
              />
            </label>
          )}
        </div>
        {scopeValidationError && (
          <p className="text-xs text-destructive">{scopeValidationError}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <Settings2 className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Configuración</span>
        </div>
        <h1 className="text-3xl font-semibold text-foreground">Parámetros del sistema</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Ajusta la configuración POS y las credenciales de notificaciones por alcance (global, sucursal, usuario).
        </p>
      </header>

      {status && (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            status.tone === "success"
              ? "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-rose-500/40 bg-rose-50 text-rose-700 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200"
          }`}
        >
          {status.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}
          <span>{status.message}</span>
        </div>
      )}

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex gap-2">
            {([
              { id: "global", label: "Global" },
              { id: "branch", label: "Sucursal" },
              { id: "user", label: "Usuario" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveScope(tab.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  activeScope === tab.id
                    ? "bg-primary text-primary-foreground shadow"
                    : "border border-border bg-muted text-foreground hover:bg-muted/80"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {renderScopeControls()}
          <button
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-muted"
            onClick={() => fetchSettings()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Recargar
          </button>
        </div>

        <div className="mt-4 space-y-8">
          <section className="rounded-md border border-border bg-muted/40 p-4">
            <header className="mb-3 flex items-center gap-2 text-primary">
              <Store className="h-4 w-4" />
              <h2 className="text-sm font-semibold uppercase tracking-wide">Configuración POS</h2>
            </header>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Medios de pago</h3>
                <p className="text-xs text-muted-foreground">Define los tender disponibles y si están activos.</p>
                <div className="mt-3 space-y-2">
                  {tenders.map((tender, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2 shadow-sm">
                      <input
                        className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Código"
                        value={tender.code}
                        onChange={(event) => updateTender(index, { code: event.target.value })}
                      />
                      <input
                        className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Etiqueta"
                        value={tender.label}
                        onChange={(event) => updateTender(index, { label: event.target.value })}
                      />
                      <label className="flex items-center gap-1 text-xs text-foreground">
                        <input
                          type="checkbox"
                          checked={tender.enabled}
                          onChange={(event) => updateTender(index, { enabled: event.target.checked })}
                          className="h-4 w-4 rounded border border-border bg-background"
                        />
                        Habilitado
                      </label>
                      <button
                        type="button"
                        className="text-xs text-rose-300 hover:text-rose-200"
                        onClick={() => removeTender(index)}
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-muted"
                    onClick={addTender}
                  >
                    Añadir tender
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="drawer-threshold">
                    Variación máxima (centavos)
                  </label>
                  <input
                    id="drawer-threshold"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={drawerConfig.maxOverShortCents}
                    onChange={(event) =>
                      setDrawerConfig((state) => ({
                        ...state,
                        maxOverShortCents: Number(event.target.value.replace(/[^0-9]/g, "")) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Seguridad</label>
                  <div className="flex gap-3 text-xs text-foreground">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={drawerConfig.requirePin}
                        onChange={(event) =>
                          setDrawerConfig((state) => ({ ...state, requirePin: event.target.checked }))
                        }
                        className="h-4 w-4 rounded border border-border bg-background"
                      />
                      Requiere PIN
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={drawerConfig.allowBlindOpen}
                        onChange={(event) =>
                          setDrawerConfig((state) => ({ ...state, allowBlindOpen: event.target.checked }))
                        }
                        className="h-4 w-4 rounded border border-border bg-background"
                      />
                      Permitir apertura sin venta
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="receipt-header">
                    Encabezado de recibo
                  </label>
                  <textarea
                    id="receipt-header"
                    className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={receiptConfig.header}
                    onChange={(event) => setReceiptConfig((state) => ({ ...state, header: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="receipt-footer">
                    Pie de recibo
                  </label>
                  <textarea
                    id="receipt-footer"
                    className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={receiptConfig.footer}
                    onChange={(event) => setReceiptConfig((state) => ({ ...state, footer: event.target.value }))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={receiptConfig.showLogo}
                  onChange={(event) => setReceiptConfig((state) => ({ ...state, showLogo: event.target.checked }))}
                  className="h-4 w-4 rounded border border-border bg-background"
                />
                Mostrar logo en recibo
              </label>
            </div>
          </section>

          <section className="rounded-md border border-border bg-muted/40 p-4">
            <header className="mb-3 flex items-center gap-2 text-primary">
              <Bell className="h-4 w-4" />
              <h2 className="text-sm font-semibold uppercase tracking-wide">Notificaciones</h2>
            </header>

            <div className="grid gap-4 md:grid-cols-3">
              {(Object.keys(providerKeys) as ProviderKey[]).map((provider) => {
                const fields = providerFieldLabels[provider];
                const form = providers[provider];
                return (
                  <div key={provider} className="space-y-3 rounded-md border border-border bg-background p-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold uppercase">{provider}</span>
                      {form.masked && <span className="text-muted-foreground">Valor oculto</span>}
                    </div>
                    {Object.entries(fields).map(([field, label]) => (
                      <div key={field} className="space-y-1">
                        <label className="text-[11px] text-muted-foreground" htmlFor={`${provider}-${field}`}>
                          {label}
                        </label>
                        <input
                          id={`${provider}-${field}`}
                          className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={form.values[field] ?? ""}
                          onChange={(event) => updateProviderField(provider, field, event.target.value)}
                          type={field.toLowerCase().includes("password") || field.toLowerCase().includes("secret") ? "password" : "text"}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground transition hover:bg-muted"
                      onClick={() => handleProviderTest(provider)}
                    >
                      Probar proveedor
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-muted"
            onClick={() => fetchSettings()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Deshacer cambios
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar configuración
          </button>
        </div>
      </section>
    </div>
  );
}
