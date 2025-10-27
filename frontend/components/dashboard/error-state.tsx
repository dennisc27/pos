"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DashboardErrorState({
  message = "No pudimos cargar estos datos. Intenta refrescar la página."
}: {
  message?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-red-200/70 bg-red-50/60 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
      <div className="font-medium">Hubo un problema al cargar este panel.</div>
      <p className="text-xs text-red-600/90 dark:text-red-200/80">{message}</p>
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        className="inline-flex w-max items-center justify-center gap-2 rounded-lg border border-red-300/80 bg-white px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-800/80 dark:bg-transparent dark:text-red-200 dark:hover:bg-red-900/40"
        disabled={isPending}
      >
        {isPending ? "Reintentando…" : "Reintentar"}
      </button>
    </div>
  );
}
