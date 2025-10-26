"use client";

import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { formatCurrency } from "@/components/pos/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const lanes = [
  { id: "intake", label: "Intake" },
  { id: "diagnosing", label: "Diagnosing" },
  { id: "waiting_approval", label: "Waiting approval" },
  { id: "in_progress", label: "In progress" },
  { id: "qa", label: "QA" },
  { id: "ready", label: "Ready" },
  { id: "completed", label: "Completed" },
];

const approvalLabels: Record<string, string> = {
  not_requested: "Not requested",
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
};

const statusOptions = lanes.map((lane) => ({ value: lane.id, label: lane.label }));

function centsToCurrency(cents: number | null | undefined) {
  return formatCurrency(Number(cents ?? 0) / 100);
}

type RepairBoardItem = {
  id: number;
  branchId: number;
  branchName: string | null;
  customerId: number;
  customerName: string | null;
  jobNumber: string;
  itemDescription: string | null;
  issueDescription: string | null;
  status: string;
  approvalStatus: string;
  estimateCents: number | null;
  depositCents: number;
  totalPaidCents: number;
  balanceDueCents: number | null;
  promisedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type StatusMessage = { tone: "success" | "error"; message: string } | null;

type MaterialsDraft = Record<number, { versionId: string; qty: string }>;

export default function RepairsBoardPage() {
  const [repairs, setRepairs] = useState<RepairBoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [materialsDraft, setMaterialsDraft] = useState<MaterialsDraft>({});
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    async function loadRepairs() {
      setLoading(true);
      setStatus(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/repairs`);
        const body = (await response.json().catch(() => ({}))) as { repairs?: RepairBoardItem[]; error?: string };

        if (!response.ok) {
          throw new Error(body.error || "Unable to load repairs");
        }

        setRepairs(Array.isArray(body.repairs) ? body.repairs : []);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load repairs";
        setStatus({ tone: "error", message });
      } finally {
        setLoading(false);
      }
    }

    loadRepairs();
  }, [refreshToken]);

  function refresh() {
    setRefreshToken((token) => token + 1);
  }

  function updateDraft(repairId: number, field: "versionId" | "qty", value: string) {
    setMaterialsDraft((prev) => ({
      ...prev,
      [repairId]: {
        versionId: field === "versionId" ? value : prev[repairId]?.versionId ?? "",
        qty: field === "qty" ? value : prev[repairId]?.qty ?? "",
      },
    }));
  }

  function resetDraft(repairId: number) {
    setMaterialsDraft((prev) => ({
      ...prev,
      [repairId]: { versionId: "", qty: "" },
    }));
  }

  async function handleRequestApproval(repairId: number) {
    setStatus(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/repairs/${repairId}/request-approval`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Unable to request approval");
      }
      setStatus({ tone: "success", message: "Approval requested." });
      refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to request approval";
      setStatus({ tone: "error", message });
    }
  }

  async function handleMove(repairId: number, nextStatus: string) {
    setStatus(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/repairs/${repairId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Unable to update status");
      }
      setStatus({ tone: "success", message: "Status updated." });
      refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update status";
      setStatus({ tone: "error", message });
    }
  }

  async function submitMaterials(
    event: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>,
    repairId: number,
    mode: "issue" | "return"
  ) {
    event.preventDefault();
    setStatus(null);

    const draft = materialsDraft[repairId] ?? { versionId: "", qty: "" };
    const productCodeVersionId = Number.parseInt(draft.versionId, 10);
    const quantity = Number.parseInt(draft.qty, 10);

    if (!Number.isInteger(productCodeVersionId) || productCodeVersionId <= 0) {
      setStatus({ tone: "error", message: "Material version ID must be a positive number." });
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setStatus({ tone: "error", message: "Quantity must be a positive integer." });
      return;
    }

    try {
      const endpoint = `${API_BASE_URL}/api/repairs/${repairId}/materials/${mode}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productCodeVersionId, quantity }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Unable to record materials movement");
      }
      setStatus({ tone: "success", message: mode === "issue" ? "Materials issued." : "Materials returned." });
      resetDraft(repairId);
      refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to record materials movement";
      setStatus({ tone: "error", message });
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, RepairBoardItem[]>();
    for (const lane of lanes) {
      map.set(lane.id, []);
    }
    for (const repair of repairs) {
      const list = map.get(repair.status) ?? map.get("intake");
      (list ?? []).push(repair);
      if (list === undefined) {
        map.set("intake", [repair]);
      }
    }
    for (const lane of lanes) {
      const list = map.get(lane.id) ?? [];
      list.sort((a, b) => {
        const left = a.promisedAt ?? a.createdAt ?? "";
        const right = b.promisedAt ?? b.createdAt ?? "";
        return left.localeCompare(right);
      });
      map.set(lane.id, list);
    }
    return map;
  }, [repairs]);

  return (
    <main className="px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-500">Repairs</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Repairs board</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Monitor each job, request approvals, and track material consumption in one place.
          </p>
        </div>
        <Link
          href="/repairs/intake"
          className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
        >
          New intake
        </Link>
      </header>

      {status && (
        <div
          className={`mb-4 rounded border px-4 py-3 text-sm ${
            status.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200"
          }`}
        >
          {status.message}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading repairs…</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 overflow-x-auto lg:grid-cols-3 xl:grid-cols-4">
          {lanes.map((lane) => {
            const items = grouped.get(lane.id) ?? [];
            return (
              <section
                key={lane.id}
                className="min-w-[260px] rounded-lg border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-900/40"
              >
                <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <span>{lane.label}</span>
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {items.length}
                  </span>
                </header>
                <div className="flex flex-col gap-4 p-4">
                  {items.length === 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">No jobs in this lane.</p>
                  )}
                  {items.map((repair) => {
                    const draft = materialsDraft[repair.id] ?? { versionId: "", qty: "" };
                    return (
                      <article
                        key={repair.id}
                        className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900"
                      >
                        <header className="mb-2 flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {repair.jobNumber}
                            </p>
                            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                              {repair.itemDescription || "Item"}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {repair.branchName ? `${repair.branchName} • ` : ""}
                              {repair.customerName || `Customer #${repair.customerId}`}
                            </p>
                          </div>
                          <Link
                            href={`/repairs/${repair.id}`}
                            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Details
                          </Link>
                        </header>
                        <p className="mb-2 text-xs text-slate-600 dark:text-slate-300">
                          {repair.issueDescription || "No issue recorded."}
                        </p>
                        <dl className="mb-3 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <dt className="text-slate-500">Estimate</dt>
                            <dd className="font-medium">{centsToCurrency(repair.estimateCents)}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Balance</dt>
                            <dd className="font-medium">{centsToCurrency(repair.balanceDueCents)}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Approval</dt>
                            <dd>{approvalLabels[repair.approvalStatus] ?? repair.approvalStatus}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Promised</dt>
                            <dd>{repair.promisedAt ? new Date(repair.promisedAt).toLocaleString() : "--"}</dd>
                          </div>
                        </dl>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRequestApproval(repair.id)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Request approval
                          </button>
                          <select
                            value={repair.status}
                            onChange={(event) => handleMove(repair.id, event.target.value)}
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                Move to {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <form
                          className="space-y-2 border-t border-slate-200 pt-2 text-xs dark:border-slate-700"
                          onSubmit={(event) => submitMaterials(event, repair.id, "issue")}
                        >
                          <p className="font-medium text-slate-600 dark:text-slate-300">Materials</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              placeholder="Version ID"
                              value={draft.versionId}
                              onChange={(event) => updateDraft(repair.id, "versionId", event.target.value)}
                              className="w-32 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                            />
                            <input
                              type="number"
                              min={1}
                              placeholder="Qty"
                              value={draft.qty}
                              onChange={(event) => updateDraft(repair.id, "qty", event.target.value)}
                              className="w-20 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="submit"
                              className="rounded bg-amber-500 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-400"
                            >
                              Issue
                            </button>
                            <button
                              type="button"
                              onClick={(event) => submitMaterials(event, repair.id, "return")}
                              className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                            >
                              Return
                            </button>
                          </div>
                        </form>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
