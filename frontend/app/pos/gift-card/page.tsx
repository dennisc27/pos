"use client";

import { useState } from "react";

import { Gift, RefreshCcw, Ticket, Wallet } from "lucide-react";

import { formatCurrency } from "@/components/pos/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

const normalizeCode = (code: string) => code.trim().toUpperCase();

type GiftCard = {
  id: number;
  code: string;
  balanceCents: number;
  expiresOn?: string | null;
  createdAt: string;
};

type ApiResult = { error?: string } & Partial<GiftCard>;

type StatusMessage = { tone: "success" | "error"; message: string } | null;

async function postGiftCard(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as ApiResult;

  if (!response.ok) {
    throw new Error(data?.error ?? "Request failed");
  }

  return data;
}

type LastActivity = { kind: "issued" | "reloaded" | "redeemed"; amountCents: number } | null;

export default function PosGiftCardPage() {
  const [activeCard, setActiveCard] = useState<GiftCard | null>(null);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [issueForm, setIssueForm] = useState({ amount: "", code: "", expiresOn: "" });
  const [reloadForm, setReloadForm] = useState({ code: "", amount: "" });
  const [redeemForm, setRedeemForm] = useState({ code: "", amount: "" });
  const [loading, setLoading] = useState<{ issue: boolean; reload: boolean; redeem: boolean }>({
    issue: false,
    reload: false,
    redeem: false,
  });
  const [lastActivity, setLastActivity] = useState<LastActivity>(null);

  const updateCard = (data: ApiResult) => {
    if (data?.id && data?.code) {
      setActiveCard({
        id: data.id,
        code: data.code,
        balanceCents: Number(data.balanceCents ?? 0),
        expiresOn: data.expiresOn ?? null,
        createdAt: data.createdAt ?? new Date().toISOString(),
      });
    }
  };

  const handleIssueSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    const amountValue = Number(issueForm.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setStatus({ tone: "error", message: "Enter an amount greater than zero" });
      return;
    }

    setLoading((state) => ({ ...state, issue: true }));
    try {
      const payload = {
        code: issueForm.code?.trim() || null,
        amountCents: Math.round(amountValue * 100),
        expiresOn: issueForm.expiresOn || null,
      };
      const data = await postGiftCard("/api/gift-cards/issue", payload);
      updateCard(data);
      setStatus({ tone: "success", message: `Gift card ${data.code} issued successfully.` });
      setLastActivity({ kind: "issued", amountCents: payload.amountCents });
      setIssueForm({ amount: "", code: "", expiresOn: "" });
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Failed to issue gift card" });
    } finally {
      setLoading((state) => ({ ...state, issue: false }));
    }
  };

  const handleReloadSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    const amountValue = Number(reloadForm.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setStatus({ tone: "error", message: "Enter an amount greater than zero" });
      return;
    }

    setLoading((state) => ({ ...state, reload: true }));
    try {
      const payload = {
        code: reloadForm.code.trim(),
        amountCents: Math.round(amountValue * 100),
      };
      const data = await postGiftCard("/api/gift-cards/reload", payload);
      updateCard(data);
      setStatus({ tone: "success", message: `Gift card ${data.code} reloaded.` });
      setLastActivity({ kind: "reloaded", amountCents: payload.amountCents });
      setReloadForm({ code: "", amount: "" });
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Failed to reload gift card" });
    } finally {
      setLoading((state) => ({ ...state, reload: false }));
    }
  };

  const handleRedeemSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    const amountValue = Number(redeemForm.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setStatus({ tone: "error", message: "Enter an amount greater than zero" });
      return;
    }

    const amountCents = Math.round(amountValue * 100);
    const redeemCode = redeemForm.code.trim();

    if (
      activeCard &&
      normalizeCode(activeCard.code) === normalizeCode(redeemCode) &&
      amountCents > activeCard.balanceCents
    ) {
      setStatus({ tone: "error", message: "Cannot redeem more than the available balance." });
      return;
    }

    setLoading((state) => ({ ...state, redeem: true }));
    try {
      const payload = {
        code: redeemCode,
        amountCents,
      };
      const data = await postGiftCard("/api/gift-cards/redeem", payload);
      updateCard(data);
      setStatus({ tone: "success", message: `Redeemed ${formatCurrency(amountValue)} from ${data.code}.` });
      setLastActivity({ kind: "redeemed", amountCents: payload.amountCents });
      setRedeemForm({ code: "", amount: "" });
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Failed to redeem gift card" });
    } finally {
      setLoading((state) => ({ ...state, redeem: false }));
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500">POS · Gift cards</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Manage gift card balances</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Issue new cards, reload balances, and redeem store credit while keeping ledger activity in sync.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-6">
          <form onSubmit={handleIssueSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <header className="mb-4 flex items-center gap-3">
              <Ticket className="h-5 w-5 text-slate-500 dark:text-slate-300" />
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Issue card</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Create a new gift card with an optional custom code.</p>
              </div>
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-300">Amount (DOP)</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={issueForm.amount}
                  onChange={(event) => setIssueForm((prev) => ({ ...prev, amount: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-300">Custom code (optional)</span>
                <input
                  value={issueForm.code}
                  onChange={(event) => setIssueForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="GC-2025-SUMMER"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-300">Expires on (optional)</span>
                <input
                  type="date"
                  value={issueForm.expiresOn}
                  onChange={(event) => setIssueForm((prev) => ({ ...prev, expiresOn: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={loading.issue}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Gift className="h-4 w-4" /> {loading.issue ? "Issuing..." : "Issue gift card"}
            </button>
          </form>

          <form onSubmit={handleReloadSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <header className="mb-4 flex items-center gap-3">
              <RefreshCcw className="h-5 w-5 text-slate-500 dark:text-slate-300" />
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Reload card</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Add additional balance to an existing card.</p>
              </div>
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-300">Card code</span>
                <input
                  value={reloadForm.code}
                  onChange={(event) => setReloadForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="GC-2025-SUMMER"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-300">Amount (DOP)</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={reloadForm.amount}
                  onChange={(event) => setReloadForm((prev) => ({ ...prev, amount: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  required
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={loading.reload}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Wallet className="h-4 w-4" /> {loading.reload ? "Reloading..." : "Reload balance"}
            </button>
          </form>

          <form onSubmit={handleRedeemSubmit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <header className="mb-4 flex items-center gap-3">
              <Wallet className="h-5 w-5 text-slate-500 dark:text-slate-300" />
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Redeem card</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Apply gift card balance to a sale.</p>
              </div>
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-300">Card code</span>
                <input
                  value={redeemForm.code}
                  onChange={(event) => setRedeemForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="GC-2025-SUMMER"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-300">Amount (DOP)</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={redeemForm.amount}
                  onChange={(event) => setRedeemForm((prev) => ({ ...prev, amount: event.target.value }))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  required
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={loading.redeem}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <RefreshCcw className="h-4 w-4" /> {loading.redeem ? "Redeeming..." : "Redeem balance"}
            </button>
          </form>
        </section>
        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Balance widget</h2>
            {activeCard ? (
              <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Code</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{activeCard.code}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Balance</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(activeCard.balanceCents / 100)}
                </p>
                {lastActivity ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Last activity: {lastActivity.kind} {formatCurrency(lastActivity.amountCents / 100)}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Issued</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {dateFormatter.format(new Date(activeCard.createdAt))}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">Expires</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {activeCard.expiresOn ? dateFormatter.format(new Date(activeCard.expiresOn)) : "No expiry"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Issue or search for a card to see its current balance here.
              </p>
            )}
          </div>
          {status ? (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                status.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200'
              }`}
            >
              {status.message}
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
