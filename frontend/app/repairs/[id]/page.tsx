"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { formatCurrency } from "@/components/pos/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

function centsToCurrency(cents: number | null | undefined) {
  return formatCurrency(Number(cents ?? 0) / 100);
}

function parseCurrencyToCents(value: string): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "--";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

type RepairDetail = {
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
  itemDescription: string | null;
  issueDescription: string | null;
  diagnosis: string | null;
  status: string;
  approvalStatus: string;
  approvalRequestedAt: string | null;
  approvalDecisionAt: string | null;
  estimateCents: number | null;
  depositCents: number;
  totalPaidCents: number;
  balanceDueCents: number | null;
  promisedAt: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  photos: Array<{ id: number; storagePath: string; createdAt: string | null }>;
  payments: Array<{
    id: number;
    amountCents: number;
    method: string;
    reference: string | null;
    note: string | null;
    createdAt: string | null;
  }>;
  materials: Array<{
    id: number;
    productCodeVersionId: number;
    productCodeId: number | null;
    code: string | null;
    name: string | null;
    qtyIssued: number;
    qtyReturned: number;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
};

type StatusMessage = { tone: "success" | "error"; message: string } | null;

type WarrantyResponse = { warrantyDocumentUrl: string };

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "transfer", label: "Bank transfer" },
  { value: "store_credit", label: "Store credit" },
  { value: "other", label: "Other" },
];

