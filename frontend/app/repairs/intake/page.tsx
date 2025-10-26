"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

import { formatCurrency } from "@/components/pos/utils";

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
  { value: "store_credit", label: "Store credit" },
  { value: "other", label: "Other" },
];

export default function RepairsIntakePage() {
  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [estimate, setEstimate] = useState("");
  const [deposit, setDeposit] = useState("");
  const [depositMethod, setDepositMethod] = useState("cash");
  const [depositReference, setDepositReference] = useState("");
  const [depositNote, setDepositNote] = useState("");
  const [promisedAt, setPromisedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([""]);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdRepair, setCreatedRepair] = useState<CreatedRepair | null>(null);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus(null);
    setSubmitting(true);

    const numericBranchId = Number.parseInt(branchId, 10);
    const numericCustomerId = Number.parseInt(customerId, 10);
    const estimateCents = parseCurrencyToCents(estimate);
    const depositCents = parseCurrencyToCents(deposit);

    if (!Number.isInteger(numericBranchId) || numericBranchId <= 0) {
      setStatus({ tone: "error", message: "Branch ID must be a positive number." });
      setSubmitting(false);
      return;
    }

    if (!Number.isInteger(numericCustomerId) || numericCustomerId <= 0) {
      setStatus({ tone: "error", message: "Customer ID must be a positive number." });
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
        branchId: numericBranchId,
        customerId: numericCustomerId,
        itemDescription: itemDescription.trim() || null,
        issueDescription: issueDescription.trim() || null,
        diagnosis: diagnosis.trim() || null,
        estimateCents,
        depositCents,
        depositMethod,
        depositReference: depositReference.trim() || null,
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
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Branch ID</span>
              <input
                type="number"
                min={1}
                required
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Customer ID</span>
              <input
                type="number"
                min={1}
                required
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Job number (optional)</span>
              <input
                type="text"
                maxLength={40}
                value={jobNumber}
                onChange={(event) => setJobNumber(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
              <span>Deposit reference</span>
              <input
                type="text"
                value={depositReference}
                onChange={(event) => setDepositReference(event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
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
              disabled={submitting}
              className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {submitting ? "Saving..." : "Create repair"}
            </button>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Deposits sync to the repair ledger automatically.
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
    </main>
  );
}
