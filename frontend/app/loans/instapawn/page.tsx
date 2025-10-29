"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bell, Copy, Loader2, QrCode, RefreshCw, Send, Users } from "lucide-react";
import { useActiveBranch } from "@/components/providers/active-branch-provider";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type ApiError = Error & { status?: number };

type InterestModel = {
  id: number;
  name: string;
  periodDays: number;
  interestRateBps: number;
};

type CollateralDraft = {
  id: string;
  description: string;
  estimatedValue: string;
};

type InstapawnNotification = {
  id: number;
  channel: "sms" | "whatsapp";
  recipient: string;
  message: string;
  status: string;
  sentAt: string | null;
  createdAt: string | null;
};

type InstapawnCollateral = {
  description: string;
  estimatedValueCents: number | null;
  photoPath?: string | null;
};

type InstapawnIntake = {
  id: number;
  branchId: number;
  customerFirstName: string;
  customerLastName: string | null;
  customerPhone: string;
  customerEmail: string | null;
  governmentId: string | null;
  itemCategory: string | null;
  itemDescription: string;
  collateral: InstapawnCollateral[];
  requestedPrincipalCents: number | null;
  autoAppraisedValueCents: number | null;
  interestModelId: number | null;
  notes: string | null;
  status: "pending" | "notified" | "converted" | "expired" | "cancelled";
  barcodeToken: string;
  barcodeExpiresAt: string;
  barcodeScannedAt: string | null;
  notifiedAt: string | null;
  convertedLoanId: number | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
  barcodeUrl: string;
  notifications?: InstapawnNotification[];
};

const pesoFormatter = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function classNames(...values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

function parseCurrencyToCents(raw: string): number | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const numeric = Number(normalized);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.round(numeric * 100);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    const error = new Error(data?.error ?? "Solicitud fallida") as ApiError;
    error.status = response.status;
    throw error;
  }

  return data;
}

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    const error = new Error(data?.error ?? "Solicitud fallida") as ApiError;
    error.status = response.status;
    throw error;
  }

  return data;
}

function statusBadgeClasses(status: InstapawnIntake["status"]) {
  switch (status) {
    case "converted":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    case "expired":
      return "bg-rose-100 text-rose-700 ring-rose-200";
    case "notified":
      return "bg-sky-100 text-sky-700 ring-sky-200";
    case "cancelled":
      return "bg-slate-200 text-slate-700 ring-slate-300";
    default:
      return "bg-amber-100 text-amber-700 ring-amber-200";
  }
}

