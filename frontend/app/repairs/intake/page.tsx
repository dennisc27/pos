"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { UserCircle2, X } from "lucide-react";

import { useActiveBranch } from "@/components/providers/active-branch-provider";
import { formatCurrency } from "@/components/pos/utils";
import { formatDateForDisplay } from "@/lib/utils";
import { AddCustomerDialog } from "@/components/customer/add-customer-dialog";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

function parseCurrencyToCents(value: string): number | null {
  if (!value) {
    return 0;
  }

  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function centsToCurrency(cents: number | null | undefined) {
  return formatCurrency(Number(cents ?? 0) / 100);
}

type StatusMessage = { tone: "success" | "error"; message: string } | null;

type CreatedRepair = {
  id: number;
  jobNumber: string;
  branch: { id: number; name: string | null };
  customer: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  };
  status: string;
  approvalStatus: string;
  estimateCents: number | null;
  depositCents: number;
  totalPaidCents: number;
  balanceDueCents: number | null;
  promisedAt: string | null;
  createdAt: string | null;
};

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
];

const WALK_IN_CUSTOMER = "Walk-in customer";
const WALK_IN_DESCRIPTOR = "Default walk-in profile";

function generateJobNumberPrefix() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  return `RP-${stamp}-${random}`;
}

type CustomerSearchResult = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  lastActivityAt: string | null;
};

