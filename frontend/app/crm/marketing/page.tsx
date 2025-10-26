"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Calendar, Megaphone, MessageSquarePlus, Plus, Rocket, Send, Users } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type MarketingTemplate = {
  id: number;
  name: string;
  channel: "sms" | "whatsapp" | "email";
  subject: string | null;
  body: string;
  variables: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

type MarketingSegment = {
  id: number;
  name: string;
  description: string | null;
  filters: SegmentFilters;
  createdAt: string | null;
  updatedAt: string | null;
};

type SegmentFilters = {
  branchIds?: number[];
  blacklisted?: boolean;
  minLoyalty?: number;
  tags?: string[];
};

type MarketingCampaign = {
  id: number;
  name: string;
  templateId: number;
  templateName: string | null;
  segmentId: number;
  segmentName: string | null;
  status: string;
  scheduledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  sendCount: number;
};

type TemplatesResponse = { templates: MarketingTemplate[] };
type SegmentsResponse = { segments: MarketingSegment[] };
type CampaignsResponse = { campaigns: MarketingCampaign[] };

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

export default function CrmMarketingPage() {
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingSegment, setSavingSegment] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [sendingCampaignId, setSendingCampaignId] = useState<number | null>(null);

  const [templateForm, setTemplateForm] = useState({
    name: "",
    channel: "sms" as MarketingTemplate["channel"],
    subject: "",
    body: "Hola {{first_name}}, gracias por visitarnos",
  });

  const [segmentForm, setSegmentForm] = useState({
    name: "",
    description: "",
    branchIds: "",
    includeBlacklisted: false,
    minLoyalty: "0",
  });

  const [campaignForm, setCampaignForm] = useState({
    name: "",
    templateId: "",
    segmentId: "",
    scheduledAt: "",
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templateRes, segmentRes, campaignRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/marketing/templates`),
        fetch(`${API_BASE_URL}/api/marketing/segments`),
        fetch(`${API_BASE_URL}/api/marketing/campaigns`)
      ]);

      if (!templateRes.ok || !segmentRes.ok || !campaignRes.ok) {
        throw new Error("Failed to load marketing data");
      }

      const templatePayload = (await templateRes.json()) as TemplatesResponse;
      const segmentPayload = (await segmentRes.json()) as SegmentsResponse;
      const campaignPayload = (await campaignRes.json()) as CampaignsResponse;

      setTemplates(templatePayload.templates ?? []);
      setSegments(segmentPayload.segments ?? []);
      setCampaigns(campaignPayload.campaigns ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load marketing data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleTemplateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!templateForm.name.trim() || !templateForm.body.trim()) return;
    setSavingTemplate(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mkt/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateForm.name.trim(),
          channel: templateForm.channel,
          subject: templateForm.channel === "email" ? templateForm.subject.trim() : undefined,
          body: templateForm.body.trim(),
          variables: extractVariables(templateForm.body)
        })
      });
      if (!response.ok) {
        throw new Error(`Unable to save template (${response.status})`);
      }
      setTemplateForm({ name: "", channel: templateForm.channel, subject: "", body: templateForm.body });
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSegmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!segmentForm.name.trim()) return;
    setSavingSegment(true);
    try {
      const filters: SegmentFilters = {};
      if (segmentForm.branchIds.trim()) {
        const ids = segmentForm.branchIds
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((id) => Number.isInteger(id) && id > 0);
        if (ids.length > 0) filters.branchIds = ids;
      }
      if (segmentForm.includeBlacklisted) {
        filters.blacklisted = false;
      }
      const minLoyaltyValue = Number(segmentForm.minLoyalty);
      if (Number.isFinite(minLoyaltyValue) && minLoyaltyValue > 0) {
        filters.minLoyalty = minLoyaltyValue;
      }

      const response = await fetch(`${API_BASE_URL}/api/mkt/segments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: segmentForm.name.trim(),
          description: segmentForm.description.trim() || undefined,
          filters
        })
      });
      if (!response.ok) {
        throw new Error(`Unable to save segment (${response.status})`);
      }
      setSegmentForm({ name: "", description: "", branchIds: "", includeBlacklisted: false, minLoyalty: "0" });
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save segment");
    } finally {
      setSavingSegment(false);
    }
  };

  const handleCampaignSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!campaignForm.name.trim() || !campaignForm.templateId || !campaignForm.segmentId) return;
    setSavingCampaign(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mkt/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignForm.name.trim(),
          templateId: Number(campaignForm.templateId),
          segmentId: Number(campaignForm.segmentId),
          scheduledAt: campaignForm.scheduledAt.trim() || undefined
        })
      });
      if (!response.ok) {
        throw new Error(`Unable to create campaign (${response.status})`);
      }
      setCampaignForm({ name: "", templateId: "", segmentId: "", scheduledAt: "" });
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create campaign");
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleSendCampaign = async (campaignId: number) => {
    setSendingCampaignId(campaignId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mkt/campaigns/${campaignId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const errorMessage = typeof body?.error === "string" ? body.error : `Unable to queue send (${response.status})`;
        throw new Error(errorMessage);
      }
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to queue campaign send");
    } finally {
      setSendingCampaignId(null);
    }
  };

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return bTime - aTime;
    });
  }, [campaigns]);

  return (
    <main className="flex min-h-screen flex-col bg-slate-50/40 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white/80 px-8 py-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">CRM</p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Marketing hub</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Build templates, define audience segments, and launch tracked outreach campaigns.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchAll}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Rocket className="h-4 w-4" aria-hidden /> Sync data
          </button>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50/60 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
            Loading marketing data...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Templates</p>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Message blueprints</h2>
                </div>
                <Plus className="h-5 w-5 text-slate-400" aria-hidden />
              </header>
              <form onSubmit={handleTemplateSubmit} className="flex flex-col gap-3">
                <input
                  value={templateForm.name}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Template name"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Channel
                  <select
                    value={templateForm.channel}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({
                        ...prev,
                        channel: event.target.value as MarketingTemplate["channel"],
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                  </select>
                </label>
                {templateForm.channel === "email" ? (
                  <input
                    value={templateForm.subject}
                    onChange={(event) => setTemplateForm((prev) => ({ ...prev, subject: event.target.value }))}
                    placeholder="Subject line"
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                ) : null}
                <textarea
                  value={templateForm.body}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, body: event.target.value }))}
                  placeholder="Message body (use {{first_name}}, {{loyalty_points}}, etc.)"
                  className="min-h-[120px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={savingTemplate || !templateForm.name.trim() || !templateForm.body.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  <MessageSquarePlus className="h-4 w-4" aria-hidden /> Save template
                </button>
              </form>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {templates.map((template) => (
                  <li
                    key={template.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50"
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <span>{template.channel}</span>
                      <span>{formatDateTime(template.updatedAt)}</span>
                    </div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{template.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Vars: {template.variables.join(", ") || "—"}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Segments</p>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Audience builder</h2>
                </div>
                <Users className="h-5 w-5 text-slate-400" aria-hidden />
              </header>
              <form onSubmit={handleSegmentSubmit} className="flex flex-col gap-3">
                <input
                  value={segmentForm.name}
                  onChange={(event) => setSegmentForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Segment name"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <textarea
                  value={segmentForm.description}
                  onChange={(event) => setSegmentForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Purpose or notes"
                  className="min-h-[72px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Branch IDs (comma separated)
                  <input
                    value={segmentForm.branchIds}
                    onChange={(event) => setSegmentForm((prev) => ({ ...prev, branchIds: event.target.value }))}
                    placeholder="e.g. 1,2,3"
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={segmentForm.includeBlacklisted}
                    onChange={(event) => setSegmentForm((prev) => ({ ...prev, includeBlacklisted: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900"
                  />
                  Exclude blacklisted customers
                </label>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Minimum loyalty points
                  <input
                    type="number"
                    min={0}
                    value={segmentForm.minLoyalty}
                    onChange={(event) => setSegmentForm((prev) => ({ ...prev, minLoyalty: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
                <button
                  type="submit"
                  disabled={savingSegment || !segmentForm.name.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  <Megaphone className="h-4 w-4" aria-hidden /> Save segment
                </button>
              </form>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {segments.map((segment) => (
                  <li key={segment.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <span>{formatDateTime(segment.updatedAt)}</span>
                      <span>{segment.filters.branchIds?.length ?? 0} branches</span>
                    </div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{segment.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Min loyalty: {segment.filters.minLoyalty ?? 0}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-1 lg:row-span-2">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Campaigns</p>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Send wizard</h2>
                </div>
                <Calendar className="h-5 w-5 text-slate-400" aria-hidden />
              </header>
              <form onSubmit={handleCampaignSubmit} className="flex flex-col gap-3">
                <input
                  value={campaignForm.name}
                  onChange={(event) => setCampaignForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Campaign name"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Template
                  <select
                    value={campaignForm.templateId}
                    onChange={(event) => setCampaignForm((prev) => ({ ...prev, templateId: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.channel})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Segment
                  <select
                    value={campaignForm.segmentId}
                    onChange={(event) => setCampaignForm((prev) => ({ ...prev, segmentId: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select segment</option>
                    {segments.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Schedule (optional)
                  <input
                    type="datetime-local"
                    value={campaignForm.scheduledAt}
                    onChange={(event) => setCampaignForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
                <button
                  type="submit"
                  disabled={savingCampaign || !campaignForm.name.trim() || !campaignForm.templateId || !campaignForm.segmentId}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
                >
                  <Send className="h-4 w-4" aria-hidden /> Create campaign
                </button>
              </form>
              <div className="flex-1 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Campaign</th>
                      <th className="px-3 py-2">Template</th>
                      <th className="px-3 py-2">Segment</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Queued</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedCampaigns.map((campaign) => (
                      <tr key={campaign.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{campaign.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(campaign.updatedAt)}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{campaign.templateName ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{campaign.segmentName ?? "—"}</td>
                        <td className="px-3 py-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{campaign.status}</td>
                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{campaign.sendCount}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleSendCampaign(campaign.id)}
                            disabled={sendingCampaignId === campaign.id}
                            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600"
                          >
                            <Send className="h-3 w-3" aria-hidden /> Send
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sortedCampaigns.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                          No campaigns created yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function extractVariables(body: string): string[] {
  const matches = body.match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g) ?? [];
  const values = matches.map((match) => match.replace(/{{|}}/g, "").trim().toLowerCase());
  return Array.from(new Set(values));
}
