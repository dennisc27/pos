"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  Flag,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MessageSquareDashed,
  Phone,
  RefreshCcw,
  Search,
  ShieldAlert,
  Users
} from "lucide-react";

import { formatCurrencyFromCents } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type CustomerSummary = {
  id: number;
  branchId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isBlacklisted: boolean;
  loyaltyPoints: number;
  createdAt: string | null;
  updatedAt: string | null;
  lastActivityAt: string | null;
};

type CustomerNote = {
  id: number;
  customerId: number;
  authorId: number;
  note: string;
  createdAt: string | null;
};

type LoyaltyEntry = {
  id: number;
  customerId: number;
  pointsDelta: number;
  reason: string | null;
  refTable: string | null;
  refId: number | null;
  createdAt: string | null;
};

type LoyaltyLedger = {
  points: number;
  entries: LoyaltyEntry[];
};

type CustomerMessage = {
  id: number;
  channel: "sms" | "whatsapp" | "email";
  recipient: string;
  message: string;
  status: "pending" | "sent" | "failed";
  error: string | null;
  sentAt: string | null;
  createdAt: string | null;
};

type CustomerTransaction = {
  type: "order" | "loan" | "layaway" | "repair";
  id: number;
  createdAt: string | null;
  amountCents: number | null;
  status: string | null;
  reference: string | null;
};

type CustomerImage = {
  id: number;
  storagePath: string;
  createdAt: string | null;
};

type CustomerDetail = {
  customer: CustomerSummary;
  idImages: CustomerImage[];
  notes: CustomerNote[];
  loyaltyLedger: LoyaltyLedger;
  messages: CustomerMessage[];
  transactions: CustomerTransaction[];
};

type CustomerListResponse = {
  customers: CustomerSummary[];
  page: number;
  pageSize: number;
};

