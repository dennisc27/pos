"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export type UserSummary = {
  id: number;
  branchId: number;
  email: string | null;
  phone: string | null;
  fullName: string;
  roleId: number;
  isActive: boolean;
};

type CurrentUserState = {
  user: UserSummary | null;
  loading: boolean;
  error: string | null;
};

type CurrentUserContextValue = CurrentUserState & {
  refresh: () => void;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

async function fetchCurrentUser(): Promise<UserSummary> {
  const response = await fetch(`${API_BASE_URL}/api/settings/current-user`, { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as { user?: UserSummary; error?: string };

  if (!response.ok) {
    throw new Error(data?.error ?? "No se pudo obtener el usuario actual");
  }

  if (!data.user) {
    throw new Error("No hay un usuario actual configurado");
  }

  return data.user;
}

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CurrentUserState>({ user: null, loading: true, error: null });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const user = await fetchCurrentUser();
      setState({ user, loading: false, error: null });
    } catch (error) {
      setState({ user: null, loading: false, error: error instanceof Error ? error.message : "Error desconocido" });
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const value = useMemo<CurrentUserContextValue>(() => ({ ...state, refresh: load }), [state, load]);

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error("useCurrentUser debe usarse dentro de CurrentUserProvider");
  }
  return context;
}