function statusLabel(status: InstapawnIntake["status"]) {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "notified":
      return "Notificado";
    case "converted":
      return "Convertido";
    case "expired":
      return "Expirado";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

function makeCollateralDraft(): CollateralDraft {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `item-${Date.now()}-${Math.random()}`;
  return { id, description: "", estimatedValue: "" };
}

export default function LoansInstaPawnPage() {
  const { branch: activeBranch, loading: branchLoading, error: branchError } = useActiveBranch();
  const [interestModels, setInterestModels] = useState<InterestModel[]>([]);
  const [collateralItems, setCollateralItems] = useState<CollateralDraft[]>([makeCollateralDraft()]);
  const [form, setForm] = useState({
    branchId: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    governmentId: "",
    itemCategory: "",
    itemDescription: "",
    estimatedValue: "",
    offerCents: "",
    interestModelId: "",
    notes: "",
    expiresInHours: "72",
  });
  const [intakes, setIntakes] = useState<InstapawnIntake[]>([]);
  const [createdIntake, setCreatedIntake] = useState<InstapawnIntake | null>(null);
  const [selectedIntakeId, setSelectedIntakeId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [offerTouched, setOfferTouched] = useState(false);

  useEffect(() => {
    setForm((previous) => ({
      ...previous,
      branchId: activeBranch ? String(activeBranch.id) : "",
    }));
  }, [activeBranch]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const data = await getJson<{ interestModels: InterestModel[] }>("/api/interest-models");
        setInterestModels(data.interestModels);
      } catch (error) {
        console.error(error);
      }
    };

    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadIntakes = async () => {
    setIsLoading(true);
    try {
      const data = await getJson<{ intakes: InstapawnIntake[] }>("/api/instapawn");
      setIntakes(data.intakes);
      setCreatedIntake((previous) => {
        if (!previous) {
          return previous;
        }

        const updated = data.intakes.find((item) => item.id === previous.id);
        return updated ?? previous;
      });
      setSelectedIntakeId((previous) => {
        if (previous == null) {
          return previous;
        }

        const exists = data.intakes.some((item) => item.id === previous);
        return exists ? previous : data.intakes.length > 0 ? data.intakes[0].id : null;
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIntakes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!flashMessage) {
      return;
    }

    const timeout = setTimeout(() => setFlashMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [flashMessage]);

  const estimatedValueCents = useMemo(() => parseCurrencyToCents(form.estimatedValue) ?? 0, [form.estimatedValue]);
  const suggestedOfferCents = useMemo(() => {
    if (estimatedValueCents <= 0) {
      return null;
    }

    return Math.round(estimatedValueCents * 0.65);
  }, [estimatedValueCents]);

  const selectedIntake = useMemo(() => {
    if (selectedIntakeId == null) {
      return createdIntake;
    }

    return intakes.find((item) => item.id === selectedIntakeId) ?? (createdIntake && createdIntake.id === selectedIntakeId ? createdIntake : null);
  }, [createdIntake, intakes, selectedIntakeId]);

  const handleCollateralChange = (id: string, field: keyof Omit<CollateralDraft, "id">, value: string) => {
    setCollateralItems((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleAddCollateral = () => {
    setCollateralItems((items) => [...items, makeCollateralDraft()]);
  };

  const handleRemoveCollateral = (id: string) => {
    setCollateralItems((items) => (items.length === 1 ? items : items.filter((item) => item.id !== id)));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFlashMessage(null);
    setIsSubmitting(true);

    try {
      if (!activeBranch) {
        throw new Error(branchError ?? "Configura una sucursal activa en ajustes antes de registrar solicitudes.");
      }

      const payload = {
        branchId: activeBranch.id,
        customerFirstName: form.firstName.trim(),
        customerLastName: form.lastName.trim() || null,
        customerPhone: form.phone.trim(),
        customerEmail: form.email.trim() || null,
        governmentId: form.governmentId.trim() || null,
        itemCategory: form.itemCategory.trim() || null,
        itemDescription: form.itemDescription.trim(),
        requestedPrincipalCents: parseCurrencyToCents(form.offerCents),
        autoAppraisedValueCents: parseCurrencyToCents(form.estimatedValue),
        interestModelId: form.interestModelId ? Number(form.interestModelId) : null,
        notes: form.notes.trim() || null,
        expiresInHours: form.expiresInHours ? Number(form.expiresInHours) : null,
        collateral: collateralItems
          .filter((item) => item.description.trim())
          .map((item) => ({
            description: item.description.trim(),
            estimatedValueCents: parseCurrencyToCents(item.estimatedValue),
          })),
      };

      if (!payload.customerFirstName) {
        throw new Error("El nombre del cliente es obligatorio.");
      }

      if (!payload.customerPhone) {
        throw new Error("El número de contacto es obligatorio.");
      }

      if (!payload.itemDescription) {
        throw new Error("Describe el artículo para poder evaluar la solicitud.");
      }

      const response = await postJson<{ intake: InstapawnIntake; notifications: InstapawnNotification[] }>(
        "/api/instapawn",
        payload
      );

      const intakeWithNotifications: InstapawnIntake = {
        ...response.intake,
        notifications: response.notifications,
      };

      setCreatedIntake(intakeWithNotifications);
      setSelectedIntakeId(intakeWithNotifications.id);
      setFlashMessage("Solicitud InstaPawn creada y clientes notificados.");
      setOfferTouched(false);

      await loadIntakes();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar la solicitud.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setFlashMessage("Token copiado al portapapeles");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const applySuggestedOffer = () => {
    if (suggestedOfferCents != null) {
      setForm((previous) => ({
        ...previous,
        offerCents: (suggestedOfferCents / 100).toFixed(2),
      }));
      setOfferTouched(true);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10">
        <p className="text-sm uppercase tracking-wide text-slate-500">Préstamos</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">InstaPawn</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Registra solicitudes remotas, genera códigos de barras temporales y avisa al cliente para que
              complete el préstamo en sucursal.
            </p>
          </div>
          <button
            type="button"
            onClick={loadIntakes}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={classNames("h-4 w-4", isLoading && "animate-spin")} />
            Actualizar lista
          </button>
        </div>
        {branchLoading ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            Sincronizando sucursal activa…
          </div>
        ) : !activeBranch ? (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-200">
            Configura una sucursal predeterminada en Ajustes → Sistema antes de registrar InstaPawn.
          </div>
        ) : branchError ? (
          <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-200">
            {branchError}
          </div>
        ) : null}
        {flashMessage ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {flashMessage}
          </div>
        ) : null}
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <QrCode className="h-6 w-6 text-slate-500" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Nueva solicitud</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Captura la información básica para evaluar la oferta y enviar el token al cliente.
              </p>
            </div>
          </div>

          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Sucursal</span>
                {branchLoading ? (
                  <span className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sincronizando…
                  </span>
                ) : branchError ? (
                  <span className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">{branchError}</span>
                ) : activeBranch ? (
                  <span className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
                    {activeBranch.name}
                  </span>
                ) : (
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Configura una sucursal activa en ajustes
                  </span>
                )}
              </div>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Modelo de interés</span>
                <select
                  value={form.interestModelId}
                  onChange={(event) => setForm((previous) => ({ ...previous, interestModelId: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">Seleccionar</option>
                  {interestModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} · {model.periodDays} días · {(model.interestRateBps / 100).toFixed(2)}%
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Nombre</span>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(event) => setForm((previous) => ({ ...previous, firstName: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="María"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Apellidos</span>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(event) => setForm((previous) => ({ ...previous, lastName: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="González"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm sm:col-span-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">Teléfono</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="8095551234"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Cédula</span>
                <input
                  type="text"
                  value={form.governmentId}
                  onChange={(event) => setForm((previous) => ({ ...previous, governmentId: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="00112345678"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Correo electrónico</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="cliente@email.com"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Categoría</span>
                <input
                  type="text"
                  value={form.itemCategory}
                  onChange={(event) => setForm((previous) => ({ ...previous, itemCategory: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="Electrónica, joyería, ..."
                />
              </label>
            </div>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Descripción del artículo</span>
              <textarea
                value={form.itemDescription}
                onChange={(event) => setForm((previous) => ({ ...previous, itemDescription: event.target.value }))}
                rows={3}
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="MacBook Pro 2021, 16GB RAM, leve rayón en la tapa"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm md:col-span-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">Valor estimado</span>
                <input
                  type="text"
                  value={form.estimatedValue}
                  onChange={(event) => setForm((previous) => ({ ...previous, estimatedValue: event.target.value }))}
                  placeholder="15000"
                  className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Oferta (monto a prestar)</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.offerCents}
                    onChange={(event) => {
                      setOfferTouched(true);
                      setForm((previous) => ({ ...previous, offerCents: event.target.value }));
                    }}
                    placeholder="9000"
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={applySuggestedOffer}
                    disabled={suggestedOfferCents == null}
                    className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Sugerir
                  </button>
                </div>
                {suggestedOfferCents != null ? (
                  <p className="text-xs text-slate-500">
                    Recomendado: {pesoFormatter.format(suggestedOfferCents / 100)} ({" "}
                    <span className="font-medium">65%</span> del valor estimado)
                  </p>
                ) : null}
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Colateral</span>
                <button
                  type="button"
                  onClick={handleAddCollateral}
                  className="text-sm font-medium text-sky-600 hover:text-sky-700"
                >
                  Añadir artículo
                </button>
              </div>

              <div className="space-y-3">
                {collateralItems.map((item, index) => (
                  <div key={item.id} className="grid gap-3 sm:grid-cols-[3fr_2fr_auto]">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(event) => handleCollateralChange(item.id, "description", event.target.value)}
                      placeholder={`Artículo #${index + 1}`}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      value={item.estimatedValue}
                      onChange={(event) => handleCollateralChange(item.id, "estimatedValue", event.target.value)}
                      placeholder="Valor estimado"
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCollateral(item.id)}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      disabled={collateralItems.length === 1}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Vigencia (horas)</span>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={form.expiresInHours}
                  onChange={(event) => setForm((previous) => ({ ...previous, expiresInHours: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Notas internas</span>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
                  placeholder="Comentarios, restricciones, ..."
                  className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            </div>

            {formError ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {formError}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Las notificaciones se envían por SMS y WhatsApp con el código generado.
              </p>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Generar token
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-6">
          {createdIntake ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm dark:border-emerald-800/40 dark:bg-emerald-950/40">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">Código generado</h3>
                  <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-200/80">
                    Comparte el token con el cliente y reserva la mercancía cuando llegue a la sucursal.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(createdIntake.barcodeToken)}
                  className="inline-flex items-center gap-2 rounded-md border border-emerald-500 px-3 py-1 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-600 dark:text-emerald-100 dark:hover:bg-emerald-800/40"
                >
                  <Copy className="h-4 w-4" /> Copiar
                </button>
              </div>

              <div className="mt-4 space-y-2 rounded-lg border border-emerald-300 bg-white/80 p-4 text-emerald-900 shadow-inner dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-100">
                <div className="flex items-center gap-3 text-lg font-semibold">
                  <QrCode className="h-5 w-5" />
                  {createdIntake.barcodeToken}
                </div>
                <p className="text-sm">
                  Expira el {dateTimeFormatter.format(new Date(createdIntake.barcodeExpiresAt))}
                </p>
                <a
                  href={createdIntake.barcodeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 underline decoration-dotted hover:decoration-solid dark:text-emerald-200"
                >
                  Abrir enlace para escanear
                </a>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-emerald-900/80 dark:text-emerald-200/80">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {createdIntake.customerFirstName} {createdIntake.customerLastName ?? ""} · {createdIntake.customerPhone}
                </div>
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  {createdIntake.notifications?.length ?? 0} notificaciones enviadas
                </div>
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  {pesoFormatter.format((createdIntake.requestedPrincipalCents ?? 0) / 100)} ofrecidos
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
              Genera una solicitud para ver aquí el código de barras y el seguimiento de mensajes.
            </div>
          )}

          {selectedIntake ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Detalle de solicitud</h3>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    #{selectedIntake.id.toString().padStart(4, "0")}
                  </p>
                </div>
                <span
                  className={classNames(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1",
                    statusBadgeClasses(selectedIntake.status)
                  )}
                >
                  {statusLabel(selectedIntake.status)}
                </span>
              </div>

              <dl className="mt-6 grid gap-4 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
                <div>
                  <dt className="font-medium">Cliente</dt>
                  <dd>
                    {selectedIntake.customerFirstName} {selectedIntake.customerLastName ?? ""}
                    <br />
                    <span className="text-xs text-slate-500">{selectedIntake.customerPhone}</span>
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Vigencia</dt>
                  <dd>{dateTimeFormatter.format(new Date(selectedIntake.barcodeExpiresAt))}</dd>
                </div>
                <div>
                  <dt className="font-medium">Oferta sugerida</dt>
                  <dd>{pesoFormatter.format((selectedIntake.requestedPrincipalCents ?? 0) / 100)}</dd>
                </div>
                <div>
                  <dt className="font-medium">Modelo</dt>
                  <dd>{selectedIntake.interestModelId ?? "—"}</dd>
                </div>
              </dl>

              <div className="mt-6">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Colateral</h4>
                <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {selectedIntake.collateral.map((item, index) => (
                    <li key={`${item.description}-${index}`} className="rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{item.description}</div>
                      <div className="text-xs text-slate-500">
                        Valor: {item.estimatedValueCents != null ? pesoFormatter.format(item.estimatedValueCents / 100) : "—"}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Notificaciones</h4>
                <div className="mt-2 space-y-2">
                  {selectedIntake.notifications && selectedIntake.notifications.length > 0 ? (
                    selectedIntake.notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium uppercase text-slate-500">{notification.channel}</span>
                          <span>{notification.status}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-slate-600 dark:text-slate-300">{notification.message}</p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {notification.sentAt
                            ? `Enviado ${dateTimeFormatter.format(new Date(notification.sentAt))}`
                            : notification.createdAt
                            ? `Pendiente desde ${dateTimeFormatter.format(new Date(notification.createdAt))}`
                            : "Pendiente"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      Aún no se han enviado mensajes asociados a esta solicitud.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="mt-12 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Solicitudes recientes</h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">{intakes.length} registros</span>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Cliente</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Token</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Estado</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Expira</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Oferta</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Mensajes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-sm dark:divide-slate-800 dark:bg-slate-950">
              {intakes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No hay solicitudes registradas.
                  </td>
                </tr>
              ) : (
                intakes.map((intake) => (
                  <tr
                    key={intake.id}
                    onClick={() => setSelectedIntakeId(intake.id)}
                    className={classNames(
                      "cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-900/60",
                      selectedIntakeId === intake.id && "bg-slate-100/80 dark:bg-slate-900/70"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {intake.customerFirstName} {intake.customerLastName ?? ""}
                      </div>
                      <div className="text-xs text-slate-500">{intake.customerPhone}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{intake.barcodeToken}</td>
                    <td className="px-4 py-3">
                      <span
                        className={classNames(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                          statusBadgeClasses(intake.status)
                        )}
                      >
                        {statusLabel(intake.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {dateTimeFormatter.format(new Date(intake.barcodeExpiresAt))}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {pesoFormatter.format((intake.requestedPrincipalCents ?? 0) / 100)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {intake.notifications?.length ?? 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
