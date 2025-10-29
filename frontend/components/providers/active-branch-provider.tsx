"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type BranchSummary = {
  id: number;
  code: string | null;
  name: string;
};

type ActiveBranchState = {
  branch: BranchSummary | null;
  loading: boolean;
  error: string | null;
};

type ActiveBranchContextValue = ActiveBranchState & {
  refresh: () => void;
};

const ActiveBranchContext = createContext<ActiveBranchContextValue | null>(null);

async function fetchActiveBranch(): Promise<BranchSummary> {
  const response = await fetch(`${API_BASE_URL}/api/settings/active-branch`, { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as { branch?: BranchSummary; error?: string };

  if (!response.ok) {
    throw new Error(data?.error ?? "No se pudo obtener la sucursal activa");
  }

  if (!data.branch) {
    throw new Error("No hay una sucursal activa configurada");
  }

  return data.branch;
}

export function ActiveBranchProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ActiveBranchState>({ branch: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const branch = await fetchActiveBranch();
      setState({ branch, loading: false, error: null });
    } catch (error) {
      setState({ branch: null, loading: false, error: error instanceof Error ? error.message : "Error desconocido" });
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    const handler = () => {
      load().catch(() => undefined);
    };

    window.addEventListener("active-branch:updated", handler);
    return () => {
      window.removeEventListener("active-branch:updated", handler);
    };
  }, [load]);

  const value = useMemo<ActiveBranchContextValue>(() => ({ ...state, refresh: load }), [state, load]);

  return <ActiveBranchContext.Provider value={value}>{children}</ActiveBranchContext.Provider>;
}

export function useActiveBranch() {
  const context = useContext(ActiveBranchContext);
  if (!context) {
    throw new Error("useActiveBranch debe usarse dentro de ActiveBranchProvider");
  }
  return context;
}