export default function RepairDetailPage() {
  const params = useParams<{ id: string }>();
  const repairId = Number(params?.id ?? "");
  const [repair, setRepair] = useState<RepairDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDeposit, setPaymentDeposit] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [notificationChannel, setNotificationChannel] = useState("sms");
  const [notificationRecipient, setNotificationRecipient] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("Tu reparación está lista para recoger.");
  const [warrantyLink, setWarrantyLink] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(repairId) || repairId <= 0) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setStatus(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/repairs/${repairId}`);
        const body = (await response.json().catch(() => ({}))) as { repair?: RepairDetail; error?: string };
        if (!response.ok) {
          throw new Error(body.error || "Unable to load repair");
        }
        if (!body.repair) {
          throw new Error("Repair not found");
        }
        setRepair(body.repair);
        setNotificationRecipient(body.repair.customer.phone ?? "");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load repair";
        setStatus({ tone: "error", message });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [repairId, refreshKey]);

  const customerName = useMemo(() => {
    if (!repair) return "";
    const parts = [repair.customer.firstName, repair.customer.lastName].filter(Boolean);
    return parts.join(" ") || `Customer #${repair.customer.id}`;
  }, [repair]);

  async function refresh() {
    setRefreshKey((key) => key + 1);
  }

  async function handlePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!repair) return;

    const cents = parseCurrencyToCents(paymentAmount);
    if (cents === null) {
      setStatus({ tone: "error", message: "Enter a payment amount in RD$." });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/repairs/${repair.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: cents,
          method: paymentMethod,
          isDeposit: paymentDeposit,
          reference: paymentReference.trim() || null,
          note: paymentNote.trim() || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Unable to record payment");
      }
      setStatus({ tone: "success", message: "Payment recorded." });
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNote("");
      setPaymentDeposit(false);
      refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to record payment";
      setStatus({ tone: "error", message });
    }
  }

  async function handleClose() {
    if (!repair) return;
    setStatus(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/repairs/${repair.id}/close`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as { repair?: RepairDetail } & WarrantyResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error || "Unable to close repair");
      }
      setWarrantyLink(body.warrantyDocumentUrl ?? null);
      setStatus({ tone: "success", message: "Repair closed and customer notified." });
      refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to close repair";
      setStatus({ tone: "error", message });
    }
  }

  async function handleNotify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!repair) return;
    if (!notificationMessage.trim()) {
      setStatus({ tone: "error", message: "Notification message is required." });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/repairs/${repair.id}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: notificationChannel,
          recipient: notificationRecipient.trim() || undefined,
          message: notificationMessage.trim(),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Unable to queue notification");
      }
      setStatus({ tone: "success", message: "Notification queued." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to queue notification";
      setStatus({ tone: "error", message });
    }
  }

  async function handleWarranty() {
    if (!repair) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/repairs/${repair.id}/warranty`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as WarrantyResponse & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "Unable to generate warranty");
      }
      setWarrantyLink(body.warrantyDocumentUrl);
      setStatus({ tone: "success", message: "Warranty document generated." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate warranty";
      setStatus({ tone: "error", message });
    }
  }

  if (loading) {
    return (
      <main className="px-6 py-10">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading repair…</p>
      </main>
    );
  }

  if (!repair) {
    return (
      <main className="px-6 py-10">
        <p className="text-sm text-red-600 dark:text-red-400">
          {Number.isFinite(repairId) && repairId > 0
            ? "Repair not found."
            : "Invalid repair identifier."}
        </p>
      </main>
    );
  }

  return (
    <main className="px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">Repair #{repair.id}</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{repair.jobNumber}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {customerName} • {repair.branch.name ?? `Branch #${repair.branch.id}`}
          </p>
        </div>
        <Link
          href="/repairs/board"
          className="inline-flex items-center rounded bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Back to board
        </Link>
      </header>

      {status && (
        <div
          className={`mb-6 rounded border px-4 py-3 text-sm ${
            status.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200"
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr,1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Job summary</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <dl>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">{repair.status}</dd>
            </dl>
            <dl>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Approval</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">{repair.approvalStatus}</dd>
            </dl>
            <dl>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Estimate</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {centsToCurrency(repair.estimateCents)}
              </dd>
            </dl>
            <dl>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Deposit</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {centsToCurrency(repair.depositCents)}
              </dd>
            </dl>
            <dl>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Total paid</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {centsToCurrency(repair.totalPaidCents)}
              </dd>
            </dl>
            <dl>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Balance due</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {centsToCurrency(repair.balanceDueCents)}
              </dd>
            </dl>
            <dl>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Promised</dt>
              <dd className="text-sm text-slate-700 dark:text-slate-300">{formatDate(repair.promisedAt)}</dd>
            </dl>
            <dl>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Last updated</dt>
              <dd className="text-sm text-slate-700 dark:text-slate-300">{formatDate(repair.updatedAt)}</dd>
            </dl>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Item description</p>
              <p>{repair.itemDescription || "--"}</p>
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Issue</p>
              <p>{repair.issueDescription || "--"}</p>
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Diagnosis</p>
              <p>{repair.diagnosis || "--"}</p>
            </div>
            {repair.notes && (
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Notes</p>
                <p>{repair.notes}</p>
              </div>
            )}
          </div>
          {repair.photos.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Photos</h3>
              <ul className="mt-2 space-y-1 text-sm text-blue-600 dark:text-blue-300">
                {repair.photos.map((photo) => (
                  <li key={photo.id}>
                    <a href={photo.storagePath} target="_blank" rel="noreferrer" className="hover:underline">
                      {photo.storagePath}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Collect payment</h2>
            <form className="mt-3 space-y-3 text-sm" onSubmit={handlePayment}>
              <label className="flex flex-col gap-1">
                <span className="text-slate-600 dark:text-slate-300">Amount (RD$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="0.00"
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-600 dark:text-slate-300">Method</span>
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  {paymentMethods.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={paymentDeposit}
                  onChange={(event) => setPaymentDeposit(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Treat as additional deposit
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-600 dark:text-slate-300">Reference</span>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-600 dark:text-slate-300">Note</span>
                <textarea
                  rows={2}
                  value={paymentNote}
                  onChange={(event) => setPaymentNote(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
              >
                Record payment
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Notify customer</h2>
            <form className="mt-3 space-y-3 text-sm" onSubmit={handleNotify}>
              <label className="flex flex-col gap-1">
                <span className="text-slate-600 dark:text-slate-300">Channel</span>
                <select
                  value={notificationChannel}
                  onChange={(event) => setNotificationChannel(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-600 dark:text-slate-300">Recipient</span>
                <input
                  type="tel"
                  value={notificationRecipient}
                  onChange={(event) => setNotificationRecipient(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="829-555-1234"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-600 dark:text-slate-300">Message</span>
                <textarea
                  rows={3}
                  required
                  value={notificationMessage}
                  onChange={(event) => setNotificationMessage(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
              >
                Queue notification
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Close job</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Closing the repair marks it as completed and sends a ready-for-pickup notification.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Close repair
              </button>
              <button
                type="button"
                onClick={handleWarranty}
                className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Generate warranty
              </button>
              {warrantyLink && (
                <a
                  href={warrantyLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  Download warranty document
                </a>
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Payments</h2>
          {repair.payments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No payments recorded.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200 text-sm dark:divide-slate-700">
              {repair.payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {centsToCurrency(payment.amountCents)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {payment.method} • {formatDate(payment.createdAt)}
                    </p>
                    {payment.reference && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Ref: {payment.reference}</p>
                    )}
                    {payment.note && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{payment.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Materials</h2>
          {repair.materials.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No materials issued.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200 text-sm dark:divide-slate-700">
              {repair.materials.map((material) => (
                <li key={material.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {material.code || `Version #${material.productCodeVersionId}`} • {material.name || "Unnamed"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Issued {material.qtyIssued} • Returned {material.qtyReturned}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(material.updatedAt ?? material.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
