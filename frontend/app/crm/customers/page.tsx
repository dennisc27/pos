"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import {
  AlertTriangle,
  CreditCard,
  Edit,
  Flag,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MessageSquareDashed,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Users,
  UserPlus,
  Repeat,
  X
} from "lucide-react";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils";
import { useActiveBranch } from "@/components/providers/active-branch-provider";
import { AddCustomerDialog } from "@/components/customer/add-customer-dialog";
import { formatCurrencyFromCents } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type CustomerSummary = {
  id: number;
  branchId: number;
  firstName: string;
  lastName: string;
  cedulaNo: string | null;
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

type CreditNoteLedgerEntry = {
  id: number;
  creditNoteId: number;
  deltaCents: number;
  refTable: string | null;
  refId: number | null;
  createdAt: string | null;
};

type CreditNote = {
  id: number;
  customerId: number;
  balanceCents: number;
  reason: string | null;
  createdAt: string | null;
  ledger: CreditNoteLedgerEntry[];
};

type CreditNotes = {
  totalCents: number;
  notes: CreditNote[];
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
  creditNotes: CreditNotes;
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

function getInitials(customer: CustomerSummary) {
  const first = customer.firstName?.charAt(0)?.toUpperCase() || "";
  const last = customer.lastName?.charAt(0)?.toUpperCase() || "";
  return `${first}${last}` || "?";
}

function formatDate(value?: string | null) {
  return formatDateForDisplay(value);
}

function formatDateTime(value?: string | null) {
  return formatDateTimeForDisplay(value);
}

export default function CrmCustomersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState("");
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerSummary | null>(null);
  const [idImagesPath, setIdImagesPath] = useState<string>("");
  const [editFormData, setEditFormData] = useState<{
    firstName: string;
    lastName: string;
    cedulaNo: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null>(null);

  // Calculate customer metrics from transactions
  const customerMetrics = useMemo(() => {
    if (!detail?.transactions) {
      return {
        activeLoans: { count: 0, balanceCents: 0 },
        retailPurchases: { count: 0, lastPurchaseDate: null },
        layaways: { count: 0, isUpToDate: true },
      };
    }

    const loans = detail.transactions.filter((t) => t.type === "loan");
    const activeLoans = loans.filter((loan) => {
      // Consider loans active if status is not 'redeemed' or 'cancelled'
      return loan.status !== "redeemed" && loan.status !== "cancelled";
    });
    const activeLoansBalance = activeLoans.reduce((sum, loan) => sum + (loan.amountCents || 0), 0);

    const orders = detail.transactions.filter((t) => t.type === "order");
    const lastOrder = orders.length > 0 ? orders[0] : null;
    const lastPurchaseDate = lastOrder?.createdAt || null;

    const layaways = detail.transactions.filter((t) => t.type === "layaway");
    const activeLayaways = layaways.filter((l) => l.status !== "completed" && l.status !== "cancelled");
    // Check if any layaway is overdue (simplified - would need dueDate comparison)
    const isUpToDate = activeLayaways.every((l) => {
      // For now, assume up to date if no status indicates overdue
      return l.status !== "overdue";
    });

    return {
      activeLoans: {
        count: activeLoans.length,
        balanceCents: activeLoansBalance,
      },
      retailPurchases: {
        count: orders.length,
        lastPurchaseDate,
      },
      layaways: {
        count: activeLayaways.length,
        isUpToDate,
      },
    };
  }, [detail]);

  // Calculate metrics from customers
  const metrics = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const totalCustomers = customers.length;
    
    const newCustomersLast30Days = customers.filter((customer) => {
      if (!customer.createdAt) return false;
      const createdAt = new Date(customer.createdAt);
      return createdAt >= thirtyDaysAgo;
    }).length;

    const repeatCustomersLast30Days = customers.filter((customer) => {
      if (!customer.lastActivityAt) return false;
      const lastActivity = new Date(customer.lastActivityAt);
      const createdAt = customer.createdAt ? new Date(customer.createdAt) : null;
      // Must have activity in last 30 days AND was created before 30 days ago
      return lastActivity >= thirtyDaysAgo && (createdAt === null || createdAt < thirtyDaysAgo);
    }).length;

    return {
      totalCustomers,
      newCustomersLast30Days,
      repeatCustomersLast30Days,
    };
  }, [customers]);

  const fetchCustomers = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set("q", search.trim());
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
  }, [search]);

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
      // Set initial recipient based on current channel
      if (messageChannel === "email" && payload.customer.email) {
        setMessageRecipient(payload.customer.email);
      } else if ((messageChannel === "sms" || messageChannel === "whatsapp") && payload.customer.phone) {
        setMessageRecipient(payload.customer.phone);
      } else {
        setMessageRecipient(payload.customer.phone ?? payload.customer.email ?? "");
      }
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to load customer");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Update recipient when channel changes
  useEffect(() => {
    if (!detail?.customer) return;
    
    if (messageChannel === "email" && detail.customer.email) {
      setMessageRecipient(detail.customer.email);
    } else if ((messageChannel === "sms" || messageChannel === "whatsapp") && detail.customer.phone) {
      setMessageRecipient(detail.customer.phone);
    }
  }, [messageChannel, detail?.customer?.email, detail?.customer?.phone]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Open add dialog if 'add' query parameter is present
  useEffect(() => {
    if (searchParams.get("add") === "true") {
      setIsAddDialogOpen(true);
    }
  }, [searchParams]);

  // Fetch ID images path setting
  useEffect(() => {
    const fetchIdImagesPath = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/settings?scope=global`);
        if (!response.ok) return;
        const data = await response.json();
        const complianceEntry = data.entries?.find((e: { key: string }) => e.key === "compliance.settings");
        if (complianceEntry?.value?.idImagesPath) {
          setIdImagesPath(complianceEntry.value.idImagesPath);
        }
      } catch (error) {
        console.error("Failed to fetch ID images path:", error);
      }
    };
    fetchIdImagesPath();
  }, []);

  useEffect(() => {
    if (selectedCustomerId != null) {
      fetchDetail(selectedCustomerId);
    }
  }, [selectedCustomerId, fetchDetail]);

  const handleSelect = (customerId: number) => {
    setSelectedCustomerId(customerId);
  };

  const handleEditCustomer = (customer: CustomerSummary) => {
    setEditingCustomer(customer);
    setEditFormData({
      firstName: customer.firstName,
      lastName: customer.lastName,
      cedulaNo: customer.cedulaNo,
      email: customer.email,
      phone: customer.phone,
      address: null, // Will be loaded from detail if available
    });
    setIsEditDialogOpen(true);
    // If detail is already loaded for this customer, use it
    if (detail && detail.customer.id === customer.id) {
      setEditFormData((prev) => ({
        ...prev!,
        address: detail.customer.address,
        cedulaNo: detail.customer.cedulaNo,
      }));
    }
  };

  const handleSaveCustomer = async () => {
    if (!editingCustomer || !editFormData) return;

    setActionLoading(true);
    setDetailError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${editingCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editFormData.firstName.trim(),
          lastName: editFormData.lastName.trim(),
          cedulaNo: editFormData.cedulaNo?.trim() || null,
          email: editFormData.email?.trim() || null,
          phone: editFormData.phone?.trim() || null,
          address: editFormData.address?.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update customer");
      }

      // Refresh customer list and detail
      await fetchCustomers();
      if (selectedCustomerId === editingCustomer.id) {
        await fetchDetail(editingCustomer.id);
      }
      setIsEditDialogOpen(false);
      setEditingCustomer(null);
      setEditFormData(null);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to update customer");
    } finally {
      setActionLoading(false);
    }
  };

  // Load address from detail when editing
  useEffect(() => {
    if (isEditDialogOpen && editingCustomer && detail && detail.customer.id === editingCustomer.id) {
      setEditFormData((prev) => ({
        ...prev!,
        address: detail.customer.address,
      }));
    }
  }, [isEditDialogOpen, editingCustomer, detail]);

  const handleRefresh = () => {
    fetchCustomers();
    if (selectedCustomerId != null) {
      fetchDetail(selectedCustomerId);
    }
  };

  const handleOpenAddDialog = () => {
    setIsAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setIsAddDialogOpen(false);
    setDetailError(null);
    // Remove the 'add' query parameter when closing
    if (searchParams.get("add") === "true") {
      router.replace("/crm/customers");
    }
  };

  const handleCustomerCreated = async (customer: { id: number; firstName: string; lastName: string; cedulaNo: string | null; email: string | null; phone: string | null; address: string | null }) => {
    // Refresh customer list
    await fetchCustomers();
    
    // Load and select the newly created customer
    await fetchDetail(customer.id);
    setSelectedCustomerId(customer.id);
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
      <section className="flex w-full flex-1 flex-col gap-6 px-6 py-6">
        {/* Metrics Section */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-500/20">
                <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Customers</p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {loadingList ? (
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  ) : (
                    new Intl.NumberFormat("es-DO").format(metrics.totalCustomers)
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-500/20">
                <UserPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">New (Last 30 Days)</p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {loadingList ? (
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  ) : (
                    new Intl.NumberFormat("es-DO").format(metrics.newCustomersLast30Days)
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-500/20">
                <Repeat className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Repeat (Last 30 Days)</p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {loadingList ? (
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  ) : (
                    new Intl.NumberFormat("es-DO").format(metrics.repeatCustomersLast30Days)
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Customers</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Search profiles, review history, adjust loyalty, and send compliant outreach messages.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddDialog}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
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
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:w-1/3 xl:w-1/4">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, email, or phone"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-xs text-slate-700 outline-none ring-slate-400 focus:border-slate-300 focus:ring-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="flex h-[32rem] flex-col overflow-hidden">
            {listError ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center text-xs text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <p>{listError}</p>
              </div>
            ) : loadingList ? (
              <div className="flex flex-1 items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <ul className="flex-1 divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
                {customers.length === 0 ? (
                  <li className="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    No customers match the current filters.
                  </li>
                ) : (
                  customers.map((customer) => {
                    const isSelected = customer.id === selectedCustomerId;
                    return (
                      <li key={customer.id}>
                        <div
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition ${
                            isSelected
                              ? "bg-slate-100/80 text-slate-900 dark:bg-slate-800/60 dark:text-slate-50"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          }`}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                            {getInitials(customer)}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelect(customer.id)}
                            className="flex flex-1 flex-col gap-1 min-w-0"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-slate-900 dark:text-slate-100 truncate text-sm">{fullName(customer)}</div>
                              {customer.isBlacklisted ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300 shrink-0 whitespace-nowrap">
                                  <ShieldAlert className="h-3 w-3" /> Blacklisted
                                </span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                              {customer.cedulaNo ? (
                                <div className="flex items-center gap-1.5 truncate">
                                  <CreditCard className="h-3 w-3 shrink-0" /> <span className="truncate">{customer.cedulaNo}</span>
                                </div>
                              ) : null}
                              {customer.phone ? (
                                <div className="flex items-center gap-1.5 truncate">
                                  <Phone className="h-3 w-3 shrink-0" /> <span className="truncate">{customer.phone}</span>
                                </div>
                              ) : null}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCustomer(customer);
                            }}
                            className="shrink-0 rounded-md border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            title="Editar cliente"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        </aside>

        <aside className="flex w-full flex-1 flex-col gap-4">
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
                  <div className="flex items-center justify-between">
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
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Block
                      </span>
                      <div className="relative inline-flex h-6 w-11 items-center rounded-full focus-within:outline-none focus-within:ring-2 focus-within:ring-red-500 focus-within:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        <input
                          type="checkbox"
                          checked={detail.customer.isBlacklisted}
                          onChange={async (e) => {
                            if (!detail?.customer) return;
                            setActionLoading(true);
                            try {
                              const response = await fetch(`${API_BASE_URL}/api/customers/${detail.customer.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ isBlacklisted: e.target.checked })
                              });
                              if (!response.ok) {
                                throw new Error(`Failed to update blacklist status (${response.status})`);
                              }
                              await fetchDetail(detail.customer.id);
                              await fetchCustomers(); // Refresh list to update badge
                            } catch (error) {
                              setDetailError(error instanceof Error ? error.message : "Unable to update blacklist status");
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                          disabled={actionLoading}
                          className="sr-only"
                        />
                        <span
                          className={`absolute inset-0 rounded-full transition-colors ${
                            detail.customer.isBlacklisted ? "bg-red-600" : "bg-slate-300 dark:bg-slate-600"
                          }`}
                        />
                        <span
                          className={`relative z-10 inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                            detail.customer.isBlacklisted ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </div>
                    </label>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Joined {formatDate(detail.customer.createdAt)} · Updated {formatDateTime(detail.customer.updatedAt)}
                  </p>
                  <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                    {detail.customer.cedulaNo ? (
                      <span className="inline-flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> {detail.customer.cedulaNo}
                      </span>
                    ) : null}
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

                {/* Customer Metrics */}
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      PRÉSTAMOS ACTIVOS
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {customerMetrics.activeLoans.count}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {formatCurrencyFromCents(customerMetrics.activeLoans.balanceCents)} balance
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      COMPRAS RETAIL
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {customerMetrics.retailPurchases.count} tickets
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {customerMetrics.retailPurchases.lastPurchaseDate
                        ? `Última ${formatDate(customerMetrics.retailPurchases.lastPurchaseDate)}`
                        : "Sin compras"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      LAYAWAYS
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {customerMetrics.layaways.count}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {customerMetrics.layaways.isUpToDate ? "Cumple al día" : "Pendiente"}
                    </p>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Loyalty</h3>
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/40">
                    <div>
                      <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Balance</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {detail.loyaltyLedger.points} points
                      </p>
                    </div>
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
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Store Credit</h3>
                  <div className="mt-2 flex flex-wrap items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-500/40 dark:bg-emerald-500/10">
                    <div>
                      <p className="text-xs uppercase text-emerald-600 dark:text-emerald-300">Total Available</p>
                      <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-200">
                        {formatCurrencyFromCents(detail.creditNotes.totalCents)}
                      </p>
                    </div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-300">
                      {detail.creditNotes.notes.length} {detail.creditNotes.notes.length === 1 ? "credit note" : "credit notes"}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {detail.creditNotes.notes.length === 0 ? (
                      <div className="rounded bg-slate-100/60 px-3 py-2 text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
                        No credit notes yet.
                      </div>
                    ) : (
                      detail.creditNotes.notes.map((creditNote) => (
                        <div
                          key={creditNote.id}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/60"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  Credit Note #{creditNote.id}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                    creditNote.balanceCents > 0
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                  }`}
                                >
                                  {creditNote.balanceCents > 0 ? "Active" : "Used"}
                                </span>
                              </div>
                              <p className="mt-1 font-medium text-slate-700 dark:text-slate-200">
                                Balance: {formatCurrencyFromCents(creditNote.balanceCents)}
                              </p>
                              {creditNote.reason && (
                                <p className="mt-1 text-slate-600 dark:text-slate-400">{creditNote.reason}</p>
                              )}
                              <p className="mt-1 text-slate-500 dark:text-slate-500">
                                Created: {formatDateTime(creditNote.createdAt)}
                              </p>
                              {creditNote.ledger.length > 0 && (
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
                                    {creditNote.ledger.length} {creditNote.ledger.length === 1 ? "transaction" : "transactions"}
                                  </summary>
                                  <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2 dark:border-slate-700">
                                    {creditNote.ledger.map((entry) => (
                                      <li
                                        key={entry.id}
                                        className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400"
                                      >
                                        <span>
                                          {entry.deltaCents > 0 ? "+" : ""}
                                          {formatCurrencyFromCents(entry.deltaCents)}
                                          {entry.refTable && (
                                            <span className="ml-1 text-slate-400 dark:text-slate-500">
                                              ({entry.refTable})
                                            </span>
                                          )}
                                        </span>
                                        <span>{formatDateTime(entry.createdAt)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
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
                {/* ID Images Section */}
                {detail.customer.cedulaNo && idImagesPath ? (
                  <section>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                      Imágenes de Cédula
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {/* Front ID Image */}
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                          Frente
                        </p>
                        {(() => {
                          const cedulaNoEncoded = encodeURIComponent(detail.customer.cedulaNo);
                          return (
                            <img
                              src={`${API_BASE_URL}/api/customers/${cedulaNoEncoded}/id-image/front`}
                              alt="Cédula - Frente"
                              className="w-full rounded border border-slate-200 dark:border-slate-700"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                                const parent = (e.target as HTMLImageElement).parentElement;
                                if (parent && !parent.querySelector(".error-message")) {
                                  const errorDiv = document.createElement("div");
                                  errorDiv.className = "error-message text-xs text-slate-400 text-center py-4";
                                  errorDiv.textContent = "Imagen no encontrada";
                                  parent.appendChild(errorDiv);
                                }
                              }}
                            />
                          );
                        })()}
                      </div>
                      {/* Back ID Image */}
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                          Reverso
                        </p>
                        {(() => {
                          const cedulaNoEncoded = encodeURIComponent(detail.customer.cedulaNo);
                          return (
                            <img
                              src={`${API_BASE_URL}/api/customers/${cedulaNoEncoded}/id-image/back`}
                              alt="Cédula - Reverso"
                              className="w-full rounded border border-slate-200 dark:border-slate-700"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                                const parent = (e.target as HTMLImageElement).parentElement;
                                if (parent && !parent.querySelector(".error-message")) {
                                  const errorDiv = document.createElement("div");
                                  errorDiv.className = "error-message text-xs text-slate-400 text-center py-4";
                                  errorDiv.textContent = "Imagen no encontrada";
                                  parent.appendChild(errorDiv);
                                }
                              }}
                            />
                          );
                        })()}
                      </div>
                    </div>
                  </section>
                ) : null}

                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Message customer</h3>
                  <form onSubmit={handleMessageSend} className="mt-2 flex flex-col gap-3">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Channel
                      <select
                        value={messageChannel}
                        onChange={(event) => {
                          const newChannel = event.target.value as typeof messageChannel;
                          setMessageChannel(newChannel);
                          // Auto-fill recipient based on channel
                          if (newChannel === "email" && detail?.customer?.email) {
                            setMessageRecipient(detail.customer.email);
                          } else if ((newChannel === "sms" || newChannel === "whatsapp") && detail?.customer?.phone) {
                            setMessageRecipient(detail.customer.phone);
                          }
                        }}
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
                        disabled={true}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
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
              </aside>
            </div>
          ) : null}
        </aside>
        </div>
      </section>

      {/* Edit Customer Dialog */}
      {isEditDialogOpen && editingCustomer && editFormData ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur"
          onClick={() => setIsEditDialogOpen(false)}
        >
          <div
            className="w-full max-w-2xl space-y-6 rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-800/80 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Editar cliente</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Modifica los datos del cliente según sea necesario.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditDialogOpen(false)}
                className="rounded-full border border-slate-200/70 p-2 text-slate-500 transition hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
                aria-label="Cerrar edición de cliente"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                {detailError}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Nombre
                  <input
                    value={editFormData.firstName}
                    onChange={(event) =>
                      setEditFormData({ ...editFormData, firstName: event.target.value })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Nombre"
                  />
                </label>
              </div>
              <div className="sm:col-span-1">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Apellido
                  <input
                    value={editFormData.lastName}
                    onChange={(event) =>
                      setEditFormData({ ...editFormData, lastName: event.target.value })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Apellido"
                  />
                </label>
              </div>
              <div className="sm:col-span-1">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Cédula No.
                  <input
                    value={editFormData.cedulaNo || ""}
                    onChange={(event) =>
                      setEditFormData({ ...editFormData, cedulaNo: event.target.value || null })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Cédula No."
                    maxLength={20}
                  />
                </label>
              </div>
              <div className="sm:col-span-1">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Teléfono
                  <input
                    type="tel"
                    value={editFormData.phone || ""}
                    onChange={(event) =>
                      setEditFormData({ ...editFormData, phone: event.target.value || null })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Teléfono"
                  />
                </label>
              </div>
              <div className="sm:col-span-1">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Correo electrónico
                  <input
                    type="email"
                    value={editFormData.email || ""}
                    onChange={(event) =>
                      setEditFormData({ ...editFormData, email: event.target.value || null })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Correo electrónico"
                  />
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  Dirección
                  <textarea
                    value={editFormData.address || ""}
                    onChange={(event) =>
                      setEditFormData({ ...editFormData, address: event.target.value || null })
                    }
                    rows={3}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Dirección"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditDialogOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveCustomer()}
                disabled={actionLoading || !editFormData.firstName.trim() || !editFormData.lastName.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Add Customer Dialog */}
      <AddCustomerDialog
        isOpen={isAddDialogOpen}
        onClose={handleCloseAddDialog}
        onSuccess={handleCustomerCreated}
        onError={(error) => setDetailError(error)}
      />
    </main>
  );
}