export default function RepairsIntakePage() {
  const { branch: activeBranch, loading: branchLoading, error: branchError } = useActiveBranch();
  const [customerName, setCustomerName] = useState(WALK_IN_CUSTOMER);
  const [customerDescriptor, setCustomerDescriptor] = useState(WALK_IN_DESCRIPTOR);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerDialogMode, setCustomerDialogMode] = useState<"change" | "add" | null>(null);
  const [customerInput, setCustomerInput] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<CustomerSearchResult[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null);
  const [jobNumber, setJobNumber] = useState(() => generateJobNumberPrefix());
  const [itemDescription, setItemDescription] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [estimate, setEstimate] = useState("");
  const [deposit, setDeposit] = useState("");
  const [depositMethod, setDepositMethod] = useState("cash");
  const [depositNote, setDepositNote] = useState("");
  const [promisedAt, setPromisedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([""]);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdRepair, setCreatedRepair] = useState<CreatedRepair | null>(null);

  const branchUnavailable = branchLoading || !activeBranch || Boolean(branchError);
  const isCustomerDialogOpen = customerDialogMode !== null;

  const sanitizedPhotos = useMemo(
    () => photos.map((value) => value.trim()).filter((value) => value.length > 0),
    [photos]
  );

  function handlePhotoChange(index: number, value: string) {
    setPhotos((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addPhotoRow() {
    setPhotos((prev) => [...prev, ""]);
  }

  function removePhotoRow(index: number) {
    setPhotos((prev) => prev.filter((_, idx) => idx !== index));
  }

  const closeCustomerDialog = useCallback(() => {
    setCustomerDialogMode(null);
    setCustomerInput("");
    setCustomerSearchResults([]);
    setCustomerSearchError(null);
    setIsSearchingCustomers(false);
    setCreatingCustomer(false);
  }, []);

  useEffect(() => {
    if (!customerDialogMode) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCustomerDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [customerDialogMode, closeCustomerDialog]);

  useEffect(() => {
    if (!customerDialogMode) {
      return;
    }

    const query = customerInput.trim();

    if (query.length < 2) {
      setCustomerSearchResults([]);
      setCustomerSearchError(null);
      setIsSearchingCustomers(false);
      return;
    }

    const controller = new AbortController();
    setIsSearchingCustomers(true);
    setCustomerSearchError(null);

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, limit: "10" });
        if (activeBranch?.id) {
          params.set("branchId", String(activeBranch.id));
        }
        const response = await fetch(`${API_BASE_URL}/api/customers?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Search failed with status ${response.status}`);
        }

        const payload: {
          customers?: Array<{
            id: number;
            firstName: string | null;
            lastName: string | null;
            email: string | null;
            phone: string | null;
            lastActivityAt?: string | null;
          }>;
        } = await response.json();

        if (controller.signal.aborted) {
          return;
        }

        const results = (payload.customers ?? []).map((customer) => {
          const first = customer.firstName?.trim() ?? "";
          const last = customer.lastName?.trim() ?? "";
          const name = `${first} ${last}`.trim() || "Unnamed customer";

          return {
            id: Number(customer.id),
            name,
            email: customer.email ?? null,
            phone: customer.phone ?? null,
            lastActivityAt: customer.lastActivityAt ?? null,
          } satisfies CustomerSearchResult;
        });

        setCustomerSearchResults(results);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Customer search failed", error);
        setCustomerSearchError("Unable to search customers. Try again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingCustomers(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeBranch?.id, customerDialogMode, customerInput]);

  const openCustomerDialog = useCallback(
    (mode: "change" | "add") => {
      setCustomerDialogMode(mode);
      setCustomerInput(mode === "change" ? customerName : "");
      setCustomerSearchResults([]);
      setCustomerSearchError(null);
      setIsSearchingCustomers(false);
    },
    [customerName]
  );

  const handleSubmitCustomer = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = customerInput.trim();
      if (!trimmed) {
        return;
      }

      if (!activeBranch?.id) {
        setCustomerSearchError("Select an active branch before adding a customer.");
        return;
      }

      setCreatingCustomer(true);
      setCustomerSearchError(null);

      try {
        const [firstName, ...rest] = trimmed.split(/\s+/);
        const lastName = rest.join(" ") || firstName;

        const response = await fetch(`${API_BASE_URL}/api/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: activeBranch.id,
            firstName,
            lastName,
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as {
          customer?: {
            id: number;
            firstName: string;
            lastName: string;
            email?: string | null;
            phone?: string | null;
          };
          id?: number;
          firstName?: string;
          lastName?: string;
          email?: string | null;
          phone?: string | null;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to create customer");
        }

        const created = payload.customer ?? payload;
        const descriptorParts = [created.email, created.phone].filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0
        );

        const fullName = `${created.firstName ?? ""} ${created.lastName ?? ""}`.trim();

        setCustomerName(fullName || trimmed);
        setCustomerDescriptor(descriptorParts.length > 0 ? descriptorParts.join(" • ") : "CRM customer");
        setSelectedCustomerId(Number(created.id));
        closeCustomerDialog();
      } catch (error) {
        console.error("Unable to create customer", error);
        setCustomerSearchError(
          error instanceof Error ? error.message : "Unable to save the customer right now."
        );
      } finally {
        setCreatingCustomer(false);
      }
    },
    [activeBranch?.id, closeCustomerDialog, customerInput]
  );

  const handleSelectCustomer = useCallback(
    (customer: CustomerSearchResult) => {
      const descriptorParts = [customer.email, customer.phone].filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      );

      setCustomerName(customer.name);
      setCustomerDescriptor(
        descriptorParts.length > 0 ? descriptorParts.join(" • ") : "CRM customer"
      );
      setSelectedCustomerId(customer.id);
      closeCustomerDialog();
    },
    [closeCustomerDialog]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus(null);
    setSubmitting(true);

    const estimateCents = parseCurrencyToCents(estimate);
    const depositCents = parseCurrencyToCents(deposit);

    if (!activeBranch) {
      setStatus({
        tone: "error",
        message: branchError ?? "Configura una sucursal activa en ajustes antes de registrar reparaciones.",
      });
      setSubmitting(false);
      return;
    }

    if (!selectedCustomerId) {
      setStatus({ tone: "error", message: "Please select a customer." });
      setSubmitting(false);
      return;
    }

    if (estimateCents === null || depositCents === null) {
      setStatus({ tone: "error", message: "Amounts must be numeric." });
      setSubmitting(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        branchId: activeBranch.id,
        customerId: selectedCustomerId,
        itemDescription: itemDescription.trim() || null,
        issueDescription: issueDescription.trim() || null,
        diagnosis: diagnosis.trim() || null,
        estimateCents,
        depositCents,
        depositMethod,
        depositNote: depositNote.trim() || null,
        notes: notes.trim() || null,
        photos: sanitizedPhotos,
      };

      if (jobNumber.trim()) {
        payload.jobNumber = jobNumber.trim();
      }

      if (promisedAt) {
        const scheduled = new Date(promisedAt);
        if (!Number.isNaN(scheduled.getTime())) {
          payload.promisedAt = scheduled.toISOString();
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/repairs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        repair?: CreatedRepair;
      };

      if (!response.ok) {
        throw new Error(body.error || "Unable to create repair");
      }

      setCreatedRepair(body.repair ?? null);
      setStatus({
        tone: "success",
        message: body.repair
          ? `Repair ${body.repair.jobNumber} was created successfully.`
          : "Repair created successfully.",
      });
      setJobNumber(generateJobNumberPrefix());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create repair";
      setStatus({ tone: "error", message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">Repairs</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          New repair intake
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Capture the item details, diagnosis, and deposit so the job enters the board with the
          correct financial baseline.
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <form className="grid grid-cols-1 gap-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Sucursal</span>
              {branchLoading ? (
                <span className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Sincronizando sucursal…
                </span>
              ) : branchError ? (
                <span className="inline-flex items-center gap-2 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500 dark:bg-rose-500/10 dark:text-rose-200">
                  {branchError}
                </span>
              ) : activeBranch ? (
                <span className="inline-flex items-center gap-2 rounded border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 dark:border-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-200">
                  {activeBranch.name}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500 dark:bg-amber-500/10 dark:text-amber-200">
                  Configura una sucursal activa en ajustes.
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span>Customer</span>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-4 py-3 shadow-sm dark:border-slate-800 dark:from-slate-950/70 dark:to-slate-950/40">
                <UserCircle2 className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                <div className="flex-1 leading-tight">
                  <p className="font-medium text-slate-900 dark:text-white">{customerName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{customerDescriptor ?? "Guest"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:text-slate-200 dark:hover:border-slate-700"
                    onClick={() => openCustomerDialog("change")}
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:text-slate-200 dark:hover:border-slate-700"
                    onClick={() => openCustomerDialog("add")}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Job number (optional)</span>
              <input
                type="text"
                maxLength={40}
                value={jobNumber}
                disabled
                readOnly
                className="rounded border border-slate-300 bg-slate-50 px-3 py-2 text-base text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-300"
                placeholder="Auto-generated if left blank"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Promised for</span>
              <input
                type="datetime-local"
                value={promisedAt}
                onChange={(event) => setPromisedAt(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Item description</span>
              <textarea
                rows={2}
                required
                value={itemDescription}
                onChange={(event) => setItemDescription(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Reported issue</span>
              <textarea
                rows={2}
                required
                value={issueDescription}
                onChange={(event) => setIssueDescription(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Preliminary diagnosis</span>
              <textarea
                rows={2}
                value={diagnosis}
                onChange={(event) => setDiagnosis(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Estimate (RD$)</span>
              <input
                type="text"
                inputMode="decimal"
                value={estimate}
                onChange={(event) => setEstimate(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="0.00"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Deposit collected (RD$)</span>
              <input
                type="text"
                inputMode="decimal"
                value={deposit}
                onChange={(event) => setDeposit(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="0.00"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Deposit method</span>
              <select
                value={depositMethod}
                onChange={(event) => setDepositMethod(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Deposit note</span>
              <input
                type="text"
                value={depositNote}
                onChange={(event) => setDepositNote(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Notes</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Photo paths</p>
            <div className="space-y-2">
              {photos.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={value}
                    onChange={(event) => handlePhotoChange(index, event.target.value)}
                    className="flex-1 rounded border border-slate-300 px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    placeholder="/uploads/repairs/123.jpg"
                  />
                  {photos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhotoRow(index)}
                      className="rounded border border-transparent px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addPhotoRow}
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Add another photo
            </button>
          </div>

          {status && (
            <div
              className={`rounded border px-4 py-3 text-sm ${
                status.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200"
              }`}
            >
              {status.message}
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={submitting || branchUnavailable}
              className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {submitting ? "Saving..." : "Create repair"}
            </button>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {branchUnavailable
                ? "Configura una sucursal activa en ajustes para habilitar el registro de reparaciones."
                : "Deposits sync to the repair ledger automatically."}
            </p>
          </div>
        </form>
      </section>

      {createdRepair && (
        <section className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900 shadow-sm dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100">
          <h2 className="text-base font-semibold">Repair created</h2>
          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Job number
              </dt>
              <dd className="font-medium">{createdRepair.jobNumber}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Approval status
              </dt>
              <dd className="font-medium">{createdRepair.approvalStatus}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Estimate
              </dt>
              <dd>{centsToCurrency(createdRepair.estimateCents)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Deposit
              </dt>
              <dd>{centsToCurrency(createdRepair.depositCents)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Balance due
              </dt>
              <dd>{centsToCurrency(createdRepair.balanceDueCents)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={`/repairs/${createdRepair.id}`}
              className="inline-flex items-center rounded border border-emerald-400 px-3 py-1.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-600 dark:text-emerald-200 dark:hover:bg-emerald-800/40"
            >
              View repair workspace
            </Link>
            <Link
              href="/repairs/board"
              className="inline-flex items-center rounded border border-emerald-400 px-3 py-1.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-600 dark:text-emerald-200 dark:hover:bg-emerald-800/40"
            >
              Go to board
            </Link>
          </div>
        </section>
      )}

      {/* Customer Dialog - Change mode (search/select) */}
      {isCustomerDialogOpen && customerDialogMode === "change" ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={closeCustomerDialog}
        >
          <div
            className="w-full max-w-xl space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Change customer</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Search CRM to link this repair.
                </p>
                {activeBranch ? (
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Branch {activeBranch.name}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeCustomerDialog}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Close customer dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Customer name
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-200"
                placeholder="Search by name, phone, or email"
                value={customerInput}
                onChange={(event) => setCustomerInput(event.target.value)}
                autoFocus
                onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setCustomerInput("");
                  }
                }}
              />
            </div>

            <div className="space-y-3">
              {customerInput.trim().length < 2 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Type at least 2 characters to search existing customers in this branch.
                </p>
              ) : null}

              {customerSearchError ? (
                <div className="rounded-xl border border-rose-400/60 bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                  {customerSearchError}
                </div>
              ) : null}

              {isSearchingCustomers ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Searching customers…</p>
              ) : null}

              {customerSearchResults.length > 0 ? (
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {customerSearchResults.map((customer) => {
                    const descriptorParts = [customer.email, customer.phone].filter(
                      (value): value is string => typeof value === "string" && value.trim().length > 0
                    );
                    const descriptor = descriptorParts.join(" • ");
                    const activityLabel = customer.lastActivityAt
                      ? `Last activity ${formatDateForDisplay(customer.lastActivityAt)}`
                      : null;
                    const isSelected = selectedCustomerId === customer.id;

                    return (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleSelectCustomer(customer)}
                        className={`flex w-full items-start justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200"
                            : "border-slate-200/70 bg-white hover:border-slate-300 hover:text-slate-900 dark:border-slate-800/80 dark:bg-slate-950/60 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900 dark:text-white">{customer.name}</p>
                          {descriptor ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{descriptor}</p>
                          ) : null}
                          {activityLabel ? (
                            <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              {activityLabel}
                            </p>
                          ) : null}
                        </div>
                        <span className="text-xs font-semibold text-sky-600 dark:text-sky-300">
                          {isSelected ? "Selected" : "Select"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : customerInput.trim().length >= 2 && !isSearchingCustomers && !customerSearchError ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No customers found. Use the button below to add a new profile.
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeCustomerDialog}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800/80 dark:text-slate-300 dark:hover:border-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Add Customer Dialog - Add mode (full form) */}
      <AddCustomerDialog
        isOpen={isCustomerDialogOpen && customerDialogMode === "add"}
        onClose={closeCustomerDialog}
        onSuccess={(customer) => {
          const descriptorParts = [customer.email, customer.phone].filter(
            (value): value is string => typeof value === "string" && value.trim().length > 0
          );
          const fullName = `${customer.firstName} ${customer.lastName}`.trim();
          setCustomerName(fullName || "Unnamed customer");
          setCustomerDescriptor(descriptorParts.length > 0 ? descriptorParts.join(" • ") : "CRM customer");
          setSelectedCustomerId(customer.id);
          closeCustomerDialog();
        }}
        onError={(error) => setCustomerSearchError(error)}
      />
    </main>
  );
}
