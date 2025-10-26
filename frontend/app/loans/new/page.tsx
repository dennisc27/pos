"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Loader2,
  PackagePlus,
  ShieldCheck,
  User,
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type InterestModel = {
  id: number;
  name: string;
  description: string | null;
  rateType: "flat" | "simple" | "compound";
  periodDays: number;
  interestRateBps: number;
  graceDays: number;
  minPrincipalCents: number | null;
  maxPrincipalCents: number | null;
  lateFeeBps: number;
};

type LoanScheduleRow = {
  dueOn: string;
  interestCents: number;
  feeCents: number;
};

type CollateralItem = {
  description: string;
  estimatedValue: string;
  photoPath: string;
};

type IdImageUpload = {
  id: string;
  fileName: string;
  contentType: string;
  assetPath: string;
  uploadUrl: string;
  expiresAt: string;
  status: "signed" | "confirmed" | "error";
  error?: string;
};

type ApiError = Error & { status?: number };

const steps = [
  {
    key: "customer",
    title: "Datos del cliente",
    description: "Selecciona sucursal, cliente y número de ticket.",
    icon: User,
  },
  {
    key: "id_capture",
    title: "Captura de cédula",
    description: "Firma URLs para subir las imágenes del documento.",
    icon: Camera,
  },
  {
    key: "collateral",
    title: "Colateral",
    description: "Detalla los artículos entregados en garantía.",
    icon: PackagePlus,
  },
  {
    key: "terms",
    title: "Términos",
    description: "Selecciona el modelo de interés y arma el calendario.",
    icon: ShieldCheck,
  },
  {
    key: "ticket_print",
    title: "Ticket",
    description: "Confirma y genera el ticket imprimible.",
    icon: FileText,
  },
] as const;

type StepKey = (typeof steps)[number]["key"];

const pesoFormatter = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
});

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    const error = new Error(data?.error ?? "Request failed") as ApiError;
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
    const error = new Error(data?.error ?? "Request failed") as ApiError;
    error.status = response.status;
    throw error;
  }

  return data;
}

