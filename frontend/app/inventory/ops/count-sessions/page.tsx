"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { AlertTriangle, ClipboardList, Loader2, ShieldCheck, Snowflake } from "lucide-react";

import { formatDateForDisplay, formatDateTimeForDisplay } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type CountSession = {
  id: number;
  name: string;
  branchId: number | null;
  branchName: string | null;
  scope: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  snapshotAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  freezeMovements: boolean;
  lineCount?: number;
  variance?: number;
};

function StatusBadge({ status }: { status: string }) {
  const tone = useMemo(() => {
    if (["open"].includes(status)) return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100";
    if (["review"].includes(status)) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100";
    if (["posted"].includes(status)) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100";
    if (["cancelled"].includes(status)) return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-100";
    return "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200";
  }, [status]);

  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{status}</span>;
}

export default function CountSessionsPage() {
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    branchId: "",
    scope: "cycle",
    locationScope: "",
    startDate: "",
    dueDate: "",
    freezeMovements: false,
    counters: "",
  });

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory/count-sessions`);
      const payload = (await response.json().catch(() => ({}))) as { sessions?: CountSession[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudieron cargar las sesiones de conteo.");
      }
      setSessions(payload.sessions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las sesiones de conteo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const counters = form.counters
      .split(",")
      .map((entry) => Number(entry.trim()))
      .filter((id) => Number.isInteger(id) && id > 0)
      .map((userId) => ({ userId }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory/count-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          branchId: Number(form.branchId),
          scope: form.scope,
          locationScope: form.locationScope.trim() || undefined,
          startDate: form.startDate || undefined,
          dueDate: form.dueDate || undefined,
          freezeMovements: form.freezeMovements,
          createdBy: counters[0]?.userId ?? 1,
          counters,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo crear la sesión.");
      }

      setMessage("Sesión creada");
      setForm((prev) => ({ ...prev, name: "", counters: "" }));
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la sesión.");
    }
  };

  const handleStatus = async (sessionId: number, status: string) => {
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory/count-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No se pudo actualizar la sesión.");
      }

      setMessage("Sesión actualizada");
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la sesión.");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <ClipboardList className="h-4 w-4" />
          <span>Sesiones de conteo</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Planificación de conteos</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Configura sesiones con alcance, fechas y responsables. Controla avances y estados de revisión.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr,2fr]">
        <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Nueva sesión
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Nombre</label>
            <input
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Ej: Conteo general Noviembre"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Sucursal</label>
              <input
                required
                type="number"
                value={form.branchId}
                onChange={(event) => setForm((prev) => ({ ...prev, branchId: event.target.value }))}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Ámbito</label>
              <select
                value={form.scope}
                onChange={(event) => setForm((prev) => ({ ...prev, scope: event.target.value }))}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="cycle">Cíclico</option>
                <option value="full">Completo</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Zonas / Ubicación</label>
            <input
              value={form.locationScope}
              onChange={(event) => setForm((prev) => ({ ...prev, locationScope: event.target.value }))}
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Pasillo A, vitrinas, alto valor"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Inicio</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Vencimiento</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="freeze"
              type="checkbox"
              checked={form.freezeMovements}
              onChange={(event) => setForm((prev) => ({ ...prev, freezeMovements: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <label htmlFor="freeze" className="text-sm text-slate-700 dark:text-slate-300">
              Alertar si hay movimientos luego del corte
            </label>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Contadores (IDs separados por coma)</label>
            <input
              value={form.counters}
              onChange={(event) => setForm((prev) => ({ ...prev, counters: event.target.value }))}
              className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="1,2,3"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? "Creando..." : "Crear sesión"}
          </button>
          {message && <p className="text-sm text-emerald-600 dark:text-emerald-300">{message}</p>}
          {error && <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
        </form>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Sesiones activas</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Estado, responsables y fechas de corte.</p>
            </div>
            {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Sesión</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Fechas</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Variación</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                      No hay sesiones aún.
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={session.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{session.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">#{session.id} · {session.scope}</div>
                        {session.freezeMovements && (
                          <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-100">
                            <Snowflake className="h-3 w-3" /> Congelar movimientos
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {session.branchName ?? (session.branchId ? `Sucursal #${session.branchId}` : "—")}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <div>Inicio: {formatDateForDisplay(session.startDate)}</div>
                        <div>Vence: {formatDateForDisplay(session.dueDate)}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">Corte: {formatDateTimeForDisplay(session.snapshotAt)}</div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={session.status} /></td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <div>Líneas: {session.lineCount ?? "—"}</div>
                        <div>Varianza: {session.variance ?? 0}</div>
                      </td>
                      <td className="px-4 py-3 space-y-2 text-xs">
                        <button
                          type="button"
                          onClick={() => void handleStatus(session.id, "review")}
                          className="rounded border border-slate-200 px-3 py-1 font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                          A revisión
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleStatus(session.id, "posted")}
                          className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100"
                        >
                          Cerrar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleStatus(session.id, "cancelled")}
                          className="rounded border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100"
                        >
                          Cancelar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}
    </div>
  );
}