function fullName(customer: CustomerSummary) {
  return `${customer.firstName} ${customer.lastName}`.trim();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

export default function CrmCustomersPage() {
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState<string>("all");
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [pointsDelta, setPointsDelta] = useState("0");
  const [messageBody, setMessageBody] = useState("");
  const [messageChannel, setMessageChannel] = useState<"sms" | "whatsapp" | "email">("sms");
  const [messageRecipient, setMessageRecipient] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const branchOptions = useMemo(() => {
    const options = new Map<number, { id: number; label: string }>();
    for (const customer of customers) {
      if (!options.has(customer.branchId)) {
        options.set(customer.branchId, {
          id: customer.branchId,
          label: `Branch #${customer.branchId}`
        });
      }
    }
    return Array.from(options.values()).sort((a, b) => a.id - b.id);
  }, [customers]);

  const fetchCustomers = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set("q", search.trim());
      }
      if (branchId !== "all") {
        params.set("branchId", branchId);
      }
      const response = await fetch(`${API_BASE_URL}/api/customers?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to load customers (${response.status})`);
      }
      const payload = (await response.json()) as CustomerListResponse;
      setCustomers(payload.customers ?? []);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Unable to fetch customers");
    } finally {
      setLoadingList(false);
    }
  }, [branchId, search]);

  const fetchDetail = useCallback(async (customerId: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}`);
      if (!response.ok) {
        throw new Error(`Failed to load customer (${response.status})`);
      }
      const payload = (await response.json()) as CustomerDetail;
      setDetail(payload);
      setMessageRecipient(payload.customer.phone ?? payload.customer.email ?? "");
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to load customer");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (selectedCustomerId != null) {
      fetchDetail(selectedCustomerId);
    }
  }, [selectedCustomerId, fetchDetail]);

  const handleSelect = (customerId: number) => {
    setSelectedCustomerId(customerId);
  };

  const handleRefresh = () => {
    fetchCustomers();
    if (selectedCustomerId != null) {
      fetchDetail(selectedCustomerId);
    }
  };

  const handleNoteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail?.customer || !noteText.trim()) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${detail.customer.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText.trim() })
      });
      if (!response.ok) {
        throw new Error(`Failed to add note (${response.status})`);
      }
      setNoteText("");
      await fetchDetail(detail.customer.id);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to add note");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePointsAdjust = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail?.customer) return;
    const delta = Number(pointsDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${detail.customer.id}/loyalty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointsDelta: delta })
      });
      if (!response.ok) {
        throw new Error(`Failed to update loyalty (${response.status})`);
      }
      setPointsDelta("0");
      await fetchDetail(detail.customer.id);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to update loyalty");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessageSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail?.customer || !messageBody.trim()) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${detail.customer.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: messageChannel,
          message: messageBody.trim(),
          recipient: messageRecipient.trim() || undefined
        })
      });
      if (!response.ok) {
        throw new Error(`Failed to queue message (${response.status})`);
      }
      setMessageBody("");
      await fetchDetail(detail.customer.id);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to queue message");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-slate-50/40 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white/70 px-8 py-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">CRM</p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Customers</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Search profiles, review history, adjust loyalty, and send compliant outreach messages.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {loadingList || detailLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden />
            ) : (
              <RefreshCcw className="h-4 w-4 text-slate-400" aria-hidden />
            )}
            Refresh
          </button>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6 lg:flex-row">
        <aside className="w-full rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:w-1/2 xl:w-2/5">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex flex-col gap-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, email, or phone"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none ring-slate-400 focus:border-slate-300 focus:ring-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Users className="h-4 w-4" /> Branch
                <select
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">All branches</option>
                  {branchOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="flex h-[32rem] flex-col overflow-hidden">
            {listError ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-red-600 dark:text-red-400">
                <AlertTriangle className="h-8 w-8" />
                <p>{listError}</p>
              </div>
            ) : loadingList ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <ul className="flex-1 divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
                {customers.length === 0 ? (
                  <li className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No customers match the current filters.
                  </li>
                ) : (
                  customers.map((customer) => {
                    const isSelected = customer.id === selectedCustomerId;
                    return (
                      <li key={customer.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(customer.id)}
                          className={`flex w-full flex-col gap-1 px-6 py-4 text-left text-sm transition ${
                            isSelected
                              ? "bg-slate-100/80 text-slate-900 dark:bg-slate-800/60 dark:text-slate-50"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-slate-900 dark:text-slate-100">{fullName(customer)}</div>
                            {customer.isBlacklisted ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                <ShieldAlert className="h-3 w-3" /> Blacklisted
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500 dark:text-slate-400">
                            {customer.phone ? (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {customer.phone}
                              </span>
                            ) : null}
                            {customer.email ? (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {customer.email}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1">
                              <Flag className="h-3 w-3" /> Branch {customer.branchId}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" /> {customer.loyaltyPoints} pts
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            Last activity: {formatDateTime(customer.lastActivityAt)}
                          </p>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        </aside>

        <section className="flex w-full flex-1 flex-col gap-4">
          {selectedCustomerId == null ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              <MessageSquareDashed className="mb-3 h-10 w-10" />
              <p className="text-sm font-medium">Select a customer to view the profile drawer.</p>
            </div>
          ) : detailLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : detailError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/70 p-8 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
              <AlertTriangle className="h-8 w-8" />
              <p>{detailError}</p>
            </div>
          ) : detail ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <article className="col-span-1 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-3">
                <header className="flex flex-col gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {fullName(detail.customer)}
                    </h2>
                    {detail.customer.isBlacklisted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        <ShieldAlert className="h-3 w-3" /> Blacklisted
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Joined {formatDate(detail.customer.createdAt)} · Updated {formatDateTime(detail.customer.updatedAt)}
                  </p>
                  <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                    {detail.customer.phone ? (
                      <span className="inline-flex items-center gap-2">
                        <Phone className="h-4 w-4" /> {detail.customer.phone}
                      </span>
                    ) : null}
                    {detail.customer.email ? (
                      <span className="inline-flex items-center gap-2">
                        <Mail className="h-4 w-4" /> {detail.customer.email}
                      </span>
                    ) : null}
                    {detail.customer.address ? (
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> {detail.customer.address}
                      </span>
                    ) : null}
                  </div>
                </header>

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Loyalty</h3>
                  <div className="mt-2 flex flex-wrap items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/40">
                    <div>
                      <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Balance</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {detail.loyaltyLedger.points} points
                      </p>
                    </div>
                    <form onSubmit={handlePointsAdjust} className="flex items-center gap-2">
                      <input
                        type="number"
                        step="1"
                        value={pointsDelta}
                        onChange={(event) => setPointsDelta(event.target.value)}
                        className="w-24 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
                      >
                        Adjust
                      </button>
                    </form>
                  </div>
                  <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-xs text-slate-500 dark:text-slate-400">
                    {detail.loyaltyLedger.entries.length === 0 ? (
                      <li className="rounded bg-slate-100/60 px-3 py-2 text-center dark:bg-slate-800/40">
                        No ledger entries recorded yet.
                      </li>
                    ) : (
                      detail.loyaltyLedger.entries.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex items-start justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60"
                        >
                          <div>
                            <p className="font-medium text-slate-700 dark:text-slate-200">
                              {entry.pointsDelta > 0 ? `+${entry.pointsDelta}` : entry.pointsDelta} pts
                            </p>
                            <p>{entry.reason ?? "manual"}</p>
                          </div>
                          <span>{formatDateTime(entry.createdAt)}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </section>

                <section>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Notes</h3>
                    <span className="text-xs text-slate-400 dark:text-slate-500">Newest first</span>
                  </div>
                  <form onSubmit={handleNoteSubmit} className="mt-2 flex flex-col gap-2">
                    <textarea
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      placeholder="Add an internal note"
                      className="min-h-[72px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="submit"
                      disabled={actionLoading || !noteText.trim()}
                      className="self-end rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
                    >
                      Save note
                    </button>
                  </form>
                  <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm text-slate-600 dark:text-slate-300">
                    {detail.notes.length === 0 ? (
                      <li className="rounded bg-slate-100/60 px-3 py-3 text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                        No notes yet.
                      </li>
                    ) : (
                      detail.notes.map((note) => (
                        <li key={note.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                          <p>{note.note}</p>
                          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            Added {formatDateTime(note.createdAt)} by user #{note.authorId}
                          </p>
                        </li>
                      ))
                    )}
                  </ul>
                </section>

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Transactions</h3>
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                      <thead className="bg-slate-100 text-xs uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Reference</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {detail.transactions.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                              No recorded activity yet.
                            </td>
                          </tr>
                        ) : (
                          detail.transactions.map((transaction) => (
                            <tr key={`${transaction.type}-${transaction.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="px-3 py-2 font-medium capitalize text-slate-700 dark:text-slate-200">
                                {transaction.type}
                              </td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                {transaction.reference ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                {transaction.amountCents != null ? formatCurrencyFromCents(transaction.amountCents) : "—"}
                              </td>
                              <td className="px-3 py-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {transaction.status ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{formatDateTime(transaction.createdAt)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </article>

              <aside className="col-span-1 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Message customer</h3>
                  <form onSubmit={handleMessageSend} className="mt-2 flex flex-col gap-3">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Channel
                      <select
                        value={messageChannel}
                        onChange={(event) => setMessageChannel(event.target.value as typeof messageChannel)}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="sms">SMS</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">Email</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Recipient
                      <input
                        value={messageRecipient}
                        onChange={(event) => setMessageRecipient(event.target.value)}
                        placeholder="Phone or email"
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </label>
                    <textarea
                      value={messageBody}
                      onChange={(event) => setMessageBody(event.target.value)}
                      placeholder="Message body"
                      className="min-h-[96px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="submit"
                      disabled={actionLoading || !messageBody.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
                    >
                      <MessageSquare className="h-4 w-4" /> Queue message
                    </button>
                  </form>
                </section>

                <section className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recent messages</h3>
                    <span className="text-xs text-slate-400 dark:text-slate-500">Last 100</span>
                  </div>
                  <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm text-slate-600 dark:text-slate-300">
                    {detail.messages.length === 0 ? (
                      <li className="rounded bg-slate-100/60 px-3 py-3 text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                        No outbound messages yet.
                      </li>
                    ) : (
                      detail.messages.map((message) => (
                        <li key={message.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" /> {message.channel}
                            </span>
                            <span>{message.status}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">To {message.recipient}</p>
                          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{message.message}</p>
                          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Queued {formatDateTime(message.createdAt)}</p>
                          {message.error ? (
                            <p className="mt-1 inline-flex items-center gap-1 text-xs text-red-500">
                              <AlertTriangle className="h-3 w-3" /> {message.error}
                            </p>
                          ) : null}
                        </li>
                      ))
                    )}
                  </ul>
                </section>

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">ID Images</h3>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {detail.idImages.length === 0 ? (
                      <p className="rounded bg-slate-100/60 px-3 py-3 text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                        No ID images uploaded.
                      </p>
                    ) : (
                      detail.idImages.map((image) => (
                        <a
                          key={image.id}
                          href={`${API_BASE_URL}/${image.storagePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <span>{image.storagePath.split("/").pop()}</span>
                          <span>{formatDateTime(image.createdAt)}</span>
                        </a>
                      ))
                    )}
                  </div>
                </section>
              </aside>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