const parseCurrencyToCents = (raw: string) => {
  const normalized = raw.replace(/\s+/g, "").replace(/,/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function addDays(base: string, days: number) {
  const dt = new Date(base);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function generateSchedule(
  principalCents: number,
  model: InterestModel,
  termCount: number,
  startDate: string
): LoanScheduleRow[] {
  if (!Number.isFinite(principalCents) || principalCents <= 0 || termCount <= 0) {
    return [];
  }

  const schedule: LoanScheduleRow[] = [];
  const rate = model.interestRateBps / 10000;

  for (let index = 1; index <= termCount; index += 1) {
    const dueOn = addDays(startDate, model.periodDays * index);
    const interestCents = Math.round(principalCents * rate);
    schedule.push({ dueOn, interestCents, feeCents: 0 });
  }

  return schedule;
}

export default function LoansNewPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [interestModels, setInterestModels] = useState<InterestModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState("1");
  const [customerId, setCustomerId] = useState("");
  const [ticketNumber, setTicketNumber] = useState(() => `PAWN-${Date.now()}`);
  const [comments, setComments] = useState("");

  const [idUploads, setIdUploads] = useState<IdImageUpload[]>([]);
  const [capturedIdPaths, setCapturedIdPaths] = useState<string[]>([]);
  const [idCaptureError, setIdCaptureError] = useState<string | null>(null);
  const [idCaptureBusy, setIdCaptureBusy] = useState(false);

  const [collateralItems, setCollateralItems] = useState<CollateralItem[]>([
    { description: "", estimatedValue: "", photoPath: "" },
  ]);

  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [termCount, setTermCount] = useState(1);
  const [startDate, setStartDate] = useState(todayIso());
  const [manualSchedule, setManualSchedule] = useState<LoanScheduleRow[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<null | {
    loanId: number;
    ticketNumber: string;
    printableUrl?: string;
  }>(null);

  useEffect(() => {
    let isMounted = true;
    setLoadingModels(true);
    setModelsError(null);

    getJson<{ interestModels: InterestModel[] }>("/api/interest-models")
      .then((payload) => {
        if (!isMounted) return;
        setInterestModels(payload.interestModels ?? []);
      })
      .catch((error: ApiError) => {
        if (!isMounted) return;
        setModelsError(error.message ?? "No se pudieron cargar los modelos de interés");
      })
      .finally(() => {
        if (isMounted) {
          setLoadingModels(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const model = interestModels.find((item) => item.id === Number(selectedModelId));
    const principalCents = parseCurrencyToCents(principalAmount);

    if (!model || principalCents === null || principalCents <= 0) {
      setManualSchedule([]);
      return;
    }

    setManualSchedule(generateSchedule(principalCents, model, termCount, startDate));
  }, [interestModels, selectedModelId, principalAmount, termCount, startDate]);

  const currentStep = steps[stepIndex];

  const currentModel = useMemo(
    () => interestModels.find((item) => item.id === Number(selectedModelId)) ?? null,
    [interestModels, selectedModelId]
  );

  const canProceed = useMemo(() => {
    switch (currentStep.key as StepKey) {
      case "customer": {
        const branchNumeric = Number(branchId);
        const customerNumeric = Number(customerId);
        return (
          Number.isInteger(branchNumeric) &&
          branchNumeric > 0 &&
          Number.isInteger(customerNumeric) &&
          customerNumeric > 0 &&
          ticketNumber.trim().length > 0
        );
      }
      case "id_capture":
        return capturedIdPaths.length > 0;
      case "collateral":
        return collateralItems.some((item) => item.description.trim().length > 0);
      case "terms": {
        const principalCents = parseCurrencyToCents(principalAmount);
        return Boolean(currentModel && principalCents && principalCents > 0 && manualSchedule.length > 0);
      }
      case "ticket_print":
        return true;
      default:
        return false;
    }
  }, [branchId, customerId, ticketNumber, capturedIdPaths, collateralItems, currentModel, currentStep.key, principalAmount, manualSchedule.length]);

  const goNext = () => {
    setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  };

  const goBack = () => {
    setStepIndex((index) => Math.max(index - 1, 0));
  };

  const handleSignedUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setIdCaptureBusy(true);
    setIdCaptureError(null);

    const createdUploads: IdImageUpload[] = [];

    for (const file of files) {
      try {
        const payload = await postJson<{
          upload: { url: string; expiresAt: string; headers: Record<string, string> };
          asset: { path: string };
        }>("/api/uploads/id-images/sign", {
          fileName: file.name,
          contentType: file.type,
          contentLength: file.size,
        });

        createdUploads.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          fileName: file.name,
          contentType: file.type,
          assetPath: payload.asset.path,
          uploadUrl: payload.upload.url,
          expiresAt: payload.upload.expiresAt,
          status: "signed",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo generar la URL firmada";
        setIdCaptureError(message);
        createdUploads.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          fileName: file.name,
          contentType: file.type,
          assetPath: "",
          uploadUrl: "",
          expiresAt: new Date().toISOString(),
          status: "error",
          error: message,
        });
      }
    }

    setIdUploads((previous) => [...previous, ...createdUploads]);
    setIdCaptureBusy(false);
    event.target.value = "";
  };

  const markUploadConfirmed = (upload: IdImageUpload) => {
    if (!upload.assetPath) return;

    setIdUploads((previous) =>
      previous.map((item) => (item.id === upload.id ? { ...item, status: "confirmed", error: undefined } : item))
    );
    setCapturedIdPaths((previous) => {
      if (previous.includes(upload.assetPath)) {
        return previous;
      }
      return [...previous, upload.assetPath];
    });
  };

  const removeUpload = (upload: IdImageUpload) => {
    setIdUploads((previous) => previous.filter((item) => item.id !== upload.id));
    setCapturedIdPaths((previous) => previous.filter((path) => path !== upload.assetPath));
  };

  const updateCollateralItem = (index: number, patch: Partial<CollateralItem>) => {
    setCollateralItems((previous) => previous.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const addCollateralRow = () => {
    setCollateralItems((previous) => [...previous, { description: "", estimatedValue: "", photoPath: "" }]);
  };

  const removeCollateralRow = (index: number) => {
    setCollateralItems((previous) => previous.filter((_, idx) => idx !== index));
  };

  const handleScheduleChange = (index: number, patch: Partial<LoanScheduleRow>) => {
    setManualSchedule((previous) =>
      previous.map((row, idx) => (idx === index ? { ...row, ...patch } : row))
    );
  };

  const submitLoan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const model = currentModel;
    const principalCents = parseCurrencyToCents(principalAmount);

    if (!model || !principalCents || principalCents <= 0 || manualSchedule.length === 0) {
      setSubmissionError("Completa los términos del préstamo antes de enviar.");
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);

    try {
      const payload = await postJson<{
        loan: { id: number; ticketNumber: string };
      }>("/api/loans", {
        branchId: Number(branchId),
        customerId: Number(customerId),
        ticketNumber: ticketNumber.trim(),
        interestModelId: model.id,
        principalCents,
        comments: comments.trim() || undefined,
        schedule: manualSchedule.map((row) => ({
          dueOn: row.dueOn,
          interestCents: row.interestCents,
          feeCents: row.feeCents,
        })),
        collateral: collateralItems
          .filter((item) => item.description.trim().length > 0)
          .map((item) => ({
            description: item.description.trim(),
            estimatedValueCents: parseCurrencyToCents(item.estimatedValue) ?? 0,
            photoPath: item.photoPath.trim() || null,
          })),
        idImagePaths: capturedIdPaths,
      });

      setSubmittedTicket({ loanId: payload.loan.id, ticketNumber: payload.loan.ticketNumber });
      goNext();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el préstamo";
      setSubmissionError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10 flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-500">Préstamos</span>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Nuevo préstamo / empeño</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Completa el flujo paso a paso para registrar un préstamo con captura de identificación, detalle de
          colateral y generación del ticket imprimible.
        </p>
      </header>

      <ol className="mb-10 grid gap-4 sm:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon ?? User;
          const isActive = index === stepIndex;
          const isCompleted = index < stepIndex;
          return (
            <li
              key={step.key}
              className={classNames(
                "rounded-lg border bg-white/70 p-4 text-sm shadow-sm transition",
                isActive
                  ? "border-indigo-500 ring-2 ring-indigo-200"
                  : isCompleted
                  ? "border-emerald-500 ring-1 ring-emerald-100"
                  : "border-slate-200 dark:border-slate-700"
              )}
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span
                  className={classNames(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                    isCompleted
                      ? "bg-emerald-500 text-white"
                      : isActive
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </span>
                <Icon className="h-4 w-4 text-indigo-500" />
                {step.title}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{step.description}</p>
            </li>
          );
        })}
      </ol>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-8 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
        {currentStep.key === "customer" && (
          <form className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Sucursal</label>
              <input
                value={branchId}
                onChange={(event) => setBranchId(event.target.value.replace(/[^0-9]/g, ""))}
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800"
                placeholder="ID de sucursal"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Cliente</label>
              <input
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value.replace(/[^0-9]/g, ""))}
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800"
                placeholder="ID de cliente"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Ticket</label>
              <div className="mt-1 flex gap-2">
                <input
                  value={ticketNumber}
                  onChange={(event) => setTicketNumber(event.target.value)}
                  type="text"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800"
                  placeholder="Ej. PAWN-00001"
                />
                <button
                  type="button"
                  onClick={() => setTicketNumber(`PAWN-${Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0")}`)}
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-100"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Generar
                </button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Comentarios internos</label>
              <textarea
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-800"
                placeholder="Notas internas u observaciones del cliente"
              />
            </div>
          </form>
        )}

        {currentStep.key === "id_capture" && (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Firma URLs seguras para que el documento de identidad sea cargado directamente al almacenamiento
                seguro. Confirma cada archivo una vez terminado el upload en segundo plano.
              </p>
            </div>

            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-600 dark:bg-slate-800/60">
              <label className="flex cursor-pointer flex-col items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Camera className="h-6 w-6 text-indigo-500" />
                <span className="font-medium">Seleccionar archivo(s)</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleSignedUpload}
                  disabled={idCaptureBusy}
                />
              </label>
              <p className="mt-2 text-xs text-slate-500">
                JPG, PNG, WEBP, HEIC. Máx. {(5).toFixed(0)}MB por imagen.
              </p>
            </div>

            {idCaptureError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {idCaptureError}
              </div>
            )}

            <ul className="space-y-3">
              {idUploads.map((upload) => (
                <li
                  key={upload.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{upload.fileName}</p>
                      <p className="text-xs text-slate-500">Expira {new Date(upload.expiresAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {upload.status === "confirmed" ? (
                        <BadgeCheck className="h-5 w-5 text-emerald-500" />
                      ) : upload.status === "error" ? (
                        <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">
                          Error
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          Pendiente
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeUpload(upload)}
                        className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                  {upload.assetPath && (
                    <div className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold">Ruta:</span> {upload.assetPath}
                    </div>
                  )}
                  {upload.status !== "confirmed" && upload.assetPath && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <button
                        type="button"
                        onClick={() => markUploadConfirmed(upload)}
                        className="inline-flex items-center gap-2 rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Marcar como subido
                      </button>
                      <span>
                        Confirma después de subir a la URL firmada con tus herramientas habituales. Quedará asociada al
                        cliente.
                      </span>
                    </div>
                  )}
                  {upload.error && <p className="text-xs text-rose-600">{upload.error}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {currentStep.key === "collateral" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Registra cada artículo entregado como garantía. Puedes adjuntar una ruta de foto ya cargada en el
              repositorio.
            </p>
            <div className="space-y-4">
              {collateralItems.map((item, index) => (
                <div
                  key={index}
                  className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-12"
                >
                  <div className="sm:col-span-5">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Descripción</label>
                    <input
                      value={item.description}
                      onChange={(event) => updateCollateralItem(index, { description: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                      placeholder="Ej. Cadena de oro 14k"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Valor estimado</label>
                    <input
                      value={item.estimatedValue}
                      onChange={(event) => updateCollateralItem(index, { estimatedValue: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                      placeholder="RD$"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Ruta de foto</label>
                    <input
                      value={item.photoPath}
                      onChange={(event) => updateCollateralItem(index, { photoPath: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                      placeholder="Ej. collateral/imagen-123.jpg"
                    />
                  </div>
                  <div className="sm:col-span-1 flex items-end justify-end">
                    {collateralItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCollateralRow(index)}
                        className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addCollateralRow}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-indigo-400 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
            >
              <PackagePlus className="h-4 w-4" /> Añadir artículo
            </button>
          </div>
        )}

        {currentStep.key === "terms" && (
          <div className="space-y-6">
            {loadingModels ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Cargando modelos de interés...
              </div>
            ) : modelsError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {modelsError}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {interestModels.map((model) => (
                  <label
                    key={model.id}
                    className={classNames(
                      "flex cursor-pointer flex-col gap-2 rounded-lg border p-4 shadow-sm transition",
                      Number(selectedModelId) === model.id
                        ? "border-indigo-500 ring-2 ring-indigo-200"
                        : "border-slate-200 hover:border-indigo-400"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{model.name}</p>
                        <p className="text-xs text-slate-500">{model.description ?? "Sin descripción"}</p>
                      </div>
                      <input
                        type="radio"
                        name="interestModel"
                        value={model.id}
                        checked={Number(selectedModelId) === model.id}
                        onChange={(event) => setSelectedModelId(event.target.value)}
                        className="h-4 w-4"
                      />
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      <p>Tasa por periodo: {(model.interestRateBps / 100).toFixed(2)}%</p>
                      <p>Periodo: {model.periodDays} días</p>
                      {model.minPrincipalCents ? (
                        <p>Mínimo: {pesoFormatter.format(model.minPrincipalCents / 100)}</p>
                      ) : null}
                      {model.maxPrincipalCents ? (
                        <p>Máximo: {pesoFormatter.format(model.maxPrincipalCents / 100)}</p>
                      ) : null}
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Monto prestado</label>
                <input
                  value={principalAmount}
                  onChange={(event) => setPrincipalAmount(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                  placeholder="RD$"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Cuotas</label>
                <input
                  value={termCount}
                  type="number"
                  min={1}
                  onChange={(event) => setTermCount(Math.max(1, Number(event.target.value) || 1))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Fecha inicial</label>
                <input
                  value={startDate}
                  type="date"
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] table-fixed border-collapse overflow-hidden rounded-lg border border-slate-200 text-sm shadow-sm dark:border-slate-700">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Vence</th>
                    <th className="px-4 py-2 text-left">Interés</th>
                    <th className="px-4 py-2 text-left">Cargo</th>
                  </tr>
                </thead>
                <tbody>
                  {manualSchedule.map((row, index) => (
                    <tr key={index} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{index + 1}</td>
                      <td className="px-4 py-2">
                        <input
                          value={row.dueOn}
                          onChange={(event) => handleScheduleChange(index, { dueOn: event.target.value })}
                          type="date"
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={(row.interestCents / 100).toFixed(2)}
                          onChange={(event) =>
                            handleScheduleChange(index, {
                              interestCents: Math.max(0, Math.round(Number(event.target.value) * 100 || 0)),
                            })
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={(row.feeCents / 100).toFixed(2)}
                          onChange={(event) =>
                            handleScheduleChange(index, {
                              feeCents: Math.max(0, Math.round(Number(event.target.value) * 100 || 0)),
                            })
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-900"
                        />
                      </td>
                    </tr>
                  ))}
                  {manualSchedule.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-xs text-slate-500" colSpan={4}>
                        Selecciona un modelo y completa el monto para ver el calendario sugerido.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentStep.key === "ticket_print" && submittedTicket && (
          <form className="space-y-6" onSubmit={submitLoan}>
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="mr-2 inline h-4 w-4" /> Préstamo registrado exitosamente. Ticket #{submittedTicket.ticketNumber}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Resumen del préstamo</h2>
                <dl className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between">
                    <dt>Ticket</dt>
                    <dd>{ticketNumber}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Sucursal</dt>
                    <dd>{branchId}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Cliente</dt>
                    <dd>{customerId}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Monto prestado</dt>
                    <dd>{pesoFormatter.format((parseCurrencyToCents(principalAmount) ?? 0) / 100)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Modelo</dt>
                    <dd>{currentModel?.name ?? "N/A"}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Colateral</h2>
                <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {collateralItems
                    .filter((item) => item.description.trim().length > 0)
                    .map((item, index) => (
                      <li key={index} className="flex justify-between">
                        <span>{item.description}</span>
                        <span>{item.estimatedValue || "-"}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h3 className="font-semibold text-slate-700 dark:text-slate-200">Calendario</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {manualSchedule.map((row, index) => (
                  <li key={index} className="flex justify-between">
                    <span>Cuota #{index + 1}</span>
                    <span>
                      {row.dueOn} · Interés {pesoFormatter.format(row.interestCents / 100)} · Cargo {pesoFormatter.format(
                        row.feeCents / 100
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {submissionError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
                {submissionError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <FileText className="h-4 w-4" /> Imprimir ticket
              </button>
              <button
                type="button"
                onClick={() => {
                  setStepIndex(0);
                  setCustomerId("");
                  setTicketNumber(`PAWN-${Date.now()}`);
                  setCapturedIdPaths([]);
                  setIdUploads([]);
                  setCollateralItems([{ description: "", estimatedValue: "", photoPath: "" }]);
                  setSelectedModelId("");
                  setPrincipalAmount("");
                  setTermCount(1);
                  setManualSchedule([]);
                  setSubmittedTicket(null);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-600"
              >
                Nuevo préstamo
              </button>
            </div>
          </form>
        )}

        {currentStep.key === "ticket_print" && !submittedTicket && (
          <form className="space-y-6" onSubmit={submitLoan}>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p>
                Revisa toda la información antes de emitir el ticket. Se registrarán los colaterales, calendario de
                interés y rutas de ID en la base de datos.
              </p>
            </div>

            {submissionError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
                {submissionError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Emitir ticket
            </button>
          </form>
        )}
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" /> Atrás
        </button>

        {currentStep.key !== "ticket_print" && (
          <button
            type="button"
            onClick={goNext}
            disabled={!canProceed}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </main>
  );
}

